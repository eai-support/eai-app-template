import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { generateApplicationPackage } from '../scripts/generate-application-package.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(await readFile(path.join(root, 'eai.application.json'), 'utf8'));

test('generates the deterministic default private isolated package', () => {
  const first = generateApplicationPackage(source);
  const second = generateApplicationPackage(source);
  assert.deepEqual(first, second);
  assert.equal(first.applicationPackage.distribution.visibility, 'private');
  assert.equal(first.applicationPackage.runtime.type, 'isolated-hosted');
  assert.match(first.digest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.canonical.includes('\n'), false);
  assert.equal(first.digest, 'sha256:aa5637175f08a85def0b8a7963c6ecbe92ceec0bf211befa5edb582d4049bdff');
});

test('permits EAI first-party embedded packages only', () => {
  const value = structuredClone(source);
  value.publisher.kind = 'eai';
  value.distribution.visibility = 'first-party';
  value.runtime = {
    type: 'trusted-embedded',
    topology: 'eai-owned-embedded',
    staticImport: '@enterpriseaigroup/demo',
  };
  assert.equal(generateApplicationPackage(value).applicationPackage.runtime.type, 'trusted-embedded');
});

test('requires distributable customer and partner packages to be isolated', () => {
  const value = structuredClone(source);
  value.distribution.visibility = 'distributable';
  value.runtime = {
    type: 'trusted-embedded',
    topology: 'eai-owned-embedded',
    staticImport: '@enterpriseaigroup/demo',
  };
  assert.throws(() => generateApplicationPackage(value), /Invalid application package/);
});
