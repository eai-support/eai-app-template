import {
  demoArtifactDigest,
  resolveGeneratedDemoRuntime,
} from './runtime-contract';
import { projectGeneratedDemoClientView } from './contract';

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
  views: [{ id: 'fleet-view', title: 'Fleet', componentIds: ['fleet-table'] }],
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
  it('serializes only public labels and synthetic demo data into the frame', () => {
    const ready = resolveGeneratedDemoRuntime(artifact(), 'fleet-demo');
    if (ready.status !== 'ready')
      throw new Error('Expected a valid demo fixture');
    ready.artifact.appDefinition.businessCard.description =
      'PRIVATE_BUSINESS_BRIEF';
    ready.artifact.appDefinition.businessCard.outcome = 'PRIVATE_ROI_TARGET';
    ready.artifact.sourceBundle.files[0].content = 'PRIVATE_SOURCE_TEXT';
    ready.artifact.objectTypeDefinitions = [
      { confidentialField: 'PRIVATE_SCHEMA_FIELD' },
    ];
    const projection = projectGeneratedDemoClientView(ready.artifact);
    expect(projection).toEqual({
      appName: 'Fleet Demo',
      workflowSteps: [{ id: 'fleet', title: 'Fleet', viewId: 'fleet-view' }],
      previewFixtures: ready.artifact.previewFixtures,
      acceptedArtifactDigest: demoArtifactDigest(ready.artifact),
      sourceDigest: ready.artifact.digests.sourceBundle,
      fixtureDigest: ready.artifact.digests.previewFixtures,
    });
    const serialized = JSON.stringify(projection);
    expect(serialized).not.toMatch(
      /PRIVATE_BUSINESS_BRIEF|PRIVATE_ROI_TARGET|PRIVATE_SOURCE_TEXT|PRIVATE_SCHEMA_FIELD/,
    );
    expect(serialized).not.toContain('objectTypeDefinitions');
    expect(serialized).not.toContain('sourceBundle');
    expect(serialized).not.toContain('businessCard');
  });

  it('uses the cross-language canonical digest vector and resolves a valid one-step app', () => {
    const accepted = artifact();
    expect(accepted.digests).toEqual({
      appDefinition:
        'sha256:81b9fd99476934625a797d8e6eb00857cf701251f3254218f7863f64276ebfc4',
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
});
