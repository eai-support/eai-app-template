/** Missing auth must not prevent a build or anonymous app use. Check only when sign-in is requested. */
const REQUIRED_SIGNIN_SETTINGS = [
  'ENTRA_TENANT_NAME',
  'ENTRA_TENANT_ID',
  'ENTRA_CLIENT_ID',
  'ENTRA_CLIENT_SECRET',
  'AUTH_SECRET',
] as const;

export const AUTH_SETUP_REQUIRED = 'AUTH_SETUP_REQUIRED';
export const AUTH_SETUP_GUIDANCE =
  'App sign-in is not configured. Run eai provision entra in this app project, then restart the app.';

export function missingSigninSettings(env: Readonly<Record<string, string | undefined>>): string[] {
  return REQUIRED_SIGNIN_SETTINGS.filter((name) => {
    const value = env[name]?.trim();
    return (
      !value ||
      /^(?:placeholder|empty|changeme|<[^>]*>|your[-_].*)$/i.test(value)
    );
  });
}
