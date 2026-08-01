import generatedCapabilityRequirements from './capabilities.generated.json';

export const APP_CAPABILITY_SCHEMA = 'eai.app_capabilities.v1' as const;
export const GENERATED_APP_CAPABILITY_MANIFEST_PATH =
  'src/eai.config/capabilities.generated.json' as const;

/** Stable PublicAPI capability keys supported by generated applications. */
export type AppCapabilityKind =
  | 'ai.chat'
  | 'ai.profiles'
  | 'document-checklists'
  | 'document-intelligence'
  | 'documents'
  | 'integrations'
  | 'knowledge'
  | 'shared-assets'
  | 'templates.documents'
  | 'templates.email'
  | 'workflows.runtime';

/** Logical requirement only; environment-specific resolution remains server-side. */
export interface AppCapabilityRequirement {
  readonly alias: string;
  readonly capability: AppCapabilityKind;
  readonly required: boolean;
  readonly description: string;
  readonly compatibleProviders?: readonly string[];
  readonly compatibleAssetTypes?: readonly string[];
}

/** Versioned generated-app manifest that cannot carry tenant records or secrets. */
export interface AppCapabilityRequirements {
  readonly schemaVersion: typeof APP_CAPABILITY_SCHEMA;
  readonly appKey: string;
  readonly requirements: readonly AppCapabilityRequirement[];
}

const LOGICAL_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9._-]*$/;
const SENSITIVE_FIELD_PATTERN =
  /tenantId|recordId|resourceId|secret|credential|clientSecret|apiKey/i;
const RAW_RECORD_ID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const SUPPORTED_APP_CAPABILITIES = new Set<AppCapabilityKind>([
  'ai.chat',
  'ai.profiles',
  'document-checklists',
  'document-intelligence',
  'documents',
  'integrations',
  'knowledge',
  'shared-assets',
  'templates.documents',
  'templates.email',
  'workflows.runtime',
]);

function normalizeLogicalKey(value: unknown, field: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (
    !LOGICAL_KEY_PATTERN.test(normalized) ||
    RAW_RECORD_ID_PATTERN.test(normalized)
  ) {
    throw new Error(`${field} must be a logical key`);
  }
  return normalized;
}

function normalizeLogicalList(
  value: unknown,
  field: string,
): readonly string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array of logical keys`);
  }
  const normalized = value.map((item, index) => {
    const logicalReference = typeof item === 'string' ? item.trim() : '';
    const wildcard = logicalReference.endsWith('*');
    const logicalKey = wildcard
      ? logicalReference.slice(0, -1)
      : logicalReference;
    return `${normalizeLogicalKey(logicalKey, `${field}[${index}]`)}${wildcard ? '*' : ''}`;
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${field} must not contain duplicate logical keys`);
  }
  return normalized;
}

/** Fails closed when generated capability data drifts or contains resolved bindings. */
export function validateAppCapabilityRequirements(
  value: unknown,
): AppCapabilityRequirements {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('capabilityRequirements must be an object');
  }

  const manifest = value as Record<string, unknown>;
  if (
    Object.keys(manifest).sort().join(',') !==
    'appKey,requirements,schemaVersion'
  ) {
    throw new Error('capabilityRequirements contains unsupported fields');
  }
  if (manifest.schemaVersion !== APP_CAPABILITY_SCHEMA) {
    throw new Error('capabilityRequirements.schemaVersion is unsupported');
  }
  const appKey = normalizeLogicalKey(
    manifest.appKey,
    'capabilityRequirements.appKey',
  );
  if (
    !Array.isArray(manifest.requirements) ||
    manifest.requirements.length < 1
  ) {
    throw new Error('capabilityRequirements.requirements cannot be empty');
  }

  const aliases = new Set<string>();
  const requirements: AppCapabilityRequirement[] = [];
  for (const [index, candidate] of manifest.requirements.entries()) {
    if (
      !candidate ||
      typeof candidate !== 'object' ||
      Array.isArray(candidate)
    ) {
      throw new Error(`capability requirement ${index} must be an object`);
    }
    const requirement = candidate as Record<string, unknown>;
    const allowedKeys = new Set([
      'alias',
      'capability',
      'description',
      'required',
      'compatibleProviders',
      'compatibleAssetTypes',
    ]);
    if (Object.keys(requirement).some((key) => !allowedKeys.has(key))) {
      throw new Error(
        `capability requirement ${index} contains unsupported fields`,
      );
    }
    const alias = normalizeLogicalKey(
      requirement.alias,
      `capability requirement ${index} alias`,
    );
    if (aliases.has(alias)) {
      throw new Error(`duplicate capability alias: ${alias}`);
    }
    aliases.add(alias);
    if (
      typeof requirement.capability !== 'string' ||
      !SUPPORTED_APP_CAPABILITIES.has(
        requirement.capability as AppCapabilityKind,
      )
    ) {
      throw new Error(
        `capability requirement ${index} has an unknown capability`,
      );
    }
    if (typeof requirement.required !== 'boolean') {
      throw new Error(
        `capability requirement ${index} required must be boolean`,
      );
    }
    if (
      typeof requirement.description !== 'string' ||
      !requirement.description.trim()
    ) {
      throw new Error(
        `capability requirement ${index} description is required`,
      );
    }
    const compatibleProviders = normalizeLogicalList(
      requirement.compatibleProviders,
      `capability requirement ${index} compatibleProviders`,
    );
    const compatibleAssetTypes = normalizeLogicalList(
      requirement.compatibleAssetTypes,
      `capability requirement ${index} compatibleAssetTypes`,
    );
    requirements.push({
      alias,
      capability: requirement.capability as AppCapabilityKind,
      required: requirement.required,
      description: requirement.description.trim(),
      ...(compatibleProviders ? { compatibleProviders } : {}),
      ...(compatibleAssetTypes ? { compatibleAssetTypes } : {}),
    });
  }

  const validated: AppCapabilityRequirements = {
    schemaVersion: APP_CAPABILITY_SCHEMA,
    appKey,
    requirements,
  };
  const serialized = JSON.stringify(validated);
  if (
    SENSITIVE_FIELD_PATTERN.test(serialized) ||
    RAW_RECORD_ID_PATTERN.test(serialized)
  ) {
    throw new Error(
      'capabilityRequirements must not contain tenant records or credentials',
    );
  }
  return validated;
}

/** Validated source artifact overwritten by CLI, NCB, or Gofer generation. */
export const templateCapabilityRequirements = validateAppCapabilityRequirements(
  generatedCapabilityRequirements,
);
