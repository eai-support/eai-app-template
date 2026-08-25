import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

test('documents the provider-neutral AI workspace handoff', () => {
  assert.match(readme, /eai start --check/);
  assert.match(readme, /eai start/);
  assert.match(readme, /business outcome/i);
  assert.match(readme, /business specification/i);
  assert.match(readme, /provider to read the\s+project/i);
  assert.match(
    readme,
    /treat each agent chat in this repository\s+as if the public `eai` entrypoint is active/i
  );
  assert.doesNotMatch(readme, /\/0_business_scenario/);
});

test('documents and exposes Gofer app test script aliases', () => {
  for (const script of [
    'verify',
    'test:smoke',
    'test:business-scenarios',
    'test:e2e',
    'test:playwright',
  ]) {
    assert.equal(typeof packageJson.scripts[script], 'string', `${script} is missing`);
    assert.match(readme, new RegExp(script.replace(':', ':'), 'i'));
  }

  assert.match(packageJson.scripts['test:business-scenarios'], /tests\/business-scenarios/);
  assert.match(packageJson.scripts['test:e2e'], /tests\/e2e/);
  assert.doesNotMatch(packageJson.scripts['test:business-scenarios'], /pass-with-no-tests/);
  assert.doesNotMatch(packageJson.scripts['test:e2e'], /pass-with-no-tests/);
  assert.match(readme, /A screenshot is only visual evidence/i);
});

test('includes real browser tests for Gofer release gates', async () => {
  await access(new URL('./business-scenarios/starter-app.spec.ts', import.meta.url));
  await access(new URL('./e2e/platform-readiness.spec.ts', import.meta.url));
});
