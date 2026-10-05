/** @jest-environment node */
import { NextRequest } from 'next/server';
import { getAccessToken } from '@enterpriseaigroup/core/server';
import { createGeneratedOperationalRecord, OperationalCreateRejection } from '@/lib/generated-demo/operational-create';
import { getGeneratedOperationalRuntime } from '@/lib/generated-demo/operational-runtime';
import { POST } from './route';

jest.mock('@enterpriseaigroup/core/server', () => ({ getAccessToken: jest.fn() }));
jest.mock('@/lib/generated-demo/operational-runtime', () => ({ getGeneratedOperationalRuntime: jest.fn() }));
jest.mock('@/lib/generated-demo/operational-create', () => ({
  ...jest.requireActual('@/lib/generated-demo/operational-create'),
  createGeneratedOperationalRecord: jest.fn(),
}));

const tenantId = '11111111-1111-4111-8111-111111111111';
const key = '22222222-2222-4222-8222-222222222222';
const config = {
  schemaVersion: 'eai.generated_app_operational.v2', tenantId,
  appKey: 'fleet-demo', acceptedArtifactDigest: `sha256:${'a'.repeat(64)}`,
  readBindings: [{ fixtureCollection: 'vehicles', objectTypeSlug: 'vehicle', maxRows: 2 }],
  actionsMode: 'selected-create', createBinding: { objectTypeSlug: 'vehicle', fields: ['name'] },
};

function request(body: unknown, origin = 'https://fleet.example.test'): NextRequest {
  return new NextRequest('https://fleet.example.test/api/eai/generated-operational/create', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getGeneratedOperationalRuntime).mockReturnValue({ status: 'ready', config,
    projectedFields: ['name'], createFields: [{ name: 'name', type: 'text', required: true }] } as never);
  jest.mocked(getAccessToken).mockResolvedValue('user-obo-token');
  jest.mocked(createGeneratedOperationalRecord).mockResolvedValue({ id: key });
});

describe('trusted selected-create BFF', () => {
  it('denies a foreign origin, missing binding or missing actor before a write', async () => {
    expect((await POST(request({ idempotencyKey: key, data: { name: 'Car A' } }, 'https://evil.test'))).status).toBe(403);
    jest.mocked(getGeneratedOperationalRuntime).mockReturnValue({ status: 'unconfigured' });
    expect((await POST(request({ idempotencyKey: key, data: { name: 'Car A' } }))).status).toBe(503);
    jest.mocked(getGeneratedOperationalRuntime).mockReturnValue({ status: 'ready', config,
      projectedFields: ['name'], createFields: [{ name: 'name', type: 'text', required: true }] } as never);
    jest.mocked(getAccessToken).mockResolvedValue(null);
    expect((await POST(request({ idempotencyKey: key, data: { name: 'Car A' } }))).status).toBe(401);
    expect(createGeneratedOperationalRecord).not.toHaveBeenCalled();
  });

  it('rejects extra fields and invokes only exact reviewed user-OBO create', async () => {
    expect((await POST(request({ idempotencyKey: key, data: { name: 'Car A', secret: 'bad' } }))).status).toBe(400);
    expect(createGeneratedOperationalRecord).not.toHaveBeenCalled();
    const response = await POST(request({ idempotencyKey: key, data: { name: 'Car A' } }));
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ id: key });
    expect(createGeneratedOperationalRecord).toHaveBeenCalledWith(config,
      [{ name: 'name', type: 'text', required: true }],
      expect.objectContaining({ idempotencyKey: key, data: { name: 'Car A' } }),
      'user-obo-token', 'fleet.example.test');
  });

  it('does not expose provider details after an unverified write', async () => {
    jest.mocked(createGeneratedOperationalRecord).mockRejectedValue(new Error('tenant-and-secret-provider-details'));
    const response = await POST(request({ idempotencyKey: key, data: { name: 'Car A' } }));
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain('tenant-and-secret-provider-details');
  });

  it('preserves a safe shared-quota rejection without leaking provider details', async () => {
    jest.mocked(createGeneratedOperationalRecord).mockRejectedValue(new OperationalCreateRejection(429));
    const response = await POST(request({ idempotencyKey: key, data: { name: 'Car A' } }));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: 'CREATE_RATE_LIMITED' });
  });
});
