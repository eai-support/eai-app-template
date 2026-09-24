import { EAIPlatformClient } from '../src/client';

describe('EAIPlatformClient typed surface', () => {
  it('HP001 exposes the typed PublicAPI client modules', () => {
    const client = new EAIPlatformClient({ tenantId: 'test-tenant' });

    expect(client.resources).toBeDefined();
    expect(client.chat).toBeDefined();
    expect(client.documents).toBeDefined();
    expect(client.users).toBeDefined();
    expect(client.auth).toBeDefined();
    expect(client.platform).toBeDefined();
  });
});
