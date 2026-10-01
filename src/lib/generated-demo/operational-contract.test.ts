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
    views: [{ id: 'fleet-view', title: 'Fleet', componentIds: ['fleet-table'],
      dataBindings: [{ componentId: 'fleet-table', fixtureCollection: 'vehicles', objectTypeSlug: 'vehicle' }] }],
    entryPath: 'src/generated/app.tsx' as const,
  };
  const sourceBundle = { schemaVersion: 'eai.generated_app_source.v1' as const,
    files: [{ path: 'src/generated/app.tsx', content: 'export default function App() { return null }' }] };
  const previewFixtures = { schemaVersion: 'eai.generated_app_fixtures.v1' as const,
    collections: { vehicles: [{ id: 'sample-car' }] },
    actions: { book: { effect: 'session-local' as const, message: 'Simulated' } } };
  const objectTypeDefinitions: GeneratedDemoArtifact['objectTypeDefinitions'] = [{ slug: 'vehicle', name: 'Vehicle', properties: [
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
      [{ name: 'privateNote', type: 'text' }],
      [{ name: 'customerSSN', type: 'text' }],
      [{ name: 'callbackUrl', type: 'text' }],
      [{ name: 'name', type: 'text' }, { name: 'name', type: 'text' }],
      [{ name: 'constructor', type: 'text' }],
      [{ name: 'ID', type: 'text' }],
      [{ name: 'safe', type: 'text', serverOnly: 'false' }],
    ]) {
      const accepted = artifact();
      accepted.objectTypeDefinitions[0].properties = properties;
      expect(resolveGeneratedOperationalRuntime(config(accepted), accepted, tenantId, 'fleet-demo'))
        .toMatchObject({ status: 'invalid' });
    }
  });

  it('keeps an accepted hyphenated scalar property in the reviewed read projection', () => {
    const accepted = artifact();
    accepted.objectTypeDefinitions[0].properties = [{ name: 'car-model', type: 'text' }];
    expect(resolveGeneratedOperationalRuntime(config(accepted), accepted, tenantId, 'fleet-demo'))
      .toMatchObject({ status: 'ready', projectedFields: ['car-model'] });
  });

  it('admits only one typed selected create on the exact accepted read Object Type', () => {
    const accepted = artifact();
    accepted.objectTypeDefinitions[0].properties = [
      { name: 'name', type: 'text', required: true },
      { name: 'mileage', type: 'number' },
      { name: 'privateToken', type: 'text', serverOnly: true },
    ];
    const reviewed = {
      ...config(accepted), schemaVersion: 'eai.generated_app_operational.v2',
      actionsMode: 'selected-create',
      createBinding: { objectTypeSlug: 'vehicle', fields: ['name', 'mileage'] },
    };
    expect(resolveGeneratedOperationalRuntime(reviewed, accepted, tenantId, 'fleet-demo'))
      .toMatchObject({ status: 'ready', createFields: [
        { name: 'name', type: 'text', required: true },
        { name: 'mileage', type: 'number', required: false },
      ] });
    for (const createBinding of [
      { objectTypeSlug: 'other', fields: ['name'] },
      { objectTypeSlug: 'vehicle', fields: ['mileage'] },
      { objectTypeSlug: 'vehicle', fields: ['name', 'name'] },
      { objectTypeSlug: 'vehicle', fields: ['privateToken'] },
      { objectTypeSlug: 'vehicle', fields: ['privateNote'] },
      { objectTypeSlug: 'vehicle', fields: ['customerSSN'] },
      { objectTypeSlug: 'vehicle', fields: ['callbackUrl'] },
      { objectTypeSlug: 'vehicle', fields: ['name'], endpoint: 'https://unreviewed.test' },
    ]) {
      expect(resolveGeneratedOperationalRuntime({ ...reviewed, createBinding }, accepted, tenantId, 'fleet-demo'))
        .toMatchObject({ status: 'invalid' });
    }
  });

  it('permits a hyphenated reviewed create field while denying credential-like names', () => {
    const accepted = artifact();
    accepted.objectTypeDefinitions[0].properties = [{ name: 'car-model', type: 'text', required: true }];
    const reviewed = {
      ...config(accepted), schemaVersion: 'eai.generated_app_operational.v2',
      actionsMode: 'selected-create',
      createBinding: { objectTypeSlug: 'vehicle', fields: ['car-model'] },
    };
    expect(resolveGeneratedOperationalRuntime(reviewed, accepted, tenantId, 'fleet-demo'))
      .toMatchObject({ status: 'ready', createFields: [{ name: 'car-model', type: 'text', required: true }] });
    for (const name of ['privateNote', 'customerSSN', 'callbackUrl', 'apiKey']) {
      accepted.objectTypeDefinitions[0].properties = [{ name, type: 'text', required: true }];
      expect(resolveGeneratedOperationalRuntime({
        ...reviewed, acceptedArtifactDigest: demoArtifactDigest(accepted),
        createBinding: { objectTypeSlug: 'vehicle', fields: [name] },
      }, accepted, tenantId, 'fleet-demo')).toMatchObject({ status: 'invalid' });
    }
  });

  it('binds multiple v3 live reads to accepted view and component IDs without widening legacy modes', () => {
    const accepted = artifact();
    accepted.appDefinition.views.push({ id: 'booking-view', title: 'Booking', componentIds: ['booking-table'],
      dataBindings: [{ componentId: 'booking-table', fixtureCollection: 'bookings', objectTypeSlug: 'booking' }] });
    accepted.appDefinition.workflow.steps.push({ id: 'booking', title: 'Booking', viewId: 'booking-view' });
    accepted.previewFixtures.collections.bookings = [{ id: 'sample-booking' }];
    accepted.objectTypeDefinitions.push({ slug: 'booking', name: 'Booking', properties: [{ name: 'status', type: 'text' }] });
    const reviewed = {
      ...config(accepted), schemaVersion: 'eai.generated_app_operational.v3',
      readBindings: [
        { viewId: 'fleet-view', componentId: 'fleet-table', fixtureCollection: 'vehicles', objectTypeSlug: 'vehicle', maxRows: 25 },
        { viewId: 'booking-view', componentId: 'booking-table', fixtureCollection: 'bookings', objectTypeSlug: 'booking', maxRows: 10 },
      ],
    };
    expect(resolveGeneratedOperationalRuntime(reviewed, accepted, tenantId, 'fleet-demo'))
      .toMatchObject({ status: 'ready', bindings: [
        { viewId: 'fleet-view', componentId: 'fleet-table', projectedFields: ['name', 'mileage'] },
        { viewId: 'booking-view', componentId: 'booking-table', projectedFields: ['status'] },
      ] });
    for (const change of [
      { readBindings: [reviewed.readBindings[0], reviewed.readBindings[0]] },
      { readBindings: [{ ...reviewed.readBindings[0], componentId: 'unreviewed' }] },
      { readBindings: [{ ...reviewed.readBindings[0], objectTypeSlug: 'booking' }] },
      { readBindings: [{ ...reviewed.readBindings[0], viewId: 'unreviewed' }] },
      { readBindings: [{ ...reviewed.readBindings[0], endpoint: 'https://bad.example' }] },
      { readBindings: Array(5).fill(reviewed.readBindings[0]) },
      { actionsMode: 'selected-create' },
    ]) {
      expect(resolveGeneratedOperationalRuntime({ ...reviewed, ...change }, accepted, tenantId, 'fleet-demo'))
        .toMatchObject({ status: 'invalid' });
    }
  });
});
