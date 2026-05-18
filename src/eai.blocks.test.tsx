import type { ComponentType } from 'react';
import {
  createAppBlockRegistry,
  getClientBlockManifests,
  type ClientBlockExtension,
} from './eai.blocks';

function CustomBlock() {
  return null;
}

describe('EAI block extensions', () => {
  const extension: ClientBlockExtension = {
    manifest: {
      schemaVersion: '1.0.0',
      packageName: '@customer/vertical-blocks',
      blocks: [
        {
          id: 'customer.custom-block',
          title: 'Custom Block',
          packageName: '@customer/vertical-blocks',
          importPath: '@/eai.blocks',
          exportName: 'CustomBlock',
          packageLane: 'foundation',
          backendCoupling: 'external-safe',
          capabilities: ['custom'],
        },
      ],
    },
    components: {
      CustomBlock: CustomBlock as ComponentType<unknown>,
    },
  };

  it('HP001 registers customer extension components without editing EAI packages', () => {
    const baseRegistry = new Map<string, ComponentType<unknown>>([
      ['ExampleCard', (() => null) as ComponentType<unknown>],
    ]);
    const registry = createAppBlockRegistry([extension], baseRegistry);

    expect(registry.has('ExampleCard')).toBe(true);
    expect(registry.get('CustomBlock')).toBe(CustomBlock);
  });

  it('HP002 exposes extension manifests for Gofer block catalog validation', () => {
    expect(getClientBlockManifests([extension])).toEqual([extension.manifest]);
  });
});
