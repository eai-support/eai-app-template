import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface DelegatedInstalledAppContext {
  appKey: string;
  installationId: string;
  tenantId: string;
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'UNINSTALLED';
  region: string;
  expiresAt: string;
  entitlementActive: boolean;
  membershipActive: boolean;
  assignmentActive: boolean;
  packageCapabilities: readonly string[];
  consentedCapabilities: readonly string[];
  assignedCapabilities: readonly string[];
  userCapabilities: readonly string[];
}

export class AppAccessDeniedError extends Error {
  constructor(code: string) {
    super(code);
    this.name = 'AppAccessDeniedError';
  }
}

/** Return safe buyer-local routing only when all delegated access layers agree. */
export function evaluateDelegatedAppAccess(
  context: DelegatedInstalledAppContext | undefined,
  request: { tenantId: string; appKey: string; capability: string; now?: Date },
): { installationId: string; region: string } {
  if (!context) throw new AppAccessDeniedError('installed_app_context_unavailable');
  if (context.tenantId !== request.tenantId) throw new AppAccessDeniedError('tenant_mismatch');
  if (context.appKey !== request.appKey) throw new AppAccessDeniedError('application_mismatch');
  if (context.status !== 'ACTIVE') throw new AppAccessDeniedError('installation_not_active');
  if (!context.entitlementActive) throw new AppAccessDeniedError('entitlement_not_active');
  if (!context.membershipActive) throw new AppAccessDeniedError('membership_not_active');
  if (!context.assignmentActive) throw new AppAccessDeniedError('assignment_not_active');
  const now = request.now ?? new Date();
  if (Number.isNaN(Date.parse(context.expiresAt)) || Date.parse(context.expiresAt) <= now.getTime()) {
    throw new AppAccessDeniedError('installed_app_context_expired');
  }
  for (const boundary of [
    context.packageCapabilities,
    context.consentedCapabilities,
    context.assignedCapabilities,
    context.userCapabilities,
  ]) {
    if (!boundary.includes(request.capability)) throw new AppAccessDeniedError('capability_denied');
  }
  if (!/^[A-Z]{2,3}$/.test(context.region)) throw new AppAccessDeniedError('buyer_region_invalid');
  return { installationId: context.installationId, region: context.region };
}

/** Avoid emitting request, credential or tenant detail when recording an access failure. */
export function redactAppAccessError(unsafe: unknown): '[REDACTED]' {
  void unsafe;
  return '[REDACTED]';
}

/** Seal a short-lived delegated token for server-side session storage only. */
export function sealServerAccessToken(token: string, key: Buffer): string {
  if (key.length !== 32) throw new Error('server_session_key_invalid');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((value) => value.toString('base64url')).join('.');
}

/** Open a sealed token only inside the server BFF. */
export function unsealServerAccessToken(value: string, key: Buffer): string {
  if (key.length !== 32) throw new Error('server_session_key_invalid');
  const [ivValue, tagValue, ciphertextValue] = value.split('.');
  if (!ivValue || !tagValue || !ciphertextValue) throw new Error('server_session_invalid');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/** Build server-authoritative installation headers; browser values are always discarded. */
export function applyInstalledAppHeaders(headers: Headers, binding: {
  appKey?: string;
  installationId?: string;
}): void {
  headers.delete('x-eai-app-key');
  headers.delete('x-eai-installation-id');
  if (binding.appKey && binding.installationId) {
    headers.set('x-eai-app-key', binding.appKey);
    headers.set('x-eai-installation-id', binding.installationId);
  }
}
