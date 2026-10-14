import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import {
  buildProducerManifest,
  serializeProducerManifest,
} from '../scripts/generate-producer-manifest.mjs';

const REPOSITORY = 'eai-support/eai-app-template';
const REPOSITORY_ID = '1205696460';
const WORKFLOW = '.github/workflows/eai-app.yml';
const COLLECTOR = 'scripts/source-unknown-deployment-evidence.mjs';
const RELEASE = '.github/workflows/release.yml';

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root }).toString('utf8').trim();
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'eai-producer-manifest-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q');
  git(root, 'config', 'user.name', 'Manifest Test');
  git(root, 'config', 'user.email', 'manifest@example.test');
  for (const [path, bytes] of [
    [WORKFLOW, 'name: app\n'],
    [COLLECTOR, 'console.log("collector");\n'],
    [RELEASE, 'name: release\n'],
  ]) {
    const absolute = join(root, path);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, bytes);
  }
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'source');
  git(root, 'tag', 'v1.0.18');
  return root;
}

function generate(root, overrides = {}) {
  return buildProducerManifest({
    root,
    tag: 'v1.0.18',
    repository: REPOSITORY,
    repositoryId: REPOSITORY_ID,
    ...overrides,
  });
}

test('binds deterministic bytes to the tagged Git tree, not working-tree edits', (t) => {
  const root = fixture(t);
  const first = generate(root);
  const bytes = serializeProducerManifest(first);
  assert.equal(first.sourceCommitSha, git(root, 'rev-parse', 'HEAD'));
  assert.equal(first.repositoryId, REPOSITORY_ID);
  assert.equal(
    first.producer.workflowSha256,
    `sha256:${createHash('sha256').update('name: app\n').digest('hex')}`,
  );
  assert.equal(
    first.producer.collectorSha256,
    `sha256:${createHash('sha256').update('console.log("collector");\n').digest('hex')}`,
  );
  assert.equal(bytes.at(-1), 10);
  writeFileSync(join(root, WORKFLOW), 'name: unreviewed-edit\n');
  assert.deepEqual(serializeProducerManifest(generate(root)), bytes);
});

test('rejects another repository, unsigned version, or moved tag', (t) => {
  const root = fixture(t);
  assert.throws(() => generate(root, { repositoryId: '1' }), /canonical template/);
  assert.throws(() => generate(root, { repository: 'attacker/template' }), /canonical template/);
  assert.throws(() => generate(root, { tag: 'v1.0.19' }), /rev-parse/);
  assert.throws(() => generate(root, { tag: 'latest' }), /vMAJOR/);
  writeFileSync(join(root, COLLECTOR), 'changed\n');
  git(root, 'add', COLLECTOR);
  git(root, 'commit', '-qm', 'move HEAD past tag');
  assert.throws(() => generate(root), /exact checked-out commit/);
});

test('rejects a symlink producer blob', (t) => {
  const root = fixture(t);
  rmSync(join(root, WORKFLOW));
  symlinkSync('../../outside', join(root, WORKFLOW));
  git(root, 'add', WORKFLOW);
  git(root, 'commit', '-qm', 'replace workflow');
  git(root, 'tag', '-f', 'v1.0.18');
  assert.throws(() => generate(root), /regular Git blob/);
});
