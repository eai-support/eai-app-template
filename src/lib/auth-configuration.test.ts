import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { missingSigninSettings } from './auth-configuration';

const configured = {
  ENTRA_TENANT_NAME: 'example-ciam',
  ENTRA_TENANT_ID: 'directory-id',
  ENTRA_CLIENT_ID: 'app-client-id',
  ENTRA_CLIENT_SECRET: 'private-secret',
  AUTH_SECRET: 'private-auth-secret',
};

describe('sign-in configuration', () => {
  it.each([
    '',
    '  ',
    'placeholder',
    '<client-id>',
    'changeme',
    'your-client-id',
  ])('rejects a missing or placeholder setting %j', (value) => {
    expect(
      missingSigninSettings({ ...configured, ENTRA_CLIENT_ID: value }),
    ).toEqual(['ENTRA_CLIENT_ID']);
  });

  it('allows configured sign-in at the host root without an AUTH_URL override', () => {
    expect(missingSigninSettings(configured)).toEqual([]);
  });

  it.each([
    undefined,
    '',
    'placeholder',
    '<auth-url>',
    'your-auth-url',
    'not a URL',
    'https://app.example.test',
    'https://app.example.test/api/auth',
    'https://app.example.test/another-app/api/auth',
    'file:///my-app/api/auth',
  ])('requires a usable AUTH_URL for a non-root mount: %j', (AUTH_URL) => {
    expect(
      missingSigninSettings({
        ...configured,
        APP_BASE_PATH: '/my-app/',
        AUTH_URL,
      }),
    ).toEqual(['AUTH_URL']);
  });

  it('accepts the exact normalized auth path for a non-root mount', () => {
    expect(
      missingSigninSettings({
        ...configured,
        APP_BASE_PATH: '/my-app/',
        AUTH_URL: 'https://app.example.test/my-app/api/auth',
      }),
    ).toEqual([]);
  });

  it('guards the real Auth.js parser mismatch when the auth URL does not supply the mounted path', () => {
    // Run the installed ESM parser in Node; Jest's mocked route handlers must
    // not conceal the failure at the actual Auth.js boundary.
    const parser = pathToFileURL(
      join(dirname(require.resolve('@auth/core')), 'lib/utils/web.js'),
    ).href;
    const result = JSON.parse(
      execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `
      import { parseActionAndProviderId } from ${JSON.stringify(parser)};
      const result = {};
      for (const base of ['/api/auth', '/my-app/api/auth']) {
        try { result[base] = parseActionAndProviderId('/my-app/api/auth/signin/microsoft-entra-id', base); }
        catch (error) { result[base] = error.type; }
      }
      process.stdout.write(JSON.stringify(result));
    `,
        ],
        { encoding: 'utf8' },
      ),
    );
    expect(result).toEqual({
      '/api/auth': 'UnknownAction',
      '/my-app/api/auth': {
        action: 'signin',
        providerId: 'microsoft-entra-id',
      },
    });
    expect(
      missingSigninSettings({ ...configured, APP_BASE_PATH: '/my-app' }),
    ).toEqual(['AUTH_URL']);
  });
});
