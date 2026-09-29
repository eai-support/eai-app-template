import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = '@enterpriseaigroup/application-package';
const EXPECTED_TARBALL_HOST = 'enterpriseaigroup.github.io';
const GENERATED_FILES = {
  schema: 'src/generated/application-package.schema.json',
  runtime: 'src/generated/application-package-runtime.mjs',
};

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

function fail(message) {
  throw new Error(`Application-package CI bootstrap rejected: ${message}`);
}

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function selectDependencySource({ eventName, published }) {
  if (published) return 'published';
  if (eventName === 'pull_request') return 'producer';
  fail('the locked package is unpublished and producer bootstrap is PR-only');
}

export async function readContractLock(root = repositoryRoot) {
  const lock = JSON.parse(
    await readFile(path.join(root, 'eai.application.schema-lock.json'), 'utf8'),
  );
  if (
    lock.validatorPackage !== PACKAGE_NAME ||
    lock.validatorVersion !== '0.1.0'
  ) {
    fail('schema lock does not name the exact application-package dependency');
  }
  for (const field of ['schemaSha256', 'runtimeSha256']) {
    if (!/^sha256:[a-f0-9]{64}$/u.test(lock[field] ?? ''))
      fail(`schema lock ${field} is invalid`);
  }
  return lock;
}

export async function readLockedTarballUrl(root = repositoryRoot) {
  const lock = JSON.parse(
    await readFile(path.join(root, 'package-lock.json'), 'utf8'),
  );
  const dependency = lock.packages?.[`node_modules/${PACKAGE_NAME}`];
  if (
    dependency?.version !== '0.1.0' ||
    typeof dependency.resolved !== 'string'
  ) {
    fail('package-lock does not pin application-package 0.1.0 to a tarball');
  }
  const url = new URL(dependency.resolved);
  if (url.protocol !== 'https:' || url.hostname !== EXPECTED_TARBALL_HOST) {
    fail(
      'locked application-package tarball is outside the approved static registry',
    );
  }
  return url.href;
}

export async function verifyContractDirectory(packageRoot, lock) {
  const contractLock = lock ?? (await readContractLock());
  for (const [kind, relativePath] of Object.entries(GENERATED_FILES)) {
    const bytes = await readFile(path.join(packageRoot, relativePath));
    const actual = `sha256:${sha256(bytes)}`;
    const expected = contractLock[`${kind}Sha256`];
    if (actual !== expected)
      fail(`${kind} bytes do not match the locked contract`);
  }
}

export async function verifyProducer(producerRoot, expectedCommit) {
  if (!/^[a-f0-9]{40}$/u.test(expectedCommit))
    fail('producer commit must be a full SHA');
  const actualCommit = execFileSync(
    'git',
    ['-C', producerRoot, 'rev-parse', 'HEAD'],
    {
      encoding: 'utf8',
    },
  ).trim();
  if (actualCommit !== expectedCommit)
    fail('producer checkout is not the approved exact commit');
  await verifyContractDirectory(
    path.join(producerRoot, 'packages/application-package'),
  );
}

function readTarEntry(tarballPath, entry) {
  try {
    return execFileSync('tar', ['-xOf', tarballPath, `package/${entry}`], {
      encoding: null,
      maxBuffer: 2 * 1024 * 1024,
    });
  } catch {
    fail(`packed dependency is missing ${entry}`);
  }
}

export async function verifyTarball(tarballPath, lock) {
  const contractLock = lock ?? (await readContractLock());
  const metadata = JSON.parse(
    readTarEntry(tarballPath, 'package.json').toString('utf8'),
  );
  if (
    metadata.name !== PACKAGE_NAME ||
    metadata.version !== contractLock.validatorVersion
  ) {
    fail('packed dependency has the wrong package identity');
  }
  for (const [kind, relativePath] of Object.entries(GENERATED_FILES)) {
    const actual = `sha256:${sha256(readTarEntry(tarballPath, relativePath))}`;
    if (actual !== contractLock[`${kind}Sha256`]) {
      fail(`packed ${kind} bytes do not match the locked contract`);
    }
  }
}

async function writeOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) fail('GITHUB_OUTPUT is required');
  await appendFile(outputPath, `${name}=${value}\n`);
}

async function resolveSource() {
  const tarballUrl = await readLockedTarballUrl();
  let published = false;
  try {
    const response = await fetch(tarballUrl, {
      method: 'HEAD',
      redirect: 'follow',
    });
    published = response.ok;
  } catch {
    published = false;
  }
  const source = selectDependencySource({
    eventName: process.env.GITHUB_EVENT_NAME ?? '',
    published,
  });
  await writeOutput('bootstrap', source === 'producer' ? 'true' : 'false');
  await writeOutput('published', published ? 'true' : 'false');
}

async function main() {
  const [command, target] = process.argv.slice(2);
  if (command === 'resolve') return resolveSource();
  if (command === 'verify-producer') {
    if (!target) fail('producer directory is required');
    return verifyProducer(
      path.resolve(target),
      process.env.APPLICATION_PACKAGE_PRODUCER_SHA ?? '',
    );
  }
  if (command === 'verify-tarball') {
    if (!target) fail('tarball path is required');
    return verifyTarball(path.resolve(target));
  }
  if (command === 'verify-installed') {
    return verifyContractDirectory(
      path.join(
        repositoryRoot,
        'node_modules/@enterpriseaigroup/application-package',
      ),
    );
  }
  fail('unknown command');
}

const isDirect =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) await main();
