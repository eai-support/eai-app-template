import { GET } from './route';

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
      TENANT_KEYS: 'template',
      TENANT_TEMPLATE_ID: 'tenant-template',
      WORKFLOW_TEMPLATE_ID: 'workflow-template',
      ENTRA_TENANT_NAME: 'example',
      ENTRA_TENANT_ID: 'entra-tenant',
      ENTRA_CLIENT_ID: 'entra-client',
      ENTRA_SCOPES: 'api://example/.default',
      ENTRA_CLIENT_SECRET: 'test-entra-secret',
      AUTH_URL: 'https://contract-test.example.test',
      AUTH_TRUST_HOST: 'true',
      AUTH_SECRET: 'test-auth-secret',
    };
  });

  afterEach(() => {
    if (originalResponse) {
      mutableGlobal.Response = originalResponse;
    } else {
      delete mutableGlobal.Response;
    }
    process.env = originalEnv;
  });

  it('returns readiness with no-store cache headers', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(body).toMatchObject({
      ok: true,
      service: 'contract-test',
      failureCategories: [],
    });
  });

  it('returns 503 with sanitized failure categories when readiness fails', async () => {
    delete process.env.AUTH_SECRET;

    const response = await GET();
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(503);
    expect(body.failureCategories).toEqual(
      expect.arrayContaining(['auth_misconfigured', 'secret_missing']),
    );
    expect(serialized).toContain('AUTH_SECRET');
    expect(serialized).not.toContain('test-entra-secret');
    expect(serialized).not.toContain('test-auth-secret');
  });
});
