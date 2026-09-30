import type { GeneratedOperationalConfig } from './operational-contract';
import type { DemoJson } from './contract';
import { isOperationalRowsResponse } from './operational-bridge';
import {
  resolvePublicApiBaseUrl,
  type SessionResolveResponse,
} from '@/lib/platform/session-resolve';

export interface GeneratedOperationalRows {
  schemaVersion: 'eai.generated_app_operational_rows.v1';
  acceptedArtifactDigest: string;
  fixtureCollection: string;
  rows: Array<Record<string, DemoJson>>;
}

const MAX_RESPONSE_BYTES = 256_000;
const MAX_PROJECTED_BYTES = 120_000;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function boundedJson(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Resource read returned no body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new Error('Resource read exceeded byte limit');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks)));
}

function requireBoundRouting(
  routing: SessionResolveResponse | null,
  tenantId: string,
): void {
  if (
    routing?.status !== 'resolved' ||
    !routing.productAllowed ||
    routing.activeTenantId !== tenantId
  ) throw new Error('The active user is not bound to this app tenant');
}

/** User OBO and PublicAPI/ResourceAPI authorization remain authoritative for every read. */
export async function readGeneratedOperationalRows(
  config: GeneratedOperationalConfig,
  accessToken: string,
  currentAppHost: string,
): Promise<GeneratedOperationalRows> {
  const { baseUrl, routing } = await resolvePublicApiBaseUrl({
    accessToken,
    fallbackBaseUrl: process.env.BASE_URL_PUBLIC_API,
    product: config.appKey,
    currentAppHost,
    requestedTenantId: config.tenantId,
  });
  requireBoundRouting(routing, config.tenantId);
  const binding = config.readBindings[0];
  const url = new URL(
    `v4/data/resources/${encodeURIComponent(config.tenantId)}/${encodeURIComponent(binding.objectTypeSlug)}`,
    baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`,
  );
  url.searchParams.set('limit', String(binding.maxRows));
  url.searchParams.set('includeTotal', 'false');
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      tenant: config.tenantId,
      'X-Tenant-Id': config.tenantId,
      Accept: 'application/json',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Authorized resource read failed: ${response.status}`);
  const result = await boundedJson(response);
  if (!record(result) || !Array.isArray(result.docs) || result.docs.length > binding.maxRows)
    throw new Error('Resource read response is invalid');
  const rows = result.docs.map((item: unknown) => {
    if (!record(item) || !record(item.data) || typeof item.id !== 'string')
      throw new Error('Resource row is invalid');
    return { ...item.data, id: item.id };
  }) as Array<Record<string, DemoJson>>;
  if (Buffer.byteLength(JSON.stringify(rows), 'utf8') > MAX_PROJECTED_BYTES)
    throw new Error('Projected resource rows exceeded byte limit');
  const projection: GeneratedOperationalRows = {
    schemaVersion: 'eai.generated_app_operational_rows.v1',
    acceptedArtifactDigest: config.acceptedArtifactDigest,
    fixtureCollection: binding.fixtureCollection,
    rows,
  };
  if (!isOperationalRowsResponse(projection, config.acceptedArtifactDigest,
      binding.fixtureCollection, binding.maxRows))
    throw new Error('Resource rows contain unsupported fields or values');
  return projection;
}
