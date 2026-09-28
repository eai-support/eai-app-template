import { GET } from './route';
import { generatedWorkflowPlatformFetch } from '@/lib/generated-workflow/platform';
import { getGeneratedWorkflowRuntime } from '@/lib/generated-workflow/runtime';
import { objectTypes } from '@/eai.config/object-types';

jest.mock('@/lib/generated-workflow/runtime', () => ({
  getGeneratedWorkflowRuntime: jest.fn(),
}));
jest.mock('@/lib/generated-workflow/platform', () => ({
  generatedWorkflowPlatformFetch: jest.fn(),
}));

const READINESS_PROBE_TOKEN_ENV = ['EAI', 'READINESS', 'PROBE', 'TOKEN'].join(
  '_',
);
const TEST_TENANT_KEY = Object.keys(objectTypes)[0] ?? 'template';
const TEST_TENANT_ENV_KEY = TEST_TENANT_KEY.toUpperCase().replace(/-/g, '_');

describe('readiness route', () => {
  const mutableGlobal = global as {
    Response?: typeof Response;
  };
  const originalResponse = mutableGlobal.Response;
  const originalEnv = process.env;

  beforeEach(() => {
    mutableGlobal.Response = {
      json: (body: unknown, init?: ResponseInit) => ({
        status: init?.status ?? 200,
        headers: new Headers(init?.headers),
        json: async () => body,
      }),
    } as unknown as typeof Response;
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_NAME: 'contract-test',
      APP_BASE_PATH: '/contract-test',
      NEXT_PUBLIC_APP_BASE_PATH: '/contract-test',
      NEXT_PUBLIC_EAI_TENANT_ID: 'tenant-template',
      BASE_URL_PUBLIC_API: 'https://publicapi.example.test',
      ROUTING_BOOTSTRAP_PUBLIC_API_URL: 'https://publicapi.example.test',
      EAI_PRODUCT_SLUG: 'contract-test',
      EAI_ENVIRONMENT: 'dev',
      EAI_CONFIG_HASH: 'cfg-123',
      EAI_DEPLOYMENT_ID: 'deployment-123',
      AZURE_CLIENT_ID: 'runtime-client-123',
      EAI_RUNTIME_PRINCIPAL_ID: 'runtime-principal-123',
      TENANT_KEYS: TEST_TENANT_KEY,
      [`TENANT_${TEST_TENANT_ENV_KEY}_ID`]: 'tenant-template',
      [`WORKFLOW_${TEST_TENANT_ENV_KEY}_ID`]: 'workflow-template',
      ENTRA_TENANT_NAME: 'example',
      ENTRA_TENANT_ID: 'entra-tenant',
      ENTRA_CLIENT_ID: 'entra-client',
      ENTRA_SCOPES: 'api://example/.default',
      ENTRA_CLIENT_SECRET: 'test-entra-secret',
      AUTH_URL: 'https://contract-test.example.test',
      AUTH_TRUST_HOST: 'true',
      AUTH_SECRET: 'test-auth-secret',
      [READINESS_PROBE_TOKEN_ENV]: 'probe-token',
    };
    (getGeneratedWorkflowRuntime as jest.Mock).mockReturnValue({
      status: 'unconfigured',
    });
    (generatedWorkflowPlatformFetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        runtimeBinding: {
          schemaVersion: 'eai.generated_app_runtime_binding.v1',
          workflowTemplate: {
            id: 'template-123',
            version: 1,
            digest: `sha256:${'a'.repeat(64)}`,
            title: 'Rates Review',
          },
          respondentAccess: {
            mode: 'anonymous',
            submissionObjectType: 'workflow-submission',
            fileObjectType: 'submission-file',
          },
        },
      }),
    });
  });

  afterEach(() => {
    if (originalResponse) {
      mutableGlobal.Response = originalResponse;
    } else {
      delete mutableGlobal.Response;
    }
    process.env = originalEnv;
  });

  function readinessRequest(headers: Record<string, string> = {}): Request {
    return {
      headers: new Headers({
        'x-eai-readiness-probe': 'tenantinfra',
        'x-eai-tenant-id': 'tenant-template',
        'x-eai-app-key': 'contract-test',
        'x-eai-environment': 'dev',
        'x-eai-config-hash': 'cfg-123',
        'x-eai-deployment-id': 'deployment-123',
        authorization: 'Bearer probe-token',
        ...headers,
      }),
    } as Request;
  }

  it('returns readiness with no-store cache headers', async () => {
    const response = await GET(readinessRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(body).toMatchObject({
      ok: true,
      service: 'contract-test',
      deploymentBinding: {
        tenantId: 'tenant-template',
        appKey: 'contract-test',
        environment: 'dev',
        configHash: 'cfg-123',
        deploymentId: 'deployment-123',
        runtimeIdentity: {
          clientId: 'runtime-client-123',
          principalId: 'runtime-principal-123',
        },
      },
      failureCategories: [],
    });
  });

  it('returns 503 with sanitized failure categories when readiness fails', async () => {
    delete process.env['AUTH_SECRET'];

    const response = await GET(readinessRequest());
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(503);
    expect(body.failureCategories).toEqual(
      expect.arrayContaining(['auth_misconfigured', 'secret_missing']),
    );
    expect(serialized).toContain('AUTH_SECRET');
    expect(serialized).not.toContain('test-entra-secret');
    expect(serialized).not.toContain('test-auth-secret');
    expect(serialized).not.toContain('probe-token');
  });

  it('proves generic runtime readiness without an NCB workflow assignment', async () => {
    delete process.env[`WORKFLOW_${TEST_TENANT_ENV_KEY}_ID`];

    const response = await GET(readinessRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.failureCategories).toEqual([]);
    expect(body.runtimeBinding).toBeUndefined();
    expect(generatedWorkflowPlatformFetch).not.toHaveBeenCalled();
  });

  it('rejects requests that are not TenantInfra readiness probes', async () => {
    const response = await GET({ headers: new Headers() } as Request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.failureCategories).toEqual(['auth_misconfigured']);
    expect(body.checks).toEqual([
      { name: 'tenantinfra-probe', ok: false, category: 'auth_misconfigured' },
    ]);
    expect(body.deploymentBinding).toBeUndefined();
  });

  it.each([
    'x-eai-tenant-id',
    'x-eai-app-key',
    'x-eai-environment',
    'x-eai-config-hash',
    'x-eai-deployment-id',
  ])(
    'rejects missing or mismatched %s without revealing runtime binding',
    async (header) => {
      for (const value of [undefined, 'different-scope']) {
        const request = readinessRequest();
        if (value === undefined) {
          request.headers.delete(header);
        } else {
          request.headers.set(header, value);
        }
        const response = await GET(request);
        const body = await response.json();

        expect(response.status).toBe(403);
        expect(body.failureCategories).toEqual(['tenant_assignment_invalid']);
        expect(body.deploymentBinding).toBeUndefined();
      }
    },
  );

  it('rejects probes without the configured bearer token', async () => {
    const response = await GET(readinessRequest({ authorization: '' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.failureCategories).toEqual(['auth_misconfigured']);
    expect(body.deploymentBinding).toBeUndefined();
  });

  it('reports the runtime identity rather than identity claims in request headers', async () => {
    const response = await GET(
      readinessRequest({
        'x-eai-runtime-client-id': 'caller-client',
        'x-eai-runtime-principal-id': 'caller-principal',
      }),
    );
    const body = await response.json();

    expect(body.deploymentBinding.runtimeIdentity).toEqual({
      clientId: 'runtime-client-123',
      principalId: 'runtime-principal-123',
    });
  });

  it.each(['AZURE_CLIENT_ID', 'EAI_RUNTIME_PRINCIPAL_ID'])(
    'does not substitute caller claims when runtime %s is absent',
    async (envKey) => {
      delete process.env[envKey];

      const response = await GET(
        readinessRequest({
          'x-eai-runtime-client-id': 'caller-client',
          'x-eai-runtime-principal-id': 'caller-principal',
        }),
      );
      const body = await response.json();
      const serialized = JSON.stringify(body);
      const binding = JSON.parse(serialized).deploymentBinding;

      expect(response.status).toBe(200);
      expect(serialized).not.toContain('caller-client');
      expect(serialized).not.toContain('caller-principal');
      expect(binding.runtimeIdentity).toEqual(
        envKey === 'AZURE_CLIENT_ID'
          ? { principalId: 'runtime-principal-123' }
          : { clientId: 'runtime-client-123' },
      );
    },
  );

  it('rejects probes when the bearer token is not configured', async () => {
    delete process.env[READINESS_PROBE_TOKEN_ENV];

    const response = await GET(readinessRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.failureCategories).toEqual(['auth_misconfigured']);
    expect(body.deploymentBinding).toBeUndefined();
  });

  it('accepts probes with the configured bearer token', async () => {
    const response = await GET(readinessRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.failureCategories).toEqual([]);
    expect(body.deploymentBinding).toMatchObject({
      tenantId: 'tenant-template',
      appKey: 'contract-test',
    });
  });

  it('accepts the exact active deployment identity', async () => {
    const response = await GET(
      readinessRequest({ 'x-eai-deployment-id': 'deployment-123' }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.failureCategories).toEqual([]);
  });

  it('rejects a missing deployment identity header', async () => {
    const request = readinessRequest();
    request.headers.delete('x-eai-deployment-id');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.failureCategories).toEqual(['tenant_assignment_invalid']);
  });

  it('rejects a changed deployment identity header', async () => {
    const response = await GET(
      readinessRequest({ 'x-eai-deployment-id': 'deployment-other' }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.failureCategories).toEqual(['tenant_assignment_invalid']);
  });

  it('fails readiness when runtime deployment identity is not configured', async () => {
    delete process.env['EAI_DEPLOYMENT_ID'];

    const response = await GET(readinessRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.failureCategories).toContain('config_missing');
    expect(body.checks).toContainEqual(
      expect.objectContaining({
        name: 'runtime-env',
        ok: false,
        missing: expect.arrayContaining(['EAI_DEPLOYMENT_ID']),
      }),
    );
  });

  it('fails readiness when runtime deployment identity is not canonical', async () => {
    process.env['EAI_DEPLOYMENT_ID'] = ' deployment-123 ';

    const response = await GET(readinessRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.failureCategories).toContain('config_missing');
    expect(body.checks).toContainEqual(
      expect.objectContaining({
        name: 'runtime-env',
        ok: false,
        missing: expect.arrayContaining(['EAI_DEPLOYMENT_ID']),
      }),
    );
  });

  it('accepts TenantInfra runtime env names for scope binding', async () => {
    delete process.env['NEXT_PUBLIC_EAI_TENANT_ID'];
    delete process.env['EAI_PRODUCT_SLUG'];
    process.env['EAI_TENANT_ID'] = 'tenant-template';
    process.env['EAI_APP_KEY'] = 'contract-test';

    const response = await GET(readinessRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.failureCategories).toEqual([]);
    expect(body.deploymentBinding).toMatchObject({
      tenantId: 'tenant-template',
      appKey: 'contract-test',
    });
  });

  it('includes the bound workflow digest and title for TenantInfra promotion', async () => {
    (getGeneratedWorkflowRuntime as jest.Mock).mockReturnValue({
      status: 'ready',
      runtime: {
        tenantId: 'tenant-template',
        appKey: 'contract-test',
        binding: {
          schemaVersion: 'eai.generated_app_runtime_binding.v1',
          workflowTemplate: {
            id: 'template-123',
            version: 1,
            digest: `sha256:${'a'.repeat(64)}`,
            title: 'Rates Review',
          },
          respondentAccess: {
            mode: 'anonymous',
            submissionObjectType: 'workflow-submission',
            fileObjectType: 'submission-file',
          },
        },
      },
    });

    const response = await GET(readinessRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.runtimeBinding).toEqual({
      workflowTemplate: {
        digest: `sha256:${'a'.repeat(64)}`,
        title: 'Rates Review',
      },
    });
    expect(generatedWorkflowPlatformFetch).toHaveBeenCalledWith({
      tenantId: 'tenant-template',
      appKey: 'contract-test',
      path: '/workflow',
    });

    delete process.env[`WORKFLOW_${TEST_TENANT_ENV_KEY}_ID`];
    const missingAssignmentResponse = await GET(readinessRequest());
    expect(missingAssignmentResponse.status).toBe(503);
    expect(
      (await missingAssignmentResponse.json()).failureCategories,
    ).toContain('tenant_assignment_invalid');
  });

  it('fails readiness when the generated workflow platform is unreachable', async () => {
    (getGeneratedWorkflowRuntime as jest.Mock).mockReturnValue({
      status: 'ready',
      runtime: {
        tenantId: 'tenant-template',
        appKey: 'contract-test',
        binding: {
          schemaVersion: 'eai.generated_app_runtime_binding.v1',
          workflowTemplate: {
            id: 'template-123',
            version: 1,
            digest: `sha256:${'a'.repeat(64)}`,
            title: 'Rates Review',
          },
          respondentAccess: {
            mode: 'anonymous',
            submissionObjectType: 'workflow-submission',
            fileObjectType: 'submission-file',
          },
        },
      },
    });
    (generatedWorkflowPlatformFetch as jest.Mock).mockRejectedValue(
      new TypeError('fetch failed'),
    );

    const response = await GET(readinessRequest());
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.failureCategories).toContain('publicapi_unreachable');
    expect(body.checks).toContainEqual({
      name: 'generated-workflow-platform',
      ok: false,
      category: 'publicapi_unreachable',
    });
  });
});
