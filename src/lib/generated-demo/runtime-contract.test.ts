import {
  demoArtifactDigest,
  resolveGeneratedDemoRuntime,
} from './runtime-contract';

const appDefinition = {
  schemaVersion: 'eai.generated_app_definition.v2',
  appKey: 'fleet-demo',
  appName: 'Fleet Demo',
  businessCard: {
    description: 'Manage cars',
    goal: 'See availability',
    audience: 'Fleet manager',
    outcome: 'Faster decisions',
    valueHypothesis: 'Less manual checking',
    successMeasure: 'Minutes to find a car',
    recommendedFirstSlice: 'Fleet dashboard',
    assumptions: ['Sample data only'],
  },
  workflow: { steps: [{ id: 'fleet', title: 'Fleet', viewId: 'fleet-view' }] },
  views: [{ id: 'fleet-view', title: 'Fleet', componentIds: ['fleet-table'],
    safeUi: { version: 'eai.safe_ui.v1', root: { kind: 'heading', level: 1, text: 'Fleet' } } }],
  entryPath: 'src/generated/app.tsx',
};
const sourceBundle = {
  schemaVersion: 'eai.generated_app_source.v1',
  files: [
    {
      path: 'src/generated/app.tsx',
      content: 'export default function GeneratedApp() { return null; }',
    },
  ],
};
const previewFixtures = {
  schemaVersion: 'eai.generated_app_fixtures.v1',
  collections: { vehicles: [{ id: 'car-1', name: 'Sample car' }] },
  actions: {
    'book-car': { effect: 'session-local', message: 'Simulated booking' },
  },
};

function artifact() {
  const objectTypeDefinitions: object[] = [];
  return {
    schemaVersion: 'eai.generated_app_artifact.v2',
    appDefinition: JSON.parse(JSON.stringify(appDefinition)),
    sourceBundle: JSON.parse(JSON.stringify(sourceBundle)),
    previewFixtures: JSON.parse(JSON.stringify(previewFixtures)),
    objectTypeDefinitions,
    digests: {
      appDefinition: demoArtifactDigest(appDefinition),
      sourceBundle: demoArtifactDigest(sourceBundle),
      previewFixtures: demoArtifactDigest(previewFixtures),
      objectTypeDefinitions: demoArtifactDigest(objectTypeDefinitions),
    },
  };
}

