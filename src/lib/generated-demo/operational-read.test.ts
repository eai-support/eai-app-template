/** @jest-environment node */
import { resolvePublicApiBaseUrl } from '@/lib/platform/session-resolve';
import type { GeneratedOperationalConfig } from './operational-contract';
import { readGeneratedOperationalRows } from './operational-read';

jest.mock('@/lib/platform/session-resolve', () => ({
  resolvePublicApiBaseUrl: jest.fn(),
}));

const tenantId = '11111111-1111-4111-8111-111111111111';
const config: GeneratedOperationalConfig = {
  schemaVersion: 'eai.generated_app_operational.v1',
  tenantId,
  appKey: 'fleet-demo',
  acceptedArtifactDigest: `sha256:${'a'.repeat(64)}`,
  readBindings: [{ fixtureCollection: 'vehicles', objectTypeSlug: 'vehicle', maxRows: 2 }],
  actionsMode: 'simulated',
};
const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(resolvePublicApiBaseUrl).mockResolvedValue({
    baseUrl: 'https://public-api.example.test/',
    routing: {
      status: 'resolved', userId: 'actor-1', product: 'fleet-demo',
      activeTenantId: tenantId, productAllowed: true, routingMode: 'in_place',
    },
  });
});
afterEach(() => { global.fetch = originalFetch; });

describe('user-delegated operational read', () => {
  it('uses only the reviewed tenant/type/limit and projects bounded data without credentials', async () => {
    global.fetch = jest.fn().mockResolvedValue(Response.json({
      docs: [{ id: 'vehicle-1', data: { name: 'Car A' } }], nextCursor: null,
    }));
    const rows = await readGeneratedOperationalRows(config, 'user-obo-token', 'fleet.example.test');
    expect(resolvePublicApiBaseUrl).toHaveBeenCalledWith(expect.objectContaining({
      accessToken: 'user-obo-token', product: 'fleet-demo', requestedTenantId: tenantId,
    }));
    const [target, options] = jest.mocked(global.fetch).mock.calls[0];
    expect(String(target)).toBe(`https://public-api.example.test/v4/data/resources/${tenantId}/vehicle?limit=2&includeTotal=false`);
    expect(options).toMatchObject({
      method: 'GET', cache: 'no-store',
      headers: expect.objectContaining({ Authorization: 'Bearer user-obo-token', tenant: tenantId }),
    });
    expect(rows).toEqual({
      schemaVersion: 'eai.generated_app_operational_rows.v1',
      acceptedArtifactDigest: config.acceptedArtifactDigest,
      fixtureCollection: 'vehicles',
      rows: [{ id: 'vehicle-1', name: 'Car A' }],
    });
    expect(JSON.stringify(rows)).not.toContain('user-obo-token');
  });

  it('denies a different active tenant before any resource fetch', async () => {
    jest.mocked(resolvePublicApiBaseUrl).mockResolvedValue({
      baseUrl: 'https://public-api.example.test/',
      routing: {
        status: 'resolved', userId: 'actor-1', product: 'fleet-demo',
        activeTenantId: '22222222-2222-4222-8222-222222222222',
        productAllowed: true, routingMode: 'in_place',
      },
    });
    global.fetch = jest.fn();
    await expect(readGeneratedOperationalRows(config, 'user-obo-token', 'fleet.example.test'))
      .rejects.toThrow('not bound');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects excess rows, secret fields and upstream failures without using demo samples', async () => {
    for (const response of [
      Response.json({ docs: [1, 2, 3].map((id) => ({ id: String(id), data: {} })) }),
      Response.json({ docs: [{ id: 'one', data: { apiToken: 'secret' } }] }),
      Response.json({ error: 'denied' }, { status: 403 }),
    ]) {
      global.fetch = jest.fn().mockResolvedValue(response);
      await expect(readGeneratedOperationalRows(config, 'user-obo-token', 'fleet.example.test'))
        .rejects.toThrow();
    }
  });
});
