import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  selectDependencySource,
  sha256,
  verifyContractDirectory,
} from '../scripts/ci-application-package-bootstrap.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('producer bootstrap is available only to pull-request validation', () => {
  assert.equal(
    selectDependencySource({ eventName: 'pull_request', published: false }),
    'producer',
  );
  assert.equal(
    selectDependencySource({ eventName: 'push', published: true }),
    'published',
  );
  assert.throws(
    () => selectDependencySource({ eventName: 'push', published: false }),
    /producer bootstrap is PR-only/,
  );
  assert.throws(
    () =>
      selectDependencySource({
        eventName: 'workflow_dispatch',
        published: false,
      }),
    /producer bootstrap is PR-only/,
  );
});

test('contract verification rejects a one-byte producer mutation', async () => {
  const temporaryRoot = await mkdtemp(
    path.join(os.tmpdir(), 'eai-package-bootstrap-'),
  );
  const generatedRoot = path.join(temporaryRoot, 'src/generated');
  const schema = Buffer.from('{"schema":"locked"}\n');
  const runtime = Buffer.from('export const locked = true;\n');
  const lock = {
    schemaSha256: `sha256:${sha256(schema)}`,
    runtimeSha256: `sha256:${sha256(runtime)}`,
  };
  try {
    await mkdir(generatedRoot, { recursive: true });
    await writeFile(
      path.join(generatedRoot, 'application-package.schema.json'),
      schema,
    );
    await writeFile(
      path.join(generatedRoot, 'application-package-runtime.mjs'),
      runtime,
    );
    await verifyContractDirectory(temporaryRoot, lock);

    await writeFile(
      path.join(generatedRoot, 'application-package-runtime.mjs'),
      `${runtime} `,
    );
    await assert.rejects(
      verifyContractDirectory(temporaryRoot, lock),
      /runtime bytes do not match the locked contract/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test('validation workflow pins the producer and preserves the published release path', async () => {
  const workflow = await readFile(
    path.join(root, '.github/workflows/ci.yml'),
    'utf8',
  );
  assert.match(
    workflow,
    /APPLICATION_PACKAGE_PRODUCER_SHA: caaf4fb0de88f63d2294a37cfd57772b8237d559/,
  );
  assert.match(
    workflow,
    /actions\/create-github-app-token@bcd2ba49218906704ab6c1aa796996da409d3eb1/,
  );
  assert.match(
    workflow,
    /repository: enterpriseaigroup\/enterpriseai-packages/,
  );
  assert.match(workflow, /permission-contents: read/);
  assert.match(
    workflow,
    /ref: \$\{\{ env\.APPLICATION_PACKAGE_PRODUCER_SHA \}\}/,
  );
  assert.match(
    workflow,
    /npm install --no-save\s+"\$\{\{ steps\.producer-package\.outputs\.tarball \}\}"\s+lightningcss-linux-x64-gnu@1\.30\.2\s+@tailwindcss\/oxide-linux-x64-gnu@4\.1\.18/,
  );
  assert.doesNotMatch(workflow, /npm install[^\n]*--package-lock=false/);
  assert.match(
    workflow,
    /name: Install Linux native CSS bindings\s+if: steps\.application-package-source\.outputs\.bootstrap != 'true'/,
  );
  assert.match(
    workflow,
    /if: steps\.application-package-source\.outputs\.bootstrap != 'true'/,
  );
  assert.match(workflow, /verify-installed/);

  const releaseWorkflow = await readFile(
    path.join(root, '.github/workflows/eai-app.yml'),
    'utf8',
  );
  assert.doesNotMatch(
    releaseWorkflow,
    /ci-application-package-bootstrap|producer-package/,
  );
  assert.match(releaseWorkflow, /run: npm install/);
});