describe('generated demo runtime', () => {
  it('uses the cross-language canonical digest vector and resolves a valid one-step app', () => {
    const accepted = artifact();
    expect(accepted.digests).toEqual({
      appDefinition:
        'sha256:73066d719da516f437b6cbb1631929204f5ed46f4f3ba86662f14271bf9c9d7a',
      sourceBundle:
        'sha256:b84f90dee30a2269f1df76a2461e7cc0c872d3778164a1bf016056ca8a0aab66',
      previewFixtures:
        'sha256:492c5186afe859d313dc09dc07c0c5c735e2ccc774fe0de92f7d3b18ab40529c',
      objectTypeDefinitions:
        'sha256:37517e5f3dc66819f61f5a7bb8ace1921282415f10551d2defa5c3eb0985b570',
    });
    expect(resolveGeneratedDemoRuntime(accepted, 'fleet-demo')).toEqual({
      status: 'ready',
      artifact: accepted,
    });
  });

  it('leaves v1 unconfigured and rejects another deployed app identity', () => {
    expect(resolveGeneratedDemoRuntime(null, 'fleet-demo')).toEqual({
      status: 'unconfigured',
    });
    expect(resolveGeneratedDemoRuntime(artifact(), 'another-app')).toEqual({
      status: 'invalid',
      errors: expect.arrayContaining([
        'app key does not match deployed identity',
      ]),
    });
  });

  it('rejects changed source and fixtures after acceptance', () => {
    const changedSource = artifact();
    changedSource.sourceBundle.files[0].content += '\n// changed';
    expect(resolveGeneratedDemoRuntime(changedSource, 'fleet-demo')).toEqual({
      status: 'invalid',
      errors: expect.arrayContaining(['sourceBundle digest does not match']),
    });
    const changedFixtures = artifact();
    changedFixtures.previewFixtures.collections.vehicles.push({
      id: 'car-2',
      name: 'New car',
    });
    expect(resolveGeneratedDemoRuntime(changedFixtures, 'fleet-demo')).toEqual({
      status: 'invalid',
      errors: expect.arrayContaining(['previewFixtures digest does not match']),
    });
  });

  it('accepts only a component-scoped fixture and Object Type mapping in the accepted definition', () => {
    const accepted = artifact();
    accepted.objectTypeDefinitions.push({ slug: 'vehicle', name: 'Vehicle', properties: [] });
    accepted.appDefinition.views[0].dataBindings = [{
      componentId: 'fleet-table', fixtureCollection: 'vehicles', objectTypeSlug: 'vehicle',
    }];
    accepted.digests.appDefinition = demoArtifactDigest(accepted.appDefinition);
    accepted.digests.objectTypeDefinitions = demoArtifactDigest(accepted.objectTypeDefinitions);
    expect(resolveGeneratedDemoRuntime(accepted, 'fleet-demo')).toMatchObject({ status: 'ready' });
    accepted.appDefinition.views[0].dataBindings[0].componentId = 'unreviewed';
    accepted.digests.appDefinition = demoArtifactDigest(accepted.appDefinition);
    expect(resolveGeneratedDemoRuntime(accepted, 'fleet-demo')).toMatchObject({
      status: 'invalid', errors: expect.arrayContaining(['view data binding does not name an accepted component']),
    });
  });
  it('bounds trusted operational slots and requires a same-view data binding', () => {
    const accepted = artifact();
    accepted.objectTypeDefinitions.push({ slug: 'vehicle', name: 'Vehicle', properties: [] });
    accepted.appDefinition.views[0].dataBindings = [{
      componentId: 'fleet-table', fixtureCollection: 'vehicles', objectTypeSlug: 'vehicle',
    }];
    accepted.appDefinition.views[0].trustedLayout = { columns: 2, slots: [
      { componentId: 'fleet-table', kind: 'read-table', title: 'Fleet', columnSpan: 2 },
    ] };
    accepted.digests.appDefinition = demoArtifactDigest(accepted.appDefinition);
    accepted.digests.objectTypeDefinitions = demoArtifactDigest(accepted.objectTypeDefinitions);
    expect(resolveGeneratedDemoRuntime(accepted, 'fleet-demo')).toMatchObject({ status: 'ready' });
    for (const layout of [
      { columns: 2, slots: [{ componentId: 'fleet-table', kind: 'read-table', title: 'Fleet', columnSpan: 3 }] },
      { columns: 2, slots: [{ componentId: 'fleet-table', kind: 'read-table', title: 'Fleet', text: 'unsafe' }] },
      { columns: 2, slots: [{ componentId: 'fleet-table', kind: 'static-copy', title: 'Fleet' }] },
      { columns: 2, slots: Array(17).fill({ componentId: 'fleet-table', kind: 'read-table', title: 'Fleet' }) },
    ]) {
      const modified = JSON.parse(JSON.stringify(accepted));
      modified.appDefinition.views[0].trustedLayout = layout;
      modified.digests.appDefinition = demoArtifactDigest(modified.appDefinition);
      expect(resolveGeneratedDemoRuntime(modified, 'fleet-demo'))
        .toMatchObject({ status: 'invalid' });
    }
  });
  it('accepts only bounded declarative preview nodes and reviewed local references', () => {
    const accepted = artifact();
    accepted.appDefinition.views[0].componentIds.push('fleet-heading', 'fleet-button');
    accepted.appDefinition.views[0].safeUi = { version: 'eai.safe_ui.v1', root: {
      kind: 'stack', direction: 'column', gap: 'md', children: [
        { kind: 'heading', level: 1, text: 'Fleet', componentId: 'fleet-heading' },
        { kind: 'table', fixtureCollection: 'vehicles', columns: [{ field: 'name', label: 'Car' }] },
        { kind: 'stat', label: 'First', value: { kind: 'fixture', collection: 'vehicles', field: 'name', rowIndex: 0 } },
        { kind: 'input', id: 'search', label: 'Search', inputType: 'text' },
        { kind: 'button', label: 'Book', actionId: 'book-car', componentId: 'fleet-button' },
        { kind: 'view-link', label: 'Fleet', targetViewId: 'fleet-view' },
      ],
    } };
    accepted.digests.appDefinition = demoArtifactDigest(accepted.appDefinition);
    expect(resolveGeneratedDemoRuntime(accepted, 'fleet-demo')).toMatchObject({ status: 'ready' });
    const badRoots: unknown[] = [
      { kind: 'text', text: 'Unsafe', href: 'https://example.invalid' },
      { kind: 'html', value: '<script>unsafe</script>' },
      { kind: 'text', text: 'x'.repeat(501) },
      { kind: 'button', label: 'Go', actionId: 'external' },
      { kind: 'view-link', label: 'Go', targetViewId: 'external-view' },
      { kind: 'stat', label: 'Secret', value: { kind: 'fixture', collection: 'vehicles', field: 'secret', rowIndex: 0 } },
      { kind: 'table', fixtureCollection: 'vehicles', columns: Array(13).fill({ field: 'name', label: 'Car' }) },
      { kind: 'stack', direction: 'column', gap: 'md', children: Array(17).fill({ kind: 'text', text: 'x' }) },
      { kind: 'stack', direction: 'column', gap: 'md', children: [
        { kind: 'text', text: 'one', componentId: 'fleet-heading' },
        { kind: 'text', text: 'two', componentId: 'fleet-heading' },
      ] },
      { kind: 'text', text: 'unreviewed', componentId: 'other-component' },
    ];
    for (const root of badRoots) {
      const changed = JSON.parse(JSON.stringify(accepted));
      changed.appDefinition.views[0].safeUi.root = root;
      changed.digests.appDefinition = demoArtifactDigest(changed.appDefinition);
      expect(resolveGeneratedDemoRuntime(changed, 'fleet-demo')).toMatchObject({ status: 'invalid' });
    }
    const missing = JSON.parse(JSON.stringify(accepted));
    delete missing.appDefinition.views[0].safeUi;
    missing.digests.appDefinition = demoArtifactDigest(missing.appDefinition);
    expect(resolveGeneratedDemoRuntime(missing, 'fleet-demo')).toMatchObject({ status: 'invalid' });
  });
});
