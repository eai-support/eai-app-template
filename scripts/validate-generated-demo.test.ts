import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { demoArtifactDigest } from '../src/lib/generated-demo/runtime-contract';

const root = process.cwd();

function validateSource(
  content: string,
  extra?: { path: string; content: string },
) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'eai-demo-source-policy-'));
  try {
    const sourceBundle = {
      schemaVersion: 'eai.generated_app_source.v1',
      files: [
        { path: 'src/generated/app.tsx', content },
        ...(extra ? [extra] : []),
      ],
    };
    const appDefinition = {
      schemaVersion: 'eai.generated_app_definition.v2',
      appKey: 'fleet-demo',
      appName: 'Fleet Demo',
      businessCard: {
        description: 'Manage cars',
        goal: 'See availability',
        audience: 'Fleet manager',
        outcome: 'Faster decisions',
      },
      workflow: {
        steps: [{ id: 'fleet', title: 'Fleet', viewId: 'fleet-view' }],
      },
      views: [
        { id: 'fleet-view', title: 'Fleet', componentIds: ['fleet-table'] },
      ],
      entryPath: 'src/generated/app.tsx',
    };
    const previewFixtures = {
      schemaVersion: 'eai.generated_app_fixtures.v1',
      collections: { vehicles: [{ id: 'car-1', name: 'Sample car' }] },
      actions: {},
    };
    const objectTypeDefinitions: object[] = [];
    const artifact = {
      schemaVersion: 'eai.generated_app_artifact.v2',
      appDefinition,
      sourceBundle,
      previewFixtures,
      objectTypeDefinitions,
      digests: {
        appDefinition: demoArtifactDigest(appDefinition),
        sourceBundle: demoArtifactDigest(sourceBundle),
        previewFixtures: demoArtifactDigest(previewFixtures),
        objectTypeDefinitions: demoArtifactDigest(objectTypeDefinitions),
      },
    };
    const files = [
      {
        path: 'scripts/validate-generated-demo.cjs',
        content: readFileSync(
          join(root, 'scripts/validate-generated-demo.cjs'),
          'utf8',
        ),
      },
      {
        path: 'src/lib/generated-demo/runtime-contract.ts',
        content: readFileSync(
          join(root, 'src/lib/generated-demo/runtime-contract.ts'),
          'utf8',
        ),
      },
      {
        path: 'src/eai.config/generated-demo.json',
        content: JSON.stringify(artifact),
      },
      ...sourceBundle.files,
    ];
    for (const file of files) {
      const path = join(fixtureRoot, file.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file.content);
    }
    symlinkSync(join(root, 'node_modules'), join(fixtureRoot, 'node_modules'));
    const result = spawnSync(
      process.execPath,
      [join(fixtureRoot, 'scripts/validate-generated-demo.cjs')],
      {
        cwd: fixtureRoot,
        encoding: 'utf8',
        timeout: 15_000,
      },
    );
    return {
      status: result.status,
      output: `${result.stdout}${result.stderr}`,
    };
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

describe('generated demo build source guard', () => {
  it('accepts a safe view with only source-bound components', () => {
    const result = validateSource(
      "import type { GeneratedDemoAppProps } from '@/lib/generated-demo/contract'; import { Button, Card } from '@enterpriseaigroup/core'; import { useState } from 'react'; import { Car } from 'lucide-react'; import { title } from './title'; export default function App({viewId}:GeneratedDemoAppProps) { const [count,setCount] = useState(0); return <Card><Button onClick={() => setCount(count + 1)}><Car />{title} {viewId} {count}</Button></Card>; }",
      {
        path: 'src/generated/title.ts',
        content: "export const title = 'Fleet';",
      },
    );
    expect(result.status).toBe(0);
    expect(result.output).toContain('generated demo source guard passed');
  });

  it.each([
    [
      "import { GeneratedDemoAppProps } from '@/lib/generated-demo/contract'; export default function App() { return <main />; }",
      'import @/lib/generated-demo/contract is not allowed',
    ],
    [
      "const helper = import('./title'); export default function App() { return <main />; }",
      'dynamic import is not allowed',
    ],
    [
      "import { getAccessToken } from '@enterpriseaigroup/core/server'; export default function App() { return <main />; }",
      'import @enterpriseaigroup/core/server is not allowed',
    ],
    [
      "import { secret } from './unlisted'; export default function App() { return <main />; }",
      'import ./unlisted is not allowed',
    ],
    [
      "import { x } from '../lib/platform'; export default function App() { return <main />; }",
      'import ../lib/platform is not allowed',
    ],
    [
      "export default function App() { fetch('/api/eai/private'); return <main />; }",
      'fetch is not allowed',
    ],
    [
      "export default function App() { return <iframe src='https://example.com' />; }",
      '<iframe> is not allowed',
    ],
    [
      "export default function App() { return <div dangerouslySetInnerHTML={{__html:'x'}} />; }",
      'navigation-capable markup is not allowed',
    ],
    [
      "export default function App() { self.location.assign('https://example.invalid/collect'); return <main />; }",
      'self is not allowed',
    ],
    [
      "export default function App() { return <a href='https://example.invalid/collect'>Leave</a>; }",
      '<a> is not allowed',
    ],
    [
      "import * as React from 'react'; export default function App() { return React.createElement('a', {href:'https://example.invalid'}); }",
      'browser navigation or DOM mutation is not allowed',
    ],
    [
      "export default function App() { return <div {...{onClick: () => location.assign('https://example.invalid')}} />; }",
      'navigation-capable markup is not allowed',
    ],
  ])('rejects unsafe source %s', (content, error) => {
    const result = validateSource(content);
    expect(result.status).toBe(1);
    expect(result.output).toContain(error);
  });

  it('rejects external CSS resources', () => {
    for (const content of [
      ".demo { background: url('https://example.com/x'); }",
      '.demo { background: u\\72l(https://example.com/x); }',
      '.demo { background: image-set("https://example.com/x" 1x); }',
      '@\\69mport "https://example.com/x.css";',
    ]) {
      const result = validateSource(
        "import './styles.css'; export default function App() { return <main />; }",
        { path: 'src/generated/styles.css', content },
      );
      expect(result.status).toBe(1);
      expect(result.output).toContain('external CSS imports are forbidden');
    }
  });
});
