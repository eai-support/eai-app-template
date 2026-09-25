import {
  AppAccessDeniedError,
  evaluateDelegatedAppAccess,
  redactAppAccessError,
  sealServerAccessToken,
  unsealServerAccessToken,
} from './app-access';

const active = {
  appKey: 'eai-app-template',
  installationId: 'installation-1',
  tenantId: 'tenant-a',
  status: 'ACTIVE' as const,
  region: 'AU',
  expiresAt: '2026-08-24T00:05:00Z',
  entitlementActive: true,
  membershipActive: true,
  assignmentActive: true,
  packageCapabilities: ['resource.read'],
  consentedCapabilities: ['resource.read'],
  assignedCapabilities: ['resource.read'],
  userCapabilities: ['resource.read'],
};

describe('delegated installed application access', () => {
  it('allows only the four-way capability intersection in buyer geography', () => {
    expect(
      evaluateDelegatedAppAccess(active, {
        tenantId: 'tenant-a',
        appKey: 'eai-app-template',
        capability: 'resource.read',
        now: new Date('2026-08-24T00:01:00Z'),
      }),
    ).toEqual({ installationId: 'installation-1', region: 'AU' });
  });

  it.each([
    ['entitlement', { entitlementActive: false }],
    ['membership', { membershipActive: false }],
    ['assignment', { assignmentActive: false }],
    ['consent', { consentedCapabilities: [] }],
    ['user rights', { userCapabilities: [] }],
    ['tenant substitution', { tenantId: 'tenant-b' }],
  ])('denies %s failure closed', (_name, replacement) => {
    expect(() =>
      evaluateDelegatedAppAccess({ ...active, ...replacement }, {
        tenantId: 'tenant-a',
        appKey: 'eai-app-template',
        capability: 'resource.read',
        now: new Date('2026-08-24T00:01:00Z'),
      }),
    ).toThrow(AppAccessDeniedError);
  });

  it('fails closed when durable installed context is missing after cache loss', () => {
    expect(() => evaluateDelegatedAppAccess(undefined, {
      tenantId: 'tenant-a', appKey: 'eai-app-template', capability: 'resource.read',
    })).toThrow('installed_app_context_unavailable');
  });

  it('redacts tokens, tenant identifiers and provider credentials', () => {
    expect(redactAppAccessError('Bearer abc tenant-a api_key=secret')).toBe(
      '[REDACTED]',
    );
  });

  it('keeps a short-lived delegated token encrypted in server session storage', () => {
    const key = Buffer.alloc(32, 7);
    const sealed = sealServerAccessToken('delegated-user-token', key);
    expect(sealed).not.toContain('delegated-user-token');
    expect(unsealServerAccessToken(sealed, key)).toBe('delegated-user-token');
  });
});
