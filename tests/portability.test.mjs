import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { validatePaths, checkDirectory } from '../scripts/check-portability.mjs';

const checker = fileURLToPath(new URL('../scripts/check-portability.mjs', import.meta.url));
const cleaner = fileURLToPath(new URL('../scripts/clean.mjs', import.meta.url));

for (const path of ['src/page.html\r', 'gofer:side.md', 'src/CON.txt', 'NUL', 'COM1.json', 'LPT².txt', 'src/trailing.', 'src/trailing ', 'src/a\\b', 'src/a\n.js', 'src/a?.js']) {
  test(`rejects ${JSON.stringify(path)}`, () => assert.equal(validatePaths([path]).length, 1));
}
test('rejects case and Unicode normalization collisions without selecting a winner', () => {
  assert.equal(validatePaths(['src/Foo.ts', 'src/foo.ts']).length, 1);
  assert.equal(validatePaths(['caf\u00e9.ts', 'cafe\u0301.ts']).length, 1);
  assert.deepEqual(validatePaths(['src/foo.ts', 'src/food.ts', '.env.example', 'run.ps1']), []);
});
test('checks a generated project without Git and excludes dependency/build output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'eai-portability-'));
  try {
    await mkdir(join(root, 'src'));
    await writeFile(join(root, 'src', 'page.tsx'), 'export default 1');
    await mkdir(join(root, 'node_modules'));
    await symlink(join(root, 'src'), join(root, 'node_modules', 'linked-dependency'), 'junction');
    assert.deepEqual(await checkDirectory(root), []);
    const result = spawnSync(process.execPath, [checker, root], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    await writeFile(join(root, 'run.sh'), '#!/bin/sh\r\necho ok\r\n');
    assert.match((await checkDirectory(root)).join('\n'), /Shell script requires LF/);
    await rm(join(root, 'run.sh'));
    await symlink(join(root, 'src'), join(root, 'linked-source'), 'junction');
    const invalid = spawnSync(process.execPath, [checker, root], { encoding: 'utf8' });
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /Non-portable symlink/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('cleanup preserves source, lockfile and configuration and is idempotent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'eai-clean-'));
  try {
    for (const name of ['package-lock.json', '.env.local', 'source.ts']) await writeFile(join(root, name), name);
    for (const name of ['node_modules', '.next']) await mkdir(join(root, name));
    const run = mode => spawnSync(process.execPath, [cleaner, mode], { cwd: root, encoding: 'utf8' });
    assert.equal(run('invalid').status, 1);
    assert.equal(run('build').status, 0);
    assert.equal(await readFile(join(root, 'package-lock.json'), 'utf8'), 'package-lock.json');
    await assert.rejects(readFile(join(root, '.next')), { code: 'ENOENT' });
    for (let i = 0; i < 2; i++) assert.equal(run('install').status, 0);
    await assert.rejects(readFile(join(root, 'node_modules')), { code: 'ENOENT' });
    for (const name of ['package-lock.json', '.env.local', 'source.ts']) assert.equal(await readFile(join(root, name), 'utf8'), name);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('standalone startup includes public and compiled static assets', async () => {
  const root = await mkdtemp(join(tmpdir(), 'eai-start-'));
  try {
    for (const path of ['public', '.next/static', '.next/standalone']) await mkdir(join(root, path), { recursive: true });
    await writeFile(join(root, 'public', 'logo.txt'), 'public asset');
    await writeFile(join(root, '.next/static', 'bundle.js'), 'compiled asset');
    await writeFile(join(root, '.next/standalone/server.js'), 'console.log("standalone server started")');
    const script = fileURLToPath(new URL('../scripts/start-local-production.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /standalone server started/);
    assert.equal(await readFile(join(root, '.next/standalone/public/logo.txt'), 'utf8'), 'public asset');
    assert.equal(await readFile(join(root, '.next/standalone/.next/static/bundle.js'), 'utf8'), 'compiled asset');
    await rm(join(root, 'public'), { recursive: true });
    assert.equal(spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' }).status, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
