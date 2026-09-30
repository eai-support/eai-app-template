/** @jest-environment node */
import { resolvePublicApiBaseUrl } from '@/lib/platform/session-resolve';
import type { GeneratedOperationalCreateConfig, GeneratedOperationalCreateField } from './operational-contract';
import { createGeneratedOperationalRecord, OperationalCreateRejection, parseGeneratedOperationalCreateInput } from './operational-create';

jest.mock('@/lib/platform/session-resolve', () => ({ resolvePublicApiBaseUrl: jest.fn() }));

const tenantId = '11111111-1111-4111-8111-111111111111';
const resourceId = '22222222-2222-4222-8222-222222222222';
const operationId = '33333333-3333-4333-8333-333333333333';
const config: GeneratedOperationalCreateConfig = {
  schemaVersion: 'eai.generated_app_operational.v2', tenantId,
  appKey: 'fleet-demo', acceptedArtifactDigest: `sha256:${'a'.repeat(64)}`,
  readBindings: [{ fixtureCollection: 'vehicles', objectTypeSlug: 'vehicle', maxRows: 2 }],
  actionsMode: 'selected-create',
  createBinding: { objectTypeSlug: 'vehicle', fields: ['name', 'mileage'] },
};
const fields: GeneratedOperationalCreateField[] = [
  { name: 'name', type: 'text', required: true },
  { name: 'mileage', type: 'number', required: false },
];
const originalFetch = global.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(resolvePublicApiBaseUrl).mockResolvedValue({
    baseUrl: 'https://public-api.example.test/',
    routing: { status: 'resolved', userId: 'actor-1', product: 'fleet-demo',
      activeTenantId: tenantId, productAllowed: true, routingMode: 'in_place' },
  });
});
afterEach(() => { global.fetch = originalFetch; });

describe('selected operational create', () => {
  it('rejects unreviewed fields and malformed scalar values before PublicAPI', () => {
    for (const body of [
      { idempotencyKey: operationId, data: { name: 'Car A', token: 'stolen' } },
      { idempotencyKey: operationId, data: { mileage: 1 } },
      { idempotencyKey: operationId, data: { name: { nested: true } } },
      { idempotencyKey: operationId, data: { name: 'Car A' }, endpoint: 'https://elsewhere.test' },
    ]) expect(() => parseGeneratedOperationalCreateInput(body, fields)).toThrow();
  });

  it('uses only the fixed source-verified PublicAPI route with actor OBO', async () => {
    const input = parseGeneratedOperationalCreateInput({
      idempotencyKey: operationId, data: { name: 'Car A', mileage: 12 },
    }, fields);
    global.fetch = jest.fn().mockResolvedValue(Response.json({ id: resourceId,
      data: { name: 'Car A', mileage: 12 } }, { status: 201 }));
    await expect(createGeneratedOperationalRecord(config, fields, input, 'user-obo-token', 'fleet.example.test'))
      .resolves.toEqual({ id: resourceId });
    const [writeUrl, writeOptions] = jest.mocked(global.fetch).mock.calls[0];
    expect(String(writeUrl)).toBe(`https://public-api.example.test/v4/platform/tenants/${tenantId}/apps/fleet-demo/generated-operational/create`);
    expect(writeOptions).toMatchObject({ method: 'POST', cache: 'no-store',
      headers: expect.objectContaining({ Authorization: 'Bearer user-obo-token', tenant: tenantId }) });
    expect(JSON.parse(String(writeOptions?.body))).toEqual({ data: input.data, idempotencyKey: operationId });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('fails before a write if session routing resolves another tenant', async () => {
    jest.mocked(resolvePublicApiBaseUrl).mockResolvedValue({
      baseUrl: 'https://public-api.example.test/',
      routing: { status: 'resolved', userId: 'actor-1', product: 'fleet-demo',
        activeTenantId: '44444444-4444-4444-8444-444444444444',
        productAllowed: true, routingMode: 'in_place' },
    });
    global.fetch = jest.fn();
    const input = parseGeneratedOperationalCreateInput({ idempotencyKey: operationId,
      data: { name: 'Car A' } }, fields);
    await expect(createGeneratedOperationalRecord(config, fields, input, 'user-obo-token', 'fleet.example.test'))
      .rejects.toThrow('not bound');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('does not report success if PublicAPI denies or its verified receipt disagrees', async () => {
    const input = parseGeneratedOperationalCreateInput({ idempotencyKey: operationId,
      data: { name: 'Car A' } }, fields);
    global.fetch = jest.fn().mockResolvedValue(Response.json({ error: 'denied' }, { status: 403 }));
    await expect(createGeneratedOperationalRecord(config, fields, input, 'user-obo-token', 'fleet.example.test'))
      .rejects.toBeInstanceOf(OperationalCreateRejection);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    global.fetch = jest.fn().mockResolvedValue(Response.json({ id: resourceId,
      data: { name: 'Different' } }, { status: 201 }));
    await expect(createGeneratedOperationalRecord(config, fields, input, 'user-obo-token', 'fleet.example.test'))
      .rejects.toThrow('receipt did not match');
  });
});
