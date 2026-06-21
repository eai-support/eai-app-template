interface ServiceIdentityConfig {
  clientId: string;
  clientSecret: string;
  tenantName: string;
  tenantPath: string;
  targetScope: string;
}

interface TokenResponse {
  access_token?: unknown;
  expires_in?: unknown;
}

let cachedToken: string | null = null;
let tokenExpiry = 0;
let cachedConfigKey: string | null = null;

const OIDC_SCOPES = new Set(['openid', 'profile', 'email', 'offline_access']);

function readFirstEnv(names: readonly string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return '';
}

function extractTargetScope(scopes: string, fallbackClientId: string): string {
  const apiScope = scopes
    .split(/\s+/)
    .map((scope) => scope.trim())
    .find(
      (scope) =>
        scope &&
        !OIDC_SCOPES.has(scope) &&
        (scope.startsWith('api://') || scope.includes('/.default')),
    );

  return apiScope || `api://${fallbackClientId}/.default`;
}

export function resolveServiceIdentityConfig(): ServiceIdentityConfig {
  const clientId = readFirstEnv([
    'EAI_SERVICE_CLIENT_ID',
    'OBO_CLIENT_ID',
    'ENTRA_CLIENT_ID',
  ]);
  const clientSecret = readFirstEnv([
    'EAI_SERVICE_CLIENT_SECRET',
    'OBO_CLIENT_SECRET',
    'ENTRA_CLIENT_SECRET',
  ]);
  const tenantName = readFirstEnv([
    'EAI_SERVICE_TENANT_NAME',
    'OBO_TENANT_NAME',
    'ENTRA_TENANT_NAME',
  ]);
  const tenantPath =
    readFirstEnv(['EAI_SERVICE_TENANT_ID', 'OBO_TENANT_ID', 'ENTRA_TENANT_ID']) ||
    tenantName;
  const targetScope =
    readFirstEnv(['EAI_SERVICE_TARGET_SCOPE', 'OBO_TARGET_SCOPE']) ||
    extractTargetScope(process.env.ENTRA_SCOPES || '', clientId);

  if (!clientId || !clientSecret || !tenantName || !tenantPath) {
    throw new Error(
      'Missing service identity configuration. Set EAI_SERVICE_CLIENT_ID, EAI_SERVICE_CLIENT_SECRET, EAI_SERVICE_TARGET_SCOPE, and EAI_SERVICE_TENANT_NAME, or provide the documented legacy aliases.',
    );
  }

  return {
    clientId,
    clientSecret,
    tenantName,
    tenantPath,
    targetScope,
  };
}

function buildConfigKey(config: ServiceIdentityConfig): string {
  return [
    config.clientId,
    config.tenantName,
    config.tenantPath,
    config.targetScope,
  ].join('|');
}

function createTimeoutSignal(timeoutMs: number): AbortSignal | undefined {
  if (
    typeof AbortSignal === 'undefined' ||
    typeof AbortSignal.timeout !== 'function'
  ) {
    return undefined;
  }

  return AbortSignal.timeout(timeoutMs);
}

export async function getServiceAccessToken(): Promise<string> {
  const config = resolveServiceIdentityConfig();
  const configKey = buildConfigKey(config);
  if (cachedToken && cachedConfigKey === configKey && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const timeoutSignal = createTimeoutSignal(10_000);
  const response = await fetch(
    `https://${config.tenantName}.ciamlogin.com/${config.tenantPath}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'client_credentials',
        scope: config.targetScope,
      }),
      ...(timeoutSignal ? { signal: timeoutSignal } : {}),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to get service identity token: ${response.status}`);
  }

  const data = (await response.json()) as TokenResponse;
  if (typeof data.access_token !== 'string' || !data.access_token) {
    throw new Error('Service identity token response did not include an access token');
  }

  cachedToken = data.access_token;
  cachedConfigKey = configKey;
  const expiresIn =
    typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
      ? data.expires_in
      : 3600;
  tokenExpiry = Date.now() + Math.max(expiresIn - 60, 60) * 1000;

  return cachedToken;
}

export function clearServiceAccessTokenCache(): void {
  cachedToken = null;
  cachedConfigKey = null;
  tokenExpiry = 0;
}
