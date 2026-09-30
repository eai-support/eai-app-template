import type { GeneratedDemoArtifact } from './contract';
import { demoArtifactDigest } from './runtime-contract';
import { resolveGeneratedOperationalRuntime } from './operational-contract';

const tenantId = '11111111-1111-4111-8111-111111111111';

function artifact(): GeneratedDemoArtifact {
  const appDefinition = {
    schemaVersion: 'eai.generated_app_definition.v2' as const,
    appKey: 'fleet-demo', appName: 'Fleet Demo',
    businessCard: { description: 'Fleet', goal: 'Read cars', audience: 'Staff', outcome: 'Fleet view' },
    workflow: { steps: [{ id: 'fleet', title: 'Fleet', viewId: 'fleet-view' }] },
    views: [{ id: 'fleet-view', title: 'Fleet', componentIds: ['fleet-table'] }],
    entryPath: 'src/generated/app.tsx' as const,
  };
  const sourceBundle = { schemaVersion: 'eai.generated_app_source.v1' as const,
    files: [{ path: 'src/generated/app.tsx', content: 'export default function App() { return null }' }] };
  const previewFixtures = { schemaVersion: 'eai.generated_app_fixtures.v1' as const,
    collections: { vehicles: [{ id: 'sample-car' }] },
    actions: { book: { effect: 'session-local' as const, message: 'Simulated' } } };
  const objectTypeDefinitions = [{ slug: 'vehicle', name: 'Vehicle', properties: [
    { name: 'name', type: 'text' },
    { name: 'mileage', type: 'number' },
    { name: 'privateToken', type: 'text', serverOnly: true },
  ] }];
  return { schemaVersion: 'eai.generated_app_artifact.v2', appDefinition,
    sourceBundle, previewFixtures, objectTypeDefinitions,
    digests: {
      appDefinition: demoArtifactDigest(appDefinition),
      sourceBundle: demoArtifactDigest(sourceBundle),
      previewFixtures: demoArtifactDigest(previewFixtures),
      objectTypeDefinitions: demoArtifactDigest(objectTypeDefinitions),
    } };
}

function config(accepted: GeneratedDemoArtifact): Record<string, unknown> {
  return {
    schemaVersion: 'eai.generated_app_operational.v1', tenantId,
    appKey: 'fleet-demo', acceptedArtifactDigest: demoArtifactDigest(accepted),
    readBindings: [{ fixtureCollection: 'vehicles', objectTypeSlug: 'vehicle', maxRows: 25 }],
    actionsMode: 'simulated',
  };
}

describe('reviewed operational binding', () => {
  it('accepts one bounded read tied to exact tenant, app and accepted artifact', () => {
    const accepted = artifact();
    expect(resolveGeneratedOperationalRuntime(config(accepted), accepted, tenantId, 'fleet-demo'))
      .toMatchObject({ status: 'ready', projectedFields: ['name', 'mileage'] });
    expect(resolveGeneratedOperationalRuntime(null, accepted, tenantId, 'fleet-demo'))
      .toEqual({ status: 'unconfigured' });
  });

  it('fails closed for a different tenant, app, artifact or unreviewed action', () => {
    const accepted = artifact();
    const valid = config(accepted);
    for (const change of [
      { tenantId: '22222222-2222-4222-8222-222222222222' },
      { appKey: 'another-app' },
      { acceptedArtifactDigest: `sha256:${'a'.repeat(64)}` },
      { actionsMode: 'live' },
      { endpoint: 'https://unreviewed.example.com' },
    ]) {
      expect(resolveGeneratedOperationalRuntime({ ...valid, ...change }, accepted, tenantId, 'fleet-demo'))
        .toMatchObject({ status: 'invalid' });
    }
  });

  it('rejects another binding, missing accepted Object Type and unbounded rows', () => {
    const accepted = artifact();
    const valid = config(accepted);
    const binding = { fixtureCollection: 'vehicles', objectTypeSlug: 'vehicle', maxRows: 25 };
    for (const readBindings of [
      [],
      [binding, binding],
      [{ fixtureCollection: 'vehicles', objectTypeSlug: 'unreviewed', maxRows: 25 }],
      [{ fixtureCollection: 'vehicles', objectTypeSlug: 'vehicle', maxRows: 51 }],
      [{ fixtureCollection: 'vehicles', objectTypeSlug: 'vehicle', maxRows: 25, token: 'bad' }],
    ]) {
      expect(resolveGeneratedOperationalRuntime({ ...valid, readBindings }, accepted, tenantId, 'fleet-demo'))
        .toMatchObject({ status: 'invalid' });
    }
  });

  it('rejects ambiguous, empty or sensitive operational field projections', () => {
    for (const properties of [
      [],
      [{ name: 'privateToken', type: 'text' }],
      [{ name: 'name', type: 'text' }, { name: 'name', type: 'text' }],
      [{ name: 'constructor', type: 'text' }],
      [{ name: 'safe', type: 'text', serverOnly: 'false' }],
    ]) {
      const accepted = artifact();
      accepted.objectTypeDefinitions[0].properties = properties;
      expect(resolveGeneratedOperationalRuntime(config(accepted), accepted, tenantId, 'fleet-demo'))
        .toMatchObject({ status: 'invalid' });
    }
  });
});
