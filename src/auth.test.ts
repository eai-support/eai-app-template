import NextAuth, { type NextAuthConfig } from 'next-auth';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import type { JWT } from 'next-auth/jwt';

jest.mock('next-auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({})),
}));
jest.mock('next-auth/providers/microsoft-entra-id', () => ({
  __esModule: true,
  default: jest.fn(() => ({ id: 'microsoft-entra-id' })),
}));

describe('Entra auth compatibility', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;
  const now = 1_800_000_000_000;
  let config: NextAuthConfig;
  let fetchMock: jest.Mock;

  beforeAll(() => {
    process.env = {
      ...originalEnv,
      ENTRA_TENANT_ID: 'tenant-id',
      ENTRA_TENANT_NAME: 'tenant-name',
      ENTRA_CLIENT_ID: 'client-id',
      ENTRA_CLIENT_SECRET: 'test-client-secret',
      ENTRA_SCOPES: 'openid profile email offline_access',
      AUTH_DEFAULT_TOKEN_EXPIRY: '3600',
      AUTH_SESSION_MAX_AGE: '86400',
    };
    require('./auth');
    config = jest.mocked(NextAuth).mock.calls[0][0] as NextAuthConfig;
  });

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('preserves Entra issuer, named endpoints, scope and JWT session settings', () => {
    expect(jest.mocked(MicrosoftEntraID).mock.calls[0][0]).toEqual({
      clientId: 'client-id',
      clientSecret: 'test-client-secret',
      issuer: 'https://tenant-id.ciamlogin.com/tenant-id/v2.0',
      token: 'https://tenant-name.ciamlogin.com/tenant-id/oauth2/v2.0/token',
      authorization: {
        url: 'https://tenant-name.ciamlogin.com/tenant-id/oauth2/v2.0/authorize',
        params: { scope: 'openid profile email offline_access' },
      },
    });
    expect(config.session).toEqual({ strategy: 'jwt', maxAge: 86400 });
  });

  it.each([1_800_000_300, undefined])('retains login tokens with expiry %s', async expiresAt => {
    const token = await config.callbacks!.jwt!({
      token: { sub: 'user-id' },
      user: { id: 'user-id', name: 'Test User', email: 'user@example.test' },
      account: {
        provider: 'microsoft-entra-id', providerAccountId: 'user-id', type: 'oidc',
        access_token: 'server-access', refresh_token: 'server-refresh', expires_at: expiresAt,
      },
    });
    expect(token).toEqual({
      sub: 'user-id', name: 'Test User', email: 'user@example.test',
      accessToken: 'server-access', refreshToken: 'server-refresh',
      accessTokenExpires: expiresAt ? expiresAt * 1000 : now + 3_600_000,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    { accessTokenExpires: now + 1000, refreshToken: 'server-refresh' },
    { accessTokenExpires: now - 1000 },
  ])('does not refresh an unexpired token or one without a refresh token', async token => {
    expect(await config.callbacks!.jwt!({ token, user: { id: 'user-id' } })).toBe(token);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['rotated-refresh', undefined])('refreshes expired access tokens, retaining refresh token when omitted', async refreshToken => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'new-access', expires_in: 600, refresh_token: refreshToken }),
    });
    const token: JWT = { sub: 'user-id', accessTokenExpires: now, refreshToken: 'old-refresh' };
    expect(await config.callbacks!.jwt!({ token, user: { id: 'user-id' } })).toEqual({
      ...token, accessToken: 'new-access', accessTokenExpires: now + 600_000,
      refreshToken: refreshToken ?? 'old-refresh',
    });
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://tenant-name.ciamlogin.com/tenant-id/oauth2/v2.0/token');
    expect(request.method).toBe('POST');
    expect(request.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
    expect(Object.fromEntries(request.body)).toEqual({
      client_id: 'client-id', client_secret: 'test-client-secret',
      grant_type: 'refresh_token', refresh_token: 'old-refresh',
    });
  });

  it('reports refresh failure without exposing tokens to the browser session', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'invalid_grant' }) });
    const token = await config.callbacks!.jwt!({
      token: { sub: 'user-id', name: 'Test User', email: 'user@example.test',
        accessToken: 'server-access', refreshToken: 'server-refresh', accessTokenExpires: now },
      user: { id: 'user-id' },
    });
    expect(token?.error).toBe('RefreshAccessTokenError');
    const session = await config.callbacks!.session!({
      session: { user: { id: 'user-id' }, expires: '2030-01-01T00:00:00Z' }, token,
    } as Parameters<NonNullable<NonNullable<NextAuthConfig['callbacks']>['session']>>[0]);
    expect(session).toEqual({
      user: { id: 'user-id', name: 'Test User', email: 'user@example.test' },
      expires: '2030-01-01T00:00:00Z', error: 'RefreshAccessTokenError',
    });
  });

  it.each([
    ['', '/dashboard', '/dashboard'],
    ['/my-app/', '/', 'https://app.example.test/my-app'],
    ['/my-app', '/dashboard', 'https://app.example.test/my-app/dashboard'],
    ['/my-app', 'https://app.example.test/dashboard', 'https://app.example.test/my-app/dashboard'],
    ['/my-app', 'https://app.example.test/my-app/dashboard', 'https://app.example.test/my-app/dashboard'],
    ['/my-app', 'https://outside.example.test/', 'https://app.example.test/my-app'],
  ])('preserves redirects for base path %s and URL %s', async (basePath, url, expected) => {
    process.env.APP_BASE_PATH = basePath;
    expect(await config.callbacks!.redirect!({ url, baseUrl: 'https://app.example.test' })).toBe(expected);
  });
});
