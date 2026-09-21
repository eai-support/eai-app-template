/** Server-only bearer-token seam used by ACA managed identity and local tests. */
export type GeneratedWorkflowTokenProvider = (
  audience: string,
) => Promise<string>;

interface CachedAccessToken {
  audience: string;
  clientId?: string;
  token: string;
  expiresAtMs: number;
}

interface PendingAccessToken {
  audience: string;
  clientId?: string;
  promise: Promise<string>;
}

let cachedAccessToken: CachedAccessToken | null = null;
let pendingAccessToken: PendingAccessToken | null = null;
let tokenProviderOverride: GeneratedWorkflowTokenProvider | null = null;

/** Keeps platform connectivity failures distinct from malformed client input. */
export class GeneratedWorkflowPlatformUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super('Generated workflow platform is unavailable.', options);
    this.name = 'GeneratedWorkflowPlatformUnavailableError';
  }
}

function publicApiBaseUrl(): string {
  const value =
    process.env.EAI_PLATFORM_API_BASE_URL?.trim() ||
    process.env.BASE_URL_PUBLIC_API?.trim();
  if (!value) {
    throw new Error('Generated workflow PublicAPI base URL is not configured.');
  }
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Generated workflow PublicAPI base URL is invalid.');
  }
  return url.toString().replace(/\/+$/, '');
}

function runtimeAudience(): string {
  const value = process.env.EAI_PLATFORM_TOKEN_AUDIENCE?.trim();
  if (!value) {
    throw new Error(
      'Generated workflow managed-identity audience is not configured.',
    );
  }
  return value;
}

function managedIdentityEndpoint(): URL {
  const endpoint = process.env.IDENTITY_ENDPOINT?.trim();
  if (!endpoint) {
    throw new Error('Azure Container Apps managed identity is unavailable.');
  }
  const url = new URL(endpoint);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(
      'Azure Container Apps managed identity endpoint is invalid.',
    );
  }
  return url;
}

async function containerAppsManagedIdentityToken(
  audience: string,
): Promise<string> {
  const clientId = process.env.AZURE_CLIENT_ID?.trim() || undefined;
  const now = Date.now();
  if (
    cachedAccessToken &&
    cachedAccessToken.audience === audience &&
    cachedAccessToken.clientId === clientId &&
    cachedAccessToken.expiresAtMs - now > 60_000
  ) {
    return cachedAccessToken.token;
  }

  if (
    pendingAccessToken?.audience === audience &&
    pendingAccessToken.clientId === clientId
  ) {
    return pendingAccessToken.promise;
  }

  const promise = requestContainerAppsManagedIdentityToken(
    audience,
    clientId,
    now,
  );
  pendingAccessToken = { audience, clientId, promise };
  try {
    return await promise;
  } finally {
    if (pendingAccessToken?.promise === promise) pendingAccessToken = null;
  }
}

async function requestContainerAppsManagedIdentityToken(
  audience: string,
  clientId: string | undefined,
  now: number,
): Promise<string> {
  const identityHeader = process.env.IDENTITY_HEADER?.trim();
  if (!identityHeader) {
    throw new Error(
      'Azure Container Apps managed identity header is unavailable.',
    );
  }
  const endpoint = managedIdentityEndpoint();
  endpoint.searchParams.set('api-version', '2019-08-01');
  endpoint.searchParams.set('resource', audience);
  if (clientId) endpoint.searchParams.set('client_id', clientId);

  const response = await fetch(endpoint, {
    headers: { 'X-IDENTITY-HEADER': identityHeader },
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(
      `Azure Container Apps managed identity token request failed (${response.status}).`,
    );
  }
  const payload = (await response.json()) as {
    access_token?: unknown;
    expires_on?: unknown;
  };
  if (typeof payload.access_token !== 'string' || !payload.access_token) {
    throw new Error(
      'Azure Container Apps managed identity returned no access token.',
    );
  }
  const expiresAtSeconds = Number(payload.expires_on);
  cachedAccessToken = {
    audience,
    clientId,
    token: payload.access_token,
    expiresAtMs: Number.isFinite(expiresAtSeconds)
      ? expiresAtSeconds * 1000
      : now + 5 * 60_000,
  };
  return payload.access_token;
}

async function accessToken(): Promise<string> {
  const audience = runtimeAudience();
  return tokenProviderOverride
    ? tokenProviderOverride(audience)
    : containerAppsManagedIdentityToken(audience);
}

function abortReason(signal: AbortSignal): unknown {
  return (
    signal.reason ??
    new DOMException(
      'Generated workflow platform request aborted.',
      'AbortError',
    )
  );
}

async function awaitWithSignal<T>(
  promise: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) throw abortReason(signal);
  return new Promise<T>((resolve, reject) => {
    const aborted = () => {
      cleanup();
      reject(abortReason(signal));
    };
    const cleanup = () => signal.removeEventListener('abort', aborted);
    signal.addEventListener('abort', aborted, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
  });
}

function runtimeFacadePath(
  tenantId: string,
  appKey: string,
  suffix: string,
): string {
  const base = `/v4/generated-app-runtime/tenants/${encodeURIComponent(
    tenantId,
  )}/apps/${encodeURIComponent(appKey)}`;
  return `${base}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}

/** Calls the generated-runtime facade with the ACA user-assigned managed identity. */
export async function generatedWorkflowPlatformFetch(args: {
  tenantId: string;
  appKey: string;
  path: string;
  anonymousClientId?: string;
  init?: RequestInit;
}): Promise<Response> {
  try {
    const deadlineSignal = args.init?.signal
      ? AbortSignal.any([args.init.signal, AbortSignal.timeout(60_000)])
      : AbortSignal.timeout(60_000);
    const headers = new Headers(args.init?.headers);
    const isBinary = args.init?.body instanceof ArrayBuffer;
    if (
      !isBinary &&
      !(args.init?.body instanceof FormData) &&
      !headers.has('Content-Type')
    ) {
      headers.set('Content-Type', 'application/json');
    }
    headers.set(
      'Authorization',
      `Bearer ${await awaitWithSignal(accessToken(), deadlineSignal)}`,
    );
    if (args.anonymousClientId) {
      headers.set('X-EAI-Anonymous-Client', args.anonymousClientId);
    }

    return await fetch(
      `${publicApiBaseUrl()}${runtimeFacadePath(
        args.tenantId,
        args.appKey,
        args.path,
      )}`,
      {
        ...args.init,
        headers,
        // Keep one deadline active through identity acquisition and body consumption.
        signal: deadlineSignal,
        cache: 'no-store',
      },
    );
  } catch (error) {
    throw new GeneratedWorkflowPlatformUnavailableError({ cause: error });
  }
}

export function __setGeneratedWorkflowTokenProviderForTests(
  provider: GeneratedWorkflowTokenProvider | null,
): void {
  tokenProviderOverride = provider;
  cachedAccessToken = null;
  pendingAccessToken = null;
}
