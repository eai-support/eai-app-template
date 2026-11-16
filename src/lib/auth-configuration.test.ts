import { missingSigninSettings } from './auth-configuration';

const configured = {
  ENTRA_TENANT_NAME: 'example-ciam',
  ENTRA_TENANT_ID: 'directory-id',
  ENTRA_CLIENT_ID: 'app-client-id',
  ENTRA_CLIENT_SECRET: 'private-secret',
  AUTH_SECRET: 'private-auth-secret',
};

describe('sign-in configuration', () => {
  it.each(['', '  ', 'placeholder', '<client-id>', 'changeme', 'your-client-id'])(
    'rejects a missing or placeholder setting %j',
    (value) => {
      expect(
        missingSigninSettings({ ...configured, ENTRA_CLIENT_ID: value }),
      ).toEqual(['ENTRA_CLIENT_ID']);
    },
  );

  it('allows configured sign-in at the host root without an AUTH_URL override', () => {
    expect(missingSigninSettings(configured)).toEqual([]);
  });
});
