import { isOperationalAckMessage, isOperationalDataMessage, isOperationalReadyMessage, isOperationalRowsResponse } from './operational-bridge';

const nonce = '11111111-1111-4111-8111-111111111111';
const digest = `sha256:${'a'.repeat(64)}`;
const rows = [{ id: 'vehicle-1', name: 'Car A' }];

describe('opaque-frame operational messages', () => {
  it('accepts only the current nonce, accepted digest and reviewed collection', () => {
    const ready = { type: 'eai.generated.operational.ready.v1', nonce,
      acceptedArtifactDigest: digest };
    expect(isOperationalReadyMessage(ready, nonce, digest)).toBe(true);
    expect(isOperationalReadyMessage({ ...ready, token: 'bad' }, nonce, digest)).toBe(false);
    expect(isOperationalReadyMessage(ready, '22222222-2222-4222-8222-222222222222', digest)).toBe(false);
    const ack = { type: 'eai.generated.operational.ack.v1', nonce,
      acceptedArtifactDigest: digest };
    expect(isOperationalAckMessage(ack, nonce, digest)).toBe(true);
    expect(isOperationalAckMessage({ ...ack, url: 'https://example.com' }, nonce, digest)).toBe(false);
    const data = { type: 'eai.generated.operational.data.v1', nonce,
      acceptedArtifactDigest: digest, fixtureCollection: 'vehicles', rows };
    expect(isOperationalDataMessage(data, nonce, digest, 'vehicles', 1)).toBe(true);
    expect(isOperationalDataMessage(data, nonce, digest, 'other', 1)).toBe(false);
    expect(isOperationalDataMessage(data, nonce, digest, 'vehicles', 0)).toBe(false);
  });

  it('rejects credential, URL and oversized data fields without sample fallback', () => {
    const base = { schemaVersion: 'eai.generated_app_operational_rows.v1',
      acceptedArtifactDigest: digest, fixtureCollection: 'vehicles' };
    expect(isOperationalRowsResponse({ ...base, rows }, digest, 'vehicles', 1)).toBe(true);
    expect(isOperationalRowsResponse({ ...base, rows: [{ ...rows[0], accessToken: 'bad' }] }, digest, 'vehicles', 1)).toBe(false);
    expect(isOperationalRowsResponse({ ...base, rows: [{ ...rows[0], imageUrl: 'https://example.com' }] }, digest, 'vehicles', 1)).toBe(false);
    expect(isOperationalRowsResponse({ ...base, rows: [{ ...rows[0], name: 'x'.repeat(130_000) }] }, digest, 'vehicles', 1)).toBe(false);
  });
});
