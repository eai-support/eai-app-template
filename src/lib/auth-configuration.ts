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

export function missingSigninSettings(
  env: Readonly<Record<string, string | undefined>>,
): string[] {
  const missing: string[] = REQUIRED_SIGNIN_SETTINGS.filter((name) => {
    const value = env[name]?.trim();
    return (
      !value ||
      /^(?:placeholder|empty|changeme|<[^>]*>|your[-_].*)$/i.test(value)
    );
  });
  const basePath = (env.APP_BASE_PATH ?? '').replace(/\/+$/, '');
  if (basePath) {
    // The route restores this prefix before Auth.js parses the action. Auth.js
    // derives its basePath from AUTH_URL, otherwise it defaults to /api/auth.
    try {
      const authUrl = new URL(env.AUTH_URL ?? '');
      if (
        !['http:', 'https:'].includes(authUrl.protocol) ||
        authUrl.pathname !== `${basePath}/api/auth`
      )
        missing.push('AUTH_URL');
    } catch {
      missing.push('AUTH_URL');
    }
  }
  return missing;
}
