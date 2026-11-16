/** @jest-environment node */
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({
  handlers: {
    GET: jest.fn(() => new Response('auth get')),
    POST: jest.fn(() => new Response('auth post')),
  },
}));

const originalEnv = process.env;
afterEach(() => {
  process.env = originalEnv;
  jest.resetModules();
});

describe.each(['', '/my-app'])('auth requests at base path %j', (basePath) => {
  beforeEach(() => {
    process.env = { ...originalEnv, APP_BASE_PATH: basePath };
    for (const name of [
      'ENTRA_TENANT_NAME',
      'ENTRA_TENANT_ID',
      'ENTRA_CLIENT_ID',
      'ENTRA_CLIENT_SECRET',
      'AUTH_SECRET',
      'AUTH_URL',
      'NEXTAUTH_URL',
    ]) {
      delete process.env[name];
    }
  });

  it('shows local setup guidance before any Entra redirect', async () => {
    const { GET, POST } = await import('./route');
    const { handlers } = await import('@/auth');
    const response = await GET(
      new NextRequest(
        'https://app.example.test/api/auth/signin/microsoft-entra-id',
      ),
    );
    expect(response.headers.get('location')).toBe(
      `https://app.example.test${basePath}/auth/error?error=AuthSetupRequired`,
    );
    const result = await POST(
      new NextRequest(
        'https://app.example.test/api/auth/signin/microsoft-entra-id',
        {
          method: 'POST',
          headers: { 'X-Auth-Return-Redirect': '1' },
        },
      ),
    );
    expect(result.status).toBe(503);
    expect(await result.json()).toMatchObject({
      error: 'AUTH_SETUP_REQUIRED',
      message: expect.stringContaining('eai provision entra'),
      url: `https://app.example.test${basePath}/auth/error?error=AuthSetupRequired`,
    });
    expect(handlers.GET).not.toHaveBeenCalled();
    expect(handlers.POST).not.toHaveBeenCalled();
  });

  it('keeps anonymous session reads available without auth configuration', async () => {
    const { GET } = await import('./route');
    const { handlers } = await import('@/auth');
    await GET(new NextRequest('https://app.example.test/api/auth/session'));
    expect(handlers.GET).toHaveBeenCalled();
  });

  it('passes configured sign-in to Auth.js with the original base path', async () => {
    Object.assign(process.env, {
      ENTRA_TENANT_NAME: 'directory',
      ENTRA_TENANT_ID: 'directory-id',
      ENTRA_CLIENT_ID: 'client-id',
      ENTRA_CLIENT_SECRET: 'private-credential',
      AUTH_SECRET: 'private-auth-secret',
      ...(basePath
        ? { AUTH_URL: `https://app.example.test${basePath}/api/auth` }
        : {}),
    });
    const { POST } = await import('./route');
    const { handlers } = await import('@/auth');
    await POST(
      new NextRequest(
        'https://app.example.test/api/auth/signin/microsoft-entra-id',
        { method: 'POST' },
      ),
    );
    expect(handlers.POST).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `https://app.example.test${basePath}/api/auth/signin/microsoft-entra-id`,
      }),
    );
  });

  if (basePath) {
    it.each([
      undefined,
      'placeholder',
      'not a URL',
      'https://app.example.test',
      'https://app.example.test/api/auth',
    ])(
      'keeps misconfigured non-root sign-in and callback requests local before Auth.js: %j',
      async (AUTH_URL) => {
        Object.assign(process.env, {
          ENTRA_TENANT_NAME: 'directory',
          ENTRA_TENANT_ID: 'directory-id',
          ENTRA_CLIENT_ID: 'client-id',
          ENTRA_CLIENT_SECRET: 'private-credential',
          AUTH_SECRET: 'private-auth-secret',
        });
        if (AUTH_URL !== undefined) process.env.AUTH_URL = AUTH_URL;
        const { GET, POST } = await import('./route');
        const { handlers } = await import('@/auth');
        const callback = await GET(
          new NextRequest(
            'https://app.example.test/api/auth/callback/microsoft-entra-id',
          ),
        );
        expect(callback.headers.get('location')).toBe(
          `https://app.example.test${basePath}/auth/error?error=AuthSetupRequired`,
        );
        const signin = await POST(
          new NextRequest(
            'https://app.example.test/api/auth/signin/microsoft-entra-id',
            { method: 'POST', headers: { 'X-Auth-Return-Redirect': '1' } },
          ),
        );
        expect(signin.status).toBe(503);
        expect(await signin.json()).toMatchObject({
          error: 'AUTH_SETUP_REQUIRED',
          message: expect.stringContaining('eai provision entra'),
        });
        expect(handlers.GET).not.toHaveBeenCalled();
        expect(handlers.POST).not.toHaveBeenCalled();
      },
    );
  }
});
