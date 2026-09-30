import type { GeneratedDemoArtifact } from './contract';
import { demoArtifactDigest } from './runtime-contract';

export interface GeneratedOperationalBinding {
  fixtureCollection: string;
  objectTypeSlug: string;
  maxRows: number;
}

export interface GeneratedOperationalConfig {
  schemaVersion: 'eai.generated_app_operational.v1';
  tenantId: string;
  appKey: string;
  acceptedArtifactDigest: `sha256:${string}`;
  readBindings: [GeneratedOperationalBinding];
  actionsMode: 'simulated';
}

export type GeneratedOperationalResolution =
  | { status: 'unconfigured' }
  | { status: 'invalid'; errors: string[] }
  | { status: 'ready'; config: GeneratedOperationalConfig };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z][a-z0-9-]{0,63}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).sort().join('|') === [...keys].sort().join('|');
}

/** Read authority is separate from immutable demo source and must match its accepted bytes. */
export function resolveGeneratedOperationalRuntime(
  value: unknown,
  artifact: GeneratedDemoArtifact,
  expectedTenantId: string | undefined,
  expectedAppKey: string,
): GeneratedOperationalResolution {
  if (value === null || value === undefined) return { status: 'unconfigured' };
  const errors: string[] = [];
  if (!record(value) || !exactKeys(value, [
    'schemaVersion', 'tenantId', 'appKey', 'acceptedArtifactDigest',
    'readBindings', 'actionsMode',
  ])) return { status: 'invalid', errors: ['operational config shape is invalid'] };
  if (value.schemaVersion !== 'eai.generated_app_operational.v1')
    errors.push('operational schema is unsupported');
  if (!expectedTenantId || !UUID.test(expectedTenantId) || value.tenantId !== expectedTenantId)
    errors.push('tenant binding does not match deployed identity');
  if (value.appKey !== expectedAppKey || value.appKey !== artifact.appDefinition.appKey)
    errors.push('app binding does not match accepted artifact');
  if (
    typeof value.acceptedArtifactDigest !== 'string' ||
    !DIGEST.test(value.acceptedArtifactDigest) ||
    value.acceptedArtifactDigest !== demoArtifactDigest(artifact)
  ) errors.push('accepted artifact digest does not match');
  if (value.actionsMode !== 'simulated') errors.push('operational actions are unsupported');
  if (!Array.isArray(value.readBindings) || value.readBindings.length !== 1 ||
      !record(value.readBindings[0])) {
    errors.push('exactly one reviewed read binding is required');
  } else {
    const binding = value.readBindings[0];
    if (!exactKeys(binding, ['fixtureCollection', 'objectTypeSlug', 'maxRows']) ||
        typeof binding.fixtureCollection !== 'string' ||
        !SLUG.test(binding.fixtureCollection) ||
        !(binding.fixtureCollection in artifact.previewFixtures.collections) ||
        typeof binding.objectTypeSlug !== 'string' ||
        !SLUG.test(binding.objectTypeSlug) ||
        !artifact.objectTypeDefinitions.some((item) => item.slug === binding.objectTypeSlug) ||
        !Number.isInteger(binding.maxRows) || binding.maxRows < 1 || binding.maxRows > 50) {
      errors.push('read binding is not a bounded accepted Object Type');
    }
  }
  return errors.length
    ? { status: 'invalid', errors }
    : { status: 'ready', config: value as unknown as GeneratedOperationalConfig };
}
