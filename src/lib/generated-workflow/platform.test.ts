import {
  __setGeneratedWorkflowTokenProviderForTests,
  GeneratedWorkflowPlatformUnavailableError,
  generatedWorkflowPlatformFetch,
} from './platform';

describe('generated workflow runtime facade client', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      EAI_PLATFORM_API_BASE_URL: 'https://publicapi.example.test',
      EAI_PLATFORM_TOKEN_AUDIENCE: 'api://generated-runtime',
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ submissionId: 'submission-1' }),
    });
    __setGeneratedWorkflowTokenProviderForTests(async (audience) => {
      expect(audience).toBe('api://generated-runtime');
      return 'managed-identity-token';
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    __setGeneratedWorkflowTokenProviderForTests(null);
  });

  it('keeps tenant, app, and managed identity on the server-side facade call', async () => {
    await generatedWorkflowPlatformFetch({
      tenantId: 'tenant a',
      appKey: 'rates-review',
      path: '/submissions',
      anonymousClientId: `sha256:${'a'.repeat(64)}`,
      init: {
        method: 'POST',
        body: JSON.stringify({ device: 'Desktop' }),
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://publicapi.example.test/v4/generated-app-runtime/tenants/tenant%20a/apps/rates-review/submissions',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
        headers: expect.any(Headers),
      }),
    );
    const headers = (global.fetch as jest.Mock).mock.calls[0][1]
      .headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer managed-identity-token');
    expect(headers.get('X-EAI-Anonymous-Client')).toBe(
      `sha256:${'a'.repeat(64)}`,
    );
    expect(headers.get('tenant')).toBeNull();
  });

  it('classifies a platform network failure without exposing its target', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      generatedWorkflowPlatformFetch({
        tenantId: 'tenant-a',
        appKey: 'rates-review',
        path: '/submissions',
        init: { method: 'POST' },
      }),
    ).rejects.toEqual(expect.any(GeneratedWorkflowPlatformUnavailableError));

    await generatedWorkflowPlatformFetch({
      tenantId: 'tenant-a',
      appKey: 'rates-review',
      path: '/submissions',
      init: { method: 'POST' },
    }).catch((error: unknown) => {
      expect(String(error)).not.toContain('publicapi.example.test');
      expect(String(error)).not.toContain('tenant-a');
    });
  });

  it('shares one managed-identity lookup across concurrent platform calls', async () => {
    __setGeneratedWorkflowTokenProviderForTests(null);
    process.env.IDENTITY_ENDPOINT = 'http://127.0.0.1:42356/msi/token';
    process.env.IDENTITY_HEADER = 'identity-proof';
    process.env.AZURE_CLIENT_ID = 'runtime-client';
    let releaseIdentityLookup: () => void = () => undefined;
    const identityLookupGate = new Promise<void>((resolve) => {
      releaseIdentityLookup = resolve;
    });
    global.fetch = jest.fn(async (input) => {
      if (String(input).startsWith(process.env.IDENTITY_ENDPOINT!)) {
        await identityLookupGate;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'shared-managed-identity-token',
            expires_on: Math.floor(Date.now() / 1000) + 3600,
          }),
        } as Response;
      }
      return { ok: true, status: 200 } as Response;
    }) as typeof fetch;

    const requests = Array.from({ length: 20 }, (_, index) =>
      generatedWorkflowPlatformFetch({
        tenantId: 'tenant-a',
        appKey: 'rates-review',
        path: `/submissions/${index}`,
      }),
    );
    expect(
      (global.fetch as jest.Mock).mock.calls.filter(([input]) =>
        String(input).startsWith(process.env.IDENTITY_ENDPOINT!),
      ),
    ).toHaveLength(1);

    releaseIdentityLookup();
    await Promise.all(requests);

    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls).toHaveLength(21);
    expect(
      calls.filter(([input]) =>
        String(input).startsWith(process.env.IDENTITY_ENDPOINT!),
      ),
    ).toHaveLength(1);
    for (const [, init] of calls.slice(1)) {
      expect((init.headers as Headers).get('Authorization')).toBe(
        'Bearer shared-managed-identity-token',
      );
    }
  });

  it('retries managed identity after a shared lookup fails', async () => {
    __setGeneratedWorkflowTokenProviderForTests(null);
    process.env.IDENTITY_ENDPOINT = 'http://127.0.0.1:42356/msi/token';
    process.env.IDENTITY_HEADER = 'identity-proof';
    let identityAttempts = 0;
    global.fetch = jest.fn(async (input) => {
      if (String(input).startsWith(process.env.IDENTITY_ENDPOINT!)) {
        identityAttempts += 1;
        if (identityAttempts === 1) throw new TypeError('identity unavailable');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'recovered-managed-identity-token',
            expires_on: Math.floor(Date.now() / 1000) + 3600,
          }),
        } as Response;
      }
      return { ok: true, status: 200 } as Response;
    }) as typeof fetch;

    const request = () =>
      generatedWorkflowPlatformFetch({
        tenantId: 'tenant-a',
        appKey: 'rates-review',
        path: '/workflow',
      });

    await expect(request()).rejects.toEqual(
      expect.any(GeneratedWorkflowPlatformUnavailableError),
    );
    await expect(request()).resolves.toMatchObject({ ok: true });
    expect(identityAttempts).toBe(2);
  });
});
