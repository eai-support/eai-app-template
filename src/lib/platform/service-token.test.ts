import {
  clearServiceAccessTokenCache,
  getServiceAccessToken,
  resolveServiceIdentityConfig,
} from './service-token';

describe('service identity token helper', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    clearServiceAccessTokenCache();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    clearServiceAccessTokenCache();
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('prefers EAI_SERVICE names over legacy aliases', () => {
    process.env.EAI_SERVICE_CLIENT_ID = 'service-client';
    process.env.EAI_SERVICE_CLIENT_SECRET = 'service-secret';
    process.env.EAI_SERVICE_TARGET_SCOPE = 'api://publicapi/.default';
    process.env.EAI_SERVICE_TENANT_NAME = 'service-tenant';
    process.env.OBO_CLIENT_ID = 'legacy-client';
    process.env.OBO_CLIENT_SECRET = 'legacy-secret';
    process.env.OBO_TARGET_SCOPE = 'api://legacy/.default';
    process.env.OBO_TENANT_NAME = 'legacy-tenant';

    expect(resolveServiceIdentityConfig()).toMatchObject({
      clientId: 'service-client',
      clientSecret: 'service-secret',
      targetScope: 'api://publicapi/.default',
      tenantName: 'service-tenant',
    });
  });

  it('fetches a client credentials token with the resolved service identity', async () => {
    process.env.EAI_SERVICE_CLIENT_ID = 'service-client';
    process.env.EAI_SERVICE_CLIENT_SECRET = 'service-secret';
    process.env.EAI_SERVICE_TARGET_SCOPE = 'api://publicapi/.default';
    process.env.EAI_SERVICE_TENANT_NAME = 'service-tenant';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'token-123', expires_in: 3600 }),
    });

    await expect(getServiceAccessToken()).resolves.toBe('token-123');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://service-tenant.ciamlogin.com/service-tenant/oauth2/v2.0/token',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(URLSearchParams),
      }),
    );
  });
});
