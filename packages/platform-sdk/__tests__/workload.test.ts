import {
  InMemoryReplayStore,
  signWorkloadCallback,
  verifyWorkloadCallback,
} from '../src/workload';

describe('installed application workload boundary', () => {
  it('accepts one short-lived installation-bound exact operation', () => {
    const store = new InMemoryReplayStore();
    const input = {
      installationId: 'installation-1', tenantId: 'tenant-a', appKey: 'testing-studio',
      operation: 'test.complete', idempotencyKey: 'receipt-001', issuedAt: 100, expiresAt: 200,
    };
    const signature = signWorkloadCallback(input, 'local-test-secret');
    expect(verifyWorkloadCallback(input, signature, {
      secret: 'local-test-secret', expectedInstallationId: 'installation-1',
      expectedTenantId: 'tenant-a', allowedOperations: ['test.complete'], nowSeconds: 150,
      replayStore: store,
    })).toEqual({ auditReceipt: {
      schemaVersion: 'eai.application-audit-receipt.v1', installationId: 'installation-1',
      tenantId: 'tenant-a', appKey: 'testing-studio', operation: 'test.complete',
      idempotencyKey: 'receipt-001', outcome: 'accepted',
    }});
    expect(() => verifyWorkloadCallback(input, signature, {
      secret: 'local-test-secret', expectedInstallationId: 'installation-1',
      expectedTenantId: 'tenant-a', allowedOperations: ['test.complete'], nowSeconds: 150,
      replayStore: store,
    })).toThrow('workload_callback_replay');
  });

  it.each([
    ['wrong installation', { expectedInstallationId: 'installation-2' }],
    ['wrong tenant', { expectedTenantId: 'tenant-b' }],
    ['wrong operation', { allowedOperations: ['audit.write'] }],
    ['expired', { nowSeconds: 201 }],
  ])('rejects %s without a broad credential fallback', (_name, replacement) => {
    expect(() => verifyWorkloadCallback({
      installationId: 'installation-1', tenantId: 'tenant-a', appKey: 'testing-studio',
      operation: 'test.complete', idempotencyKey: 'receipt-001', issuedAt: 100, expiresAt: 200,
    }, 'sha256=invalid', {
      secret: 'local-test-secret', expectedInstallationId: 'installation-1',
      expectedTenantId: 'tenant-a', allowedOperations: ['test.complete'], nowSeconds: 150,
      replayStore: new InMemoryReplayStore(), ...replacement,
    })).toThrow();
  });
});
