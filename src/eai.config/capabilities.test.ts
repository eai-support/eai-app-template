import {
  APP_CAPABILITY_SCHEMA,
  templateCapabilityRequirements,
} from './capabilities';

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
});
