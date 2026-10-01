import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, cpSync, mkdtempSync, openSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return `sha256:${createHash('sha256').update(`${canonical(value)}\n`).digest('hex')}`;
}

function fixture() {
  const appDefinition = {
    schemaVersion: 'eai.generated_app_definition.v2',
    appKey: 'fleet-demo', appName: 'Fleet Demo',
    businessCard: {
      description: 'Manage cars', goal: 'See availability',
      audience: 'Fleet manager', outcome: 'Faster decisions',
    },
    workflow: { steps: [{ id: 'fleet', title: 'Fleet', viewId: 'fleet-view' }] },
    views: [{ id: 'fleet-view', title: 'Fleet', componentIds: ['fleet-table'],
      safeUi: { version: 'eai.safe_ui.v1', root: { kind: 'stack', direction: 'column', gap: 'md', children: [
        { kind: 'heading', level: 1, text: 'Fleet dashboard' },
        { kind: 'table', componentId: 'fleet-table', fixtureCollection: 'vehicles',
          columns: [{ field: 'name', label: 'Car' }] },
        { kind: 'button', label: 'Book', actionId: 'book-car' },
      ] } },
    }],
    entryPath: 'src/generated/app.tsx',
  };
  const source = [
    "'use client';",
    "import type { GeneratedDemoAppProps } from '@/lib/generated-demo/contract';",
    'export default function GeneratedApp(_props: GeneratedDemoAppProps) {',
    '  return <p>UNTRUSTED_SOURCE_RENDERED</p>;',
    '}',
  ].join('\n');
  const sourceBundle = {
    schemaVersion: 'eai.generated_app_source.v1',
    files: [{ path: 'src/generated/app.tsx', content: source }],
  };
  const previewFixtures = {
    schemaVersion: 'eai.generated_app_fixtures.v1',
    collections: { vehicles: [{ id: 'car-1', name: 'Sample car' }] },
    actions: { 'book-car': { effect: 'session-local', message: 'Simulated booking' } },
  };
  const objectTypeDefinitions = [];
  return { source, artifact: {
    schemaVersion: 'eai.generated_app_artifact.v2',
    appDefinition, sourceBundle, previewFixtures, objectTypeDefinitions,
    digests: {
      appDefinition: digest(appDefinition), sourceBundle: digest(sourceBundle),
      previewFixtures: digest(previewFixtures),
      objectTypeDefinitions: digest(objectTypeDefinitions),
    },
  } };
}

async function freePort() {
  const server = createServer();
  await new Promise((ready, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', ready);
  });
  const port = server.address().port;
  await new Promise((closed) => server.close(closed));
  return port;
}

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Next server exited ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((wait) => setTimeout(wait, 200));
  }
  throw new Error('Next server did not become ready');
}

async function buildFixture(temp, env) {
  const logPath = join(temp, 'build.log');
  const log = openSync(logPath, 'w');
  const child = spawn('npm', ['run', 'build'], {
    cwd: temp, env, detached: true, stdio: ['ignore', log, log],
  });
  closeSync(log);
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  }, 600_000);
  try {
    const [code, signal] = await new Promise((done, reject) => {
      child.once('error', reject);
      child.once('exit', (...result) => done(result));
    });
    assert.equal(code, 0, `Fixture build ${timedOut ? 'timed out' : `exited ${signal ?? code}`}\n${readFileSync(logPath, 'utf8')}`);
  } finally {
    clearTimeout(timeout);
  }
}

test('production demo renders reviewed components without executing generated source or making egress requests',
  { timeout: 660_000 }, async () => {
    const temp = mkdtempSync(join(dirname(root), 'eai-demo-safe-ui-'));
    let server;
    let browser;
    try {
      cpSync(root, temp, { recursive: true, filter: (sourcePath) => {
        const path = relative(root, sourcePath);
        if (!path) return true;
        const first = path.split('/')[0];
        return !['.git', '.next', 'node_modules', '.eai-build', 'playwright-report', 'test-results'].includes(first) &&
          !basename(sourcePath).startsWith('.env') && basename(sourcePath) !== '.npmrc';
      } });
      symlinkSync(join(root, 'node_modules'), join(temp, 'node_modules'), 'dir');
      const { source, artifact } = fixture();
      writeFileSync(join(temp, 'src/generated/app.tsx'), source);
      writeFileSync(join(temp, 'src/eai.config/generated-demo.json'), `${JSON.stringify(artifact, null, 2)}\n`);
      const basePath = process.env.EAI_TEST_BASE_PATH ?? '';
      const env = { ...process.env, APP_BASE_PATH: basePath,
        NEXT_PUBLIC_APP_BASE_PATH: basePath, EAI_PRODUCT_SLUG: 'fleet-demo',
        AUTH_SECRET: 'local-isolation-test-secret', AUTH_TRUST_HOST: 'true' };
      await buildFixture(temp, env);
      const port = await freePort();
      const origin = `http://127.0.0.1:${port}`;
      const appUrl = `${origin}${basePath}`;
      server = spawn(process.execPath,
        [join(temp, 'node_modules/next/dist/bin/next'), 'start',
          '--hostname', '127.0.0.1', '--port', String(port)],
        { cwd: temp, env, stdio: 'ignore' });
      await waitForServer(`${appUrl}/health`, server);
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      const egress = [];
      const apiRequests = [];
      page.on('request', (request) => {
        if (!request.url().startsWith(origin)) egress.push(request.url());
        if (request.url().includes('/api/eai/')) apiRequests.push(request.url());
      });
      const response = await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
      assert.equal(response.status(), 200);
      await page.getByRole('region', { name: 'Safe app preview' }).getByRole('heading', { name: 'Fleet dashboard' }).waitFor();
      assert.equal(await page.getByRole('cell', { name: 'Sample car' }).textContent(), 'Sample car');
      assert.equal(await page.locator('iframe').count(), 0);
      assert.doesNotMatch(await page.content(), /UNTRUSTED_SOURCE_RENDERED|local-isolation-test-secret/);
      const baselineApiRequests = apiRequests.length;
      await page.getByRole('button', { name: 'Book' }).click();
      assert.match(await page.getByText(/This was a simulation/).textContent(), /Simulated booking/);
      assert.deepEqual(egress, []);
      assert.equal(apiRequests.length, baselineApiRequests);
      const deletedRoute = await page.request.get(`${appUrl}/eai-demo-frame`);
      assert.equal(deletedRoute.status(), 404);
      assert.equal(await page.locator('[data-eai-demo-source-digest]').getAttribute('data-eai-demo-source-digest'),
        artifact.digests.sourceBundle);
    } finally {
      await browser?.close();
      server?.kill('SIGTERM');
      rmSync(temp, { recursive: true, force: true });
    }
  });
