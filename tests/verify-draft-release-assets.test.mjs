import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { verifyDraftReleaseAssets } from '../scripts/verify-draft-release-assets.mjs';

const MANIFEST = 'producer-manifest.json';
const BUNDLE = 'producer-manifest.sigstore.json';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'eai-draft-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const local = join(root, 'local');
  const downloaded = join(root, 'downloaded');
  mkdirSync(local);
  mkdirSync(downloaded);
  for (const directory of [local, downloaded]) {
    writeFileSync(
      join(directory, MANIFEST),
      '{"schemaVersion":"eai.template_producer_manifest.v1"}\n',
    );
    writeFileSync(join(directory, BUNDLE), '{"verificationMaterial":{}}\n');
  }
  return { local, downloaded };
}

test('accepts only byte-identical draft manifest and attestation bundle', (t) => {
  const { local, downloaded } = fixture(t);
  assert.doesNotThrow(() => verifyDraftReleaseAssets(local, downloaded));
});

for (const asset of [MANIFEST, BUNDLE]) {
  test(`rejects a changed downloaded ${asset}`, (t) => {
    const { local, downloaded } = fixture(t);
    writeFileSync(
      join(downloaded, asset),
      `${readFileSync(join(local, asset))} `,
    );
    assert.throws(
      () => verifyDraftReleaseAssets(local, downloaded),
      /SHA-256 mismatch/,
    );
  });
  test(`rejects an empty or symlinked downloaded ${asset}`, (t) => {
    const { local, downloaded } = fixture(t);
    writeFileSync(join(downloaded, asset), '');
    assert.throws(
      () => verifyDraftReleaseAssets(local, downloaded),
      /nonempty regular file/,
    );
    rmSync(join(downloaded, asset));
    symlinkSync(join(local, asset), join(downloaded, asset));
    assert.throws(
      () => verifyDraftReleaseAssets(local, downloaded),
      /nonempty regular file/,
    );
  });
}

test('rejects missing or unexpected draft assets', (t) => {
  const { local, downloaded } = fixture(t);
  rmSync(join(downloaded, BUNDLE));
  assert.throws(
    () => verifyDraftReleaseAssets(local, downloaded),
    /asset names differ/,
  );
  writeFileSync(join(downloaded, BUNDLE), 'bundle');
  writeFileSync(join(downloaded, 'other.txt'), 'unexpected');
  assert.throws(
    () => verifyDraftReleaseAssets(local, downloaded),
    /asset names differ/,
  );
});

test('the release workflow gates immutability and compares assets on both sides of publication', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/release.yml', import.meta.url),
    'utf8',
  );
  const preflight = workflow.indexOf(
    '"repos/${GITHUB_REPOSITORY}/immutable-releases"',
  );
  const tagPush = workflow.indexOf('git push origin "refs/tags/$TAG"');
  const firstVerify = workflow.indexOf(
    'node scripts/verify-draft-release-assets.mjs',
  );
  const publish = workflow.indexOf('gh release edit "$TAG" --draft=false');
  const secondVerify = workflow.indexOf(
    'node scripts/verify-draft-release-assets.mjs',
    publish,
  );
  const secondPreflight = workflow.indexOf(
    '"repos/${GITHUB_REPOSITORY}/immutable-releases"',
    firstVerify,
  );
  const firstTagReadback = workflow.indexOf(
    'git ls-remote origin "refs/tags/${TAG}^{}"',
  );
  const secondTagReadback = workflow.indexOf(
    'git ls-remote origin "refs/tags/${TAG}^{}"',
    publish,
  );
  assert.ok(preflight >= 0 && tagPush > preflight);
  assert.ok(
    firstVerify > tagPush && publish > firstVerify && secondVerify > publish,
  );
  assert.ok(secondPreflight > firstVerify && secondPreflight < publish);
  assert.ok(firstTagReadback > tagPush && firstTagReadback < publish);
  assert.ok(secondTagReadback > publish && secondTagReadback < secondVerify);
});
