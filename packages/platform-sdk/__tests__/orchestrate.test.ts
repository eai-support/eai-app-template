import { EAIPlatformClient } from '../src/client';

describe('orchestrate module retirement', () => {
  it('BP001 does not expose the legacy generic orchestrate proxy', () => {
    const client = new EAIPlatformClient({ tenantId: 'test-tenant' });

    expect('orchestrate' in client).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(client, 'orchestrate')).toBe(
      false,
    );
  });
});
