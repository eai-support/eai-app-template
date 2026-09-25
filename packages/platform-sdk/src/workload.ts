import { createHmac, timingSafeEqual } from 'node:crypto';

export interface WorkloadCallbackEnvelope {
  installationId: string;
  tenantId: string;
  appKey: string;
  operation: string;
  idempotencyKey: string;
  issuedAt: number;
  expiresAt: number;
}

export interface WorkloadReplayStore {
  consume(key: string): boolean;
}

export class InMemoryReplayStore implements WorkloadReplayStore {
  private readonly consumed = new Set<string>();

  consume(key: string): boolean {
    if (this.consumed.has(key)) return false;
    this.consumed.add(key);
    return true;
  }
}

function callbackBytes(value: WorkloadCallbackEnvelope): string {
  return JSON.stringify({
    appKey: value.appKey,
    expiresAt: value.expiresAt,
    idempotencyKey: value.idempotencyKey,
    installationId: value.installationId,
    issuedAt: value.issuedAt,
    operation: value.operation,
    tenantId: value.tenantId,
  });
}

export function signWorkloadCallback(
  value: WorkloadCallbackEnvelope,
  secret: string,
): `sha256=${string}` {
  return `sha256=${createHmac('sha256', secret).update(callbackBytes(value)).digest('hex')}`;
}

/** Verify a short-lived, installation-bound callback and issue one audit receipt. */
export function verifyWorkloadCallback(
  value: WorkloadCallbackEnvelope,
  signature: string,
  policy: {
    secret: string;
    expectedInstallationId: string;
    expectedTenantId: string;
    allowedOperations: readonly string[];
    nowSeconds: number;
    replayStore: WorkloadReplayStore;
  },
): {
  auditReceipt: {
    schemaVersion: 'eai.application-audit-receipt.v1';
    installationId: string;
    tenantId: string;
    appKey: string;
    operation: string;
    idempotencyKey: string;
    outcome: 'accepted';
  };
} {
  const expected = signWorkloadCallback(value, policy.secret);
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
    throw new Error('workload_callback_signature_invalid');
  }
  if (value.installationId !== policy.expectedInstallationId) throw new Error('workload_callback_installation_mismatch');
  if (value.tenantId !== policy.expectedTenantId) throw new Error('workload_callback_tenant_mismatch');
  if (!policy.allowedOperations.includes(value.operation)) throw new Error('workload_callback_operation_denied');
  if (value.issuedAt > policy.nowSeconds || value.expiresAt < policy.nowSeconds || value.expiresAt - value.issuedAt > 300) {
    throw new Error('workload_callback_expired');
  }
  if (!policy.replayStore.consume(`${value.installationId}:${value.idempotencyKey}`)) {
    throw new Error('workload_callback_replay');
  }
  return {
    auditReceipt: {
      schemaVersion: 'eai.application-audit-receipt.v1',
      installationId: value.installationId,
      tenantId: value.tenantId,
      appKey: value.appKey,
      operation: value.operation,
      idempotencyKey: value.idempotencyKey,
      outcome: 'accepted',
    },
  };
}
