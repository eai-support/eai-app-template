import { isOperationalRowsResponse } from './operational-bridge';

const digest = `sha256:${'a'.repeat(64)}`;
const fields = ['name', 'mileage'];
const base = {
  schemaVersion: 'eai.generated_app_operational_rows.v1',
  acceptedArtifactDigest: digest,
  fixtureCollection: 'vehicles',
};
const rows = [{ id: 'vehicle-1', name: 'Car A', mileage: 123 }];

describe('trusted operational row projection', () => {
  it('accepts only exact reviewed scalar fields, digest, collection and row bound', () => {
    expect(isOperationalRowsResponse({ ...base, rows }, digest, 'vehicles', 1, fields)).toBe(true);
    expect(isOperationalRowsResponse({ ...base, rows }, digest, 'other', 1, fields)).toBe(false);
    expect(isOperationalRowsResponse({ ...base, rows }, digest, 'vehicles', 0, fields)).toBe(false);
    expect(isOperationalRowsResponse({ ...base, rows }, 'sha256:wrong', 'vehicles', 1, fields)).toBe(false);
  });

  it('rejects unreviewed, credential-like, structured and oversized fields', () => {
    for (const badRows of [
      [{ ...rows[0], accessToken: 'bad' }],
      [{ ...rows[0], imageUrl: 'https://example.com' }],
      [{ ...rows[0], name: { nested: 'bad' } }],
      [{ ...rows[0], name: 'x'.repeat(513) }],
      [{ ...rows[0], id: '' }],
    ]) {
      expect(isOperationalRowsResponse({ ...base, rows: badRows }, digest, 'vehicles', 1, fields)).toBe(false);
    }
    expect(isOperationalRowsResponse({ ...base, rows }, digest, 'vehicles', 1, ['name', 'privateToken']))
      .toBe(false);
    expect(isOperationalRowsResponse({ ...base, rows }, digest, 'vehicles', 1, ['name', 'name']))
      .toBe(false);
    expect(isOperationalRowsResponse({ ...base, rows }, digest, 'vehicles', 1, ['constructor']))
      .toBe(false);
    for (const field of ['ID', 'privateNote', 'customerSSN', 'callbackUrl', 'apiKey']) {
      expect(isOperationalRowsResponse({ ...base, rows }, digest, 'vehicles', 1, [field]))
        .toBe(false);
    }
    expect(isOperationalRowsResponse({ ...base, rows: [rows[0], rows[0]] }, digest, 'vehicles', 2, fields))
      .toBe(false);
  });
});
