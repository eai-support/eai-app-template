import {
  publicApiRouteFamilyForPath,
  resolvePublicApiRoutePath,
} from './publicapi-route-family';

const originalEnv = process.env;

describe('publicApi route-family resolver', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('BP001 keeps v3 paths by default', () => {
    expect(resolvePublicApiRoutePath('v3/resources/tenant-a/Application')).toBe(
      'v3/resources/tenant-a/Application',
    );
  });

  it('HP001 maps enabled identity paths to the v4 identity section', () => {
    process.env.PUBLICAPI_V4_IDENTITY_ENABLED = 'true';

    expect(resolvePublicApiRoutePath('/v3/auth/me')).toBe('v4/identity/me');
    expect(resolvePublicApiRoutePath('v3/session/resolve')).toBe(
      'v4/identity/session/resolve',
    );
    expect(resolvePublicApiRoutePath('v3/users/me/tenants')).toBe(
      'v4/identity/tenants',
    );
    expect(resolvePublicApiRoutePath('v3/users/provisionme')).toBe(
      'v4/identity/me/provision',
    );
    expect(resolvePublicApiRoutePath('v3/users/me/profile')).toBe(
      'v4/identity/me/profile',
    );
    expect(resolvePublicApiRoutePath('v3/users/me/tenants/tenant-a')).toBe(
      'v4/identity/tenants/tenant-a/membership',
    );
  });

  it('HP002 maps enabled AI and document paths to their v4 sections', () => {
    process.env.PUBLICAPI_V4_AI_ENABLED = 'on';
    process.env.PUBLICAPI_V4_DATA_DOCUMENTS_ENABLED = '1';

    expect(resolvePublicApiRoutePath('v3/chat/tenant-a/wf/chat')).toBe(
      'v4/ai/chat/tenant-a/wf/chat',
    );
    expect(resolvePublicApiRoutePath('v3/documents/upload')).toBe(
      'v4/data/documents/upload',
    );
    expect(resolvePublicApiRoutePath('v3/document-templates')).toBe(
      'v4/data/documents/templates',
    );
  });

  it('HP003 maps enabled business-request workflow and alert paths', () => {
    process.env.PUBLICAPI_V4_WORKFLOWS_ENABLED = 'true';
    process.env.PUBLICAPI_V4_REALTIME_ENABLED = 'true';

    expect(
      resolvePublicApiRoutePath(
        'v3/business-requests/br-123/migrate-chat-history',
      ),
    ).toBe('v4/workflows/business-requests/br-123/migrate-chat-history');
    expect(resolvePublicApiRoutePath('v3/alerts')).toBe('v4/realtime/alerts');
  });

  it('BP002 leaves generic orchestrate on v3 compatibility', () => {
    process.env.PUBLICAPI_V4_PLATFORM_ENABLED = 'true';

    expect(publicApiRouteFamilyForPath('v3/orchestrate')).toBeNull();
    expect(resolvePublicApiRoutePath('v3/orchestrate')).toBe('v3/orchestrate');
    expect(resolvePublicApiRoutePath('v3/users/invite')).toBe(
      'v3/users/invite',
    );
  });
});
