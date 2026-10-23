import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TRUSTED_REPOSITORY = 'eai-support/eai-app-template';
const TRUSTED_REPOSITORY_ID = '1205696460';
const PRODUCER_WORKFLOW = '.github/workflows/eai-app.yml';
const EVIDENCE_COLLECTOR = 'scripts/source-unknown-deployment-evidence.mjs';
const RELEASE_WORKFLOW = '.github/workflows/release.yml';
const RELEASE_TAG = /^v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
}

function sourceBytes(root, commit, path) {
  const entry = git(root, 'ls-tree', commit, '--', path).toString('utf8').trimEnd();
  const match = /^(100644|100755) blob [a-f0-9]{40,64}\t(.+)$/.exec(entry);
  if (!match || match[2] !== path) {
    throw new Error(`Release source ${path} is absent or not a regular Git blob`);
  }
  return git(root, 'show', `${commit}:${path}`);
}

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

export function buildProducerManifest({ root, tag, repository, repositoryId }) {
  if (repository !== TRUSTED_REPOSITORY || repositoryId !== TRUSTED_REPOSITORY_ID) {
    throw new Error('Only the canonical template repository can generate a producer manifest');
  }
  if (!RELEASE_TAG.test(tag)) {
    throw new Error('Release tag must be an exact vMAJOR.MINOR.PATCH version');
  }
  const commit = git(root, 'rev-parse', 'HEAD').toString('utf8').trim();
  const taggedCommit = git(root, 'rev-parse', '--verify', `refs/tags/${tag}^{commit}`)
    .toString('utf8')
    .trim();
  if (taggedCommit !== commit || !/^[a-f0-9]{40}$/.test(commit)) {
    throw new Error('Release tag must resolve to the exact checked-out commit');
  }

  // Read Git blobs, not working-tree files, so a later build step cannot alter the sealed producer.
  return {
    schemaVersion: 'eai.template_producer_manifest.v1',
    repository: TRUSTED_REPOSITORY,
    repositoryId: TRUSTED_REPOSITORY_ID,
    releaseTag: tag,
    sourceCommitSha: commit,
    releaseWorkflowPath: RELEASE_WORKFLOW,
    producer: {
      workflowPath: PRODUCER_WORKFLOW,
      workflowSha256: sha256(sourceBytes(root, commit, PRODUCER_WORKFLOW)),
      collectorPath: EVIDENCE_COLLECTOR,
      collectorSha256: sha256(sourceBytes(root, commit, EVIDENCE_COLLECTOR)),
    },
  };
}

export function serializeProducerManifest(manifest) {
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== '--tag' || args[2] !== '--out') {
    throw new Error('Usage: node scripts/generate-producer-manifest.mjs --tag vX.Y.Z --out PATH');
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = buildProducerManifest({
    root,
    tag: args[1],
    repository: process.env.GITHUB_REPOSITORY,
    repositoryId: process.env.GITHUB_REPOSITORY_ID,
  });
  const output = resolve(args[3]);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, serializeProducerManifest(manifest), { flag: 'wx' });
}
