import {
  APP_CAPABILITY_SCHEMA,
  GENERATED_APP_CAPABILITY_MANIFEST_PATH,
  templateCapabilityRequirements,
  validateAppCapabilityRequirements,
} from './capabilities';
import generatedCapabilityRequirements from './capabilities.generated.json';

describe('templateCapabilityRequirements', () => {
  it('declares logical aliases without tenant records or secrets', () => {
    expect(templateCapabilityRequirements.schemaVersion).toBe(
      APP_CAPABILITY_SCHEMA,
    );
    expect(templateCapabilityRequirements.requirements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          alias: 'primary-workflow',
          capability: 'workflows.runtime',
          required: true,
        }),
      ]),
    );

    const serialised = JSON.stringify(templateCapabilityRequirements);
    expect(serialised).not.toMatch(
      /tenantId|resourceId|secret|credential|clientSecret|apiKey/i,
    );
  });

  it('uses a unique alias for every requirement', () => {
    const aliases = templateCapabilityRequirements.requirements.map(
      ({ alias }) => alias,
    );
    expect(new Set(aliases).size).toBe(aliases.length);
  });

  it('loads the canonical generated source artifact', () => {
    expect(GENERATED_APP_CAPABILITY_MANIFEST_PATH).toBe(
      'src/eai.config/capabilities.generated.json',
    );
    expect(templateCapabilityRequirements).toEqual(
      generatedCapabilityRequirements,
    );
  });

  it('accepts every capability key emitted by No-Code Builder', () => {
    const capabilities = [
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
    ] as const;

    expect(
      validateAppCapabilityRequirements({
        schemaVersion: APP_CAPABILITY_SCHEMA,
        appKey: 'generated-app',
        requirements: capabilities.map((capability, index) => ({
          alias: `capability-${index}`,
          capability,
          required: true,
          description: `Requirement ${index}`,
        })),
      }).requirements.map(({ capability }) => capability),
    ).toEqual(capabilities);
  });

  it('rejects environment bindings, unsupported keys, and unknown capabilities', () => {
    const requirement = templateCapabilityRequirements.requirements[0];
    expect(() =>
      validateAppCapabilityRequirements({
        ...templateCapabilityRequirements,
        tenantId: 'tenant-a',
      }),
    ).toThrow('unsupported fields');
    expect(() =>
      validateAppCapabilityRequirements({
        ...templateCapabilityRequirements,
        requirements: [{ ...requirement, capability: 'unknown.runtime' }],
      }),
    ).toThrow('unknown capability');
    expect(() =>
      validateAppCapabilityRequirements({
        ...templateCapabilityRequirements,
        requirements: [
          {
            ...requirement,
            description:
              'Resolved as 40795709-be42-4fa5-879b-aec8c3f9b3c3.',
          },
        ],
      }),
    ).toThrow('must not contain tenant records or credentials');
  });

  it('accepts canonical provider and asset compatibility logical keys', () => {
    const requirement = templateCapabilityRequirements.requirements[0];
    const validated = validateAppCapabilityRequirements({
      ...templateCapabilityRequirements,
      requirements: [
        {
          ...requirement,
          compatibleProviders: ['publicapi', 'resource_api'],
          compatibleAssetTypes: ['shared-asset-*', 'workflow-template'],
        },
      ],
    });

    expect(validated.requirements[0]).toMatchObject({
      compatibleProviders: ['publicapi', 'resource_api'],
      compatibleAssetTypes: ['shared-asset-*', 'workflow-template'],
    });
    expect(() =>
      validateAppCapabilityRequirements({
        ...templateCapabilityRequirements,
        requirements: [
          {
            ...requirement,
            compatibleProviders: ['publicapi', 'publicapi'],
          },
        ],
      }),
    ).toThrow('must not contain duplicate logical keys');
  });
});
