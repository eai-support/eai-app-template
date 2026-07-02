import { evaluateRuntimeReadiness } from './readiness';

function readyEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
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
}

describe('runtime readiness contract', () => {
  it('returns ready when runtime config, secrets, tenant assignment, and object types are present', () => {
    const result = evaluateRuntimeReadiness(readyEnv());

    expect(result).toMatchObject({
      ok: true,
      service: 'contract-test',
      failureCategories: [],
    });
    expect(result.checks.every((check) => check.ok)).toBe(true);
  });

  it('reports sanitized failure categories without returning secret values', () => {
    const env = readyEnv();
    delete env.AUTH_SECRET;
    env.BASE_URL_PUBLIC_API = 'not-a-url';

    const result = evaluateRuntimeReadiness(env);
    const serialized = JSON.stringify(result);

    expect(result.ok).toBe(false);
    expect(result.failureCategories).toEqual(
      expect.arrayContaining([
        'auth_misconfigured',
        'publicapi_unreachable',
        'secret_missing',
      ]),
    );
    expect(serialized).toContain('AUTH_SECRET');
    expect(serialized).not.toContain('test-entra-secret');
    expect(serialized).not.toContain('test-auth-secret');
  });
});
