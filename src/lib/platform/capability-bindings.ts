import type { AppCapabilityRequirements } from '@/eai.config/capabilities';

/** Runtime lookup keys sent to PublicAPI instead of resolved tenant resource IDs. */
export interface CapabilityRequestContext {
  readonly appKey: string;
  readonly logicalAlias: string;
}

/** Raised before a platform call when code references an undeclared app alias. */
export class UnknownCapabilityAliasError extends Error {
  constructor(alias: string) {
    super(`Capability alias "${alias}" is not declared by this app.`);
    this.name = 'UnknownCapabilityAliasError';
  }
}

/**
 * Runtime requests identify the app and logical binding. PublicAPI resolves
 * the tenant-owned workflow, prompt, profile, or integration server-side.
 */
export function capabilityRequestContext(
  manifest: AppCapabilityRequirements,
  alias: string,
): CapabilityRequestContext {
  const logicalAlias = alias.trim();
  if (
    !logicalAlias ||
    !manifest.requirements.some((item) => item.alias === logicalAlias)
  ) {
    throw new UnknownCapabilityAliasError(alias);
  }

  return {
    appKey: manifest.appKey,
    logicalAlias,
  };
}
