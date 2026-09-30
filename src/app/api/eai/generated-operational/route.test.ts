/** @jest-environment node */
import { NextRequest } from 'next/server';
import { getAccessToken } from '@enterpriseaigroup/core/server';
import { getGeneratedOperationalRuntime } from '@/lib/generated-demo/operational-runtime';
import { readGeneratedOperationalRows } from '@/lib/generated-demo/operational-read';
import { GET } from './route';

jest.mock('@enterpriseaigroup/core/server', () => ({ getAccessToken: jest.fn() }));
jest.mock('@/lib/generated-demo/operational-runtime', () => ({
  getGeneratedOperationalRuntime: jest.fn(),
}));
jest.mock('@/lib/generated-demo/operational-read', () => ({
  readGeneratedOperationalRows: jest.fn(),
}));

const tenantId = '11111111-1111-4111-8111-111111111111';
const config = {
  schemaVersion: 'eai.generated_app_operational.v1', tenantId,
  appKey: 'fleet-demo', acceptedArtifactDigest: `sha256:${'a'.repeat(64)}`,
  readBindings: [{ fixtureCollection: 'vehicles', objectTypeSlug: 'vehicle', maxRows: 2 }],
  actionsMode: 'simulated',
};
const request = new NextRequest('https://fleet.example.test/api/eai/generated-operational');

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getGeneratedOperationalRuntime).mockReturnValue({ status: 'ready', config } as never);
  jest.mocked(getAccessToken).mockResolvedValue('user-obo-token');
  jest.mocked(readGeneratedOperationalRows).mockResolvedValue({
    schemaVersion: 'eai.generated_app_operational_rows.v1',
    acceptedArtifactDigest: config.acceptedArtifactDigest,
    fixtureCollection: 'vehicles', rows: [{ id: 'vehicle-1', name: 'Car A' }],
  });
});

describe('generated operational read BFF', () => {
  it('requires a reviewed config before reading an identity token', async () => {
    jest.mocked(getGeneratedOperationalRuntime).mockReturnValue({ status: 'unconfigured' });
    const response = await GET(request);
    expect(response.status).toBe(503);
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(readGeneratedOperationalRows).not.toHaveBeenCalled();
  });

  it('denies anonymous callers without reaching PublicAPI', async () => {
    jest.mocked(getAccessToken).mockResolvedValue(null);
    const response = await GET(request);
    expect(response.status).toBe(401);
    expect(readGeneratedOperationalRows).not.toHaveBeenCalled();
  });

  it('returns only projected rows and no-store headers for user OBO', async () => {
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({
      fixtureCollection: 'vehicles', rows: [{ id: 'vehicle-1', name: 'Car A' }],
    });
    expect(readGeneratedOperationalRows).toHaveBeenCalledWith(config, 'user-obo-token', 'fleet.example.test');
  });

  it('does not expose provider or tenant errors to the browser', async () => {
    jest.mocked(readGeneratedOperationalRows).mockRejectedValue(new Error('tenant-secret-error'));
    const response = await GET(request);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('tenant-secret-error');
  });
});
