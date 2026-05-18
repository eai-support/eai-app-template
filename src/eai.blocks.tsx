import type { ComponentType } from 'react';
import {
  createDefaultRegistry,
  type ComponentRegistry,
} from '@enterpriseaigroup/core/config';

export type EAIPackageProfile = 'external' | 'internal' | 'hybrid';

export interface EAIBlockManifestEntryLike {
  id: string;
  title: string;
  packageName: string;
  importPath: string;
  exportName: string;
  packageLane: 'foundation' | 'product' | 'addon' | 'dev';
  backendCoupling: 'external-safe' | 'external-with-adapter' | 'internal-only';
  capabilities?: string[];
}

export interface EAIBlockManifestLike {
  schemaVersion: string;
  packageName: string;
  blocks: EAIBlockManifestEntryLike[];
}

export interface ClientBlockExtension {
  manifest: EAIBlockManifestLike;
  components: Record<string, ComponentType<unknown>>;
}

export const eaiPackageProfile: EAIPackageProfile = 'external';

export const clientBlockExtensions: ClientBlockExtension[] = [];

export function createAppBlockRegistry(
  extensions: ClientBlockExtension[] = clientBlockExtensions,
  baseRegistry: ComponentRegistry = createDefaultRegistry()
): ComponentRegistry {
  const registry = new Map(baseRegistry);

  for (const extension of extensions) {
    for (const [componentName, component] of Object.entries(extension.components)) {
      registry.set(componentName, component);
    }
  }

  return registry;
}

export function getClientBlockManifests(
  extensions: ClientBlockExtension[] = clientBlockExtensions
): EAIBlockManifestLike[] {
  return extensions.map((extension) => extension.manifest);
}
