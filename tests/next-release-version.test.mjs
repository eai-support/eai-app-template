import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FIRST_RELEASE,
  nextReleaseVersion,
} from '../scripts/next-release-version.mjs';

test('starts at the first release when the repository has no tags', () => {
  assert.equal(nextReleaseVersion('', 'patch'), FIRST_RELEASE);
  assert.equal(nextReleaseVersion(null, 'minor'), FIRST_RELEASE);
  assert.equal(nextReleaseVersion(undefined), FIRST_RELEASE);
});

test('bumps each semver segment and resets the lower ones', () => {
  assert.equal(nextReleaseVersion('v1.4.9', 'patch'), '1.4.10');
  assert.equal(nextReleaseVersion('v1.4.9', 'minor'), '1.5.0');
  assert.equal(nextReleaseVersion('v1.4.9', 'major'), '2.0.0');
});

test('defaults to a patch bump', () => {
  assert.equal(nextReleaseVersion('v2.0.0'), '2.0.1');
});

test('compares segments numerically rather than as text', () => {
  assert.equal(nextReleaseVersion('v1.9.10', 'patch'), '1.9.11');
  assert.equal(nextReleaseVersion('v1.10.0', 'minor'), '1.11.0');
});

test('rejects a malformed latest tag instead of restarting numbering', () => {
  // Restarting at 1.0.0 here would hand consumers a version that moves
  // backwards against the tag they are already pinned to.
  assert.throws(() => nextReleaseVersion('release-3', 'patch'), /not a vMAJOR/);
  assert.throws(() => nextReleaseVersion('v1.2', 'patch'), /not a vMAJOR/);
  assert.throws(() => nextReleaseVersion('1.2.3', 'patch'), /not a vMAJOR/);
});

test('rejects an unsupported bump', () => {
  assert.throws(() => nextReleaseVersion('v1.0.0', 'rebuild'), /Unsupported bump/);
});
