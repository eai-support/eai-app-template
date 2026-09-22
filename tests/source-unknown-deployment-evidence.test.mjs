import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidenceScript = join(
  repoRoot,
  'scripts/source-unknown-deployment-evidence.mjs',
);
const workflowPath = join(repoRoot, '.github/workflows/eai-app.yml');
const digestPattern = /^sha256:[a-f0-9]{64}$/;

function writeFixtureApp(root) {
  mkdirSync(join(root, '.next/standalone'), { recursive: true });
  mkdirSync(join(root, '.next/static'), { recursive: true });
  mkdirSync(join(root, 'src/eai.config'), { recursive: true });
  mkdirSync(join(root, 'tests/fixtures/schema-provenance'), {
    recursive: true,
  });
  mkdirSync(join(root, '.eai-build'), { recursive: true });

  writeFileSync(
    join(root, '.next/standalone/server.js'),
    'console.log("ok");\n',
  );
  writeFileSync(join(root, '.next/static/app.js'), 'static\n');
  writeFileSync(join(root, 'package.json'), '{"name":"fixture-app"}\n');
  writeFileSync(
    join(root, 'eai.runtime.json'),
    JSON.stringify({
      runtime: 'fixture',
      schemaProvenance: JSON.parse(
        readFileSync(
          join(repoRoot, 'tests/fixtures/schema-provenance/valid.json'),
          'utf8',
        ),
      ),
    }),
  );
  writeFileSync(
    join(root, 'src/eai.config/object-types.json'),
    '{"types":[]}\n',
  );
  writeFileSync(
    join(root, '.eai-build/eai-generated-app-image.tar'),
    'oci image archive fixture\n',
  );

  cpSync(
    join(repoRoot, 'tests/fixtures/schema-provenance/valid.json'),
    join(root, 'tests/fixtures/schema-provenance/valid.json'),
  );
}

function runEvidenceScript(args, options = {}) {
  return execFileSync(process.execPath, [evidenceScript, ...args], {
    encoding: 'utf8',
    ...options,
  });
}

test('collect writes source-unknown handoff evidence and GitHub outputs', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-source-unknown-evidence-'));
  try {
    const fixtureRoot = join(workDir, 'app');
    const outputFile = join(workDir, 'github-output.txt');
    writeFixtureApp(fixtureRoot);

    const stdout = runEvidenceScript([
      'collect',
      '--root',
      fixtureRoot,
      '--app-key',
      'rates-review',
      '--tenant-id',
      'tenant-parent',
      '--repo',
      'enterpriseaigroup/rates-review',
      '--workflow',
      '.github/workflows/eai-app.yml',
      '--ref',
      'refs/heads/main',
      '--branch',
      'main',
      '--commit',
      'abcdef1234567890abcdef1234567890abcdef12',
      '--workflow-run-id',
      '123456789',
      '--workflow-run-attempt',
      '1',
      '--operation-id',
      'source-op-1',
      '--nonce',
      'single-use-nonce',
      '--expected-config-hash',
      runEvidenceScript(['config-hash', '--root', fixtureRoot]).trim(),
      '--artifact-id',
      '987654321',
      '--artifact-digest',
      `sha256:${'d'.repeat(64)}`,
      '--image-digest',
      `sha256:${'c'.repeat(64)}`,
      '--github-output',
      outputFile,
    ]);

    const evidencePath = join(
      fixtureRoot,
      '.eai-build/evidence/source-unknown-deployment-evidence.json',
    );
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    assert.deepEqual(JSON.parse(stdout), evidence);
    assert.equal(evidence.operationId, 'source-op-1');
    assert.equal(evidence.validationSummary.status, 'passed');
    assert.match(evidence.configHash, digestPattern);
    assert.match(evidence.artifactDigest, digestPattern);
    assert.match(evidence.imageArtifact.archiveDigest, digestPattern);
    assert.match(evidence.imageDigest, digestPattern);
    assert.equal(
      new Set([
        evidence.artifactDigest,
        evidence.imageArtifact.archiveDigest,
        evidence.imageDigest,
      ]).size,
      3,
    );

    const outputs = readFileSync(outputFile, 'utf8');
    for (const key of [
      'config_hash',
      'artifact_digest',
      'image_digest',
      'template_version',
      'base_template_sha',
      'schema_digest',
      'validator_digest',
    ]) {
      assert.match(outputs, new RegExp(`^${key}=`, 'm'));
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('workflow sends OIDC evidence directly to the canonical PublicAPI route', () => {
  const workflow = readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(
    workflow,
    /^  (push|pull_request|workflow_call|schedule):/m,
  );
  assert.match(workflow, /^  packages: read$/m);
  assert.match(workflow, /name: eai-generated-app-image/);
  assert.match(workflow, /--platform linux\/amd64/);
  assert.match(workflow, /vars\.EAI_PUBLIC_API_URL/);
  assert.match(workflow, /source-unknown\/workflow-evidence/);
  assert.doesNotMatch(workflow, /EAI_ACCESS_TOKEN/);
  assert.doesNotMatch(workflow, /publicapi_base_url/);
});

test('workflow runs independent validations concurrently and waits for both', () => {
  const workflow = readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /npm run typecheck &\n\s+typecheck_pid=\$!/);
  assert.match(workflow, /npm run test:unit:ci &\n\s+tests_pid=\$!/);
  assert.match(workflow, /wait "\$typecheck_pid" \|\| validation_status=1/);
  assert.match(workflow, /wait "\$tests_pid" \|\| validation_status=1/);
  assert.match(workflow, /exit "\$validation_status"/);
});

test('image context uses the runtime minimum Node major', () => {
  const workDir = mkdtempSync(
    join(tmpdir(), 'eai-source-unknown-image-context-'),
  );
  try {
    const fixtureRoot = join(workDir, 'app');
    writeFixtureApp(fixtureRoot);
    runEvidenceScript(['prepare-image-context', '--root', fixtureRoot]);
    assert.match(
      readFileSync(
        join(fixtureRoot, '.eai-build/image-context/Dockerfile'),
        'utf8',
      ),
      /^FROM node:24-alpine$/m,
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('schema provenance falls back to the compatibility fixture only when runtime provenance is absent', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-source-unknown-provenance-'));
  try {
    const fixtureRoot = join(workDir, 'app');
    const outputFile = join(workDir, 'github-output.txt');
    writeFixtureApp(fixtureRoot);
    writeFileSync(
      join(fixtureRoot, 'eai.runtime.json'),
      '{"runtime":"legacy"}\n',
    );
    runEvidenceScript([
      'collect',
      '--root',
      fixtureRoot,
      '--repo',
      'enterpriseaigroup/rates-review',
      '--ref',
      'refs/heads/main',
      '--branch',
      'main',
      '--commit',
      'abcdef1234567890abcdef1234567890abcdef12',
      '--artifact-id',
      '987654321',
      '--artifact-digest',
      `sha256:${'d'.repeat(64)}`,
      '--image-digest',
      `sha256:${'c'.repeat(64)}`,
      '--expected-config-hash',
      runEvidenceScript(['config-hash', '--root', fixtureRoot]).trim(),
      '--github-output',
      outputFile,
    ]);
    const evidence = JSON.parse(
      readFileSync(
        join(
          fixtureRoot,
          '.eai-build/evidence/source-unknown-deployment-evidence.json',
        ),
        'utf8',
      ),
    );
    assert.deepEqual(
      evidence.schemaProvenance,
      JSON.parse(
        readFileSync(
          join(fixtureRoot, 'tests/fixtures/schema-provenance/valid.json'),
          'utf8',
        ),
      ),
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('collect rejects a config hash that does not bind the checked-out files', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-source-unknown-tamper-'));
  try {
    const fixtureRoot = join(workDir, 'app');
    writeFixtureApp(fixtureRoot);
    const result = spawnSync(
      process.execPath,
      [
        evidenceScript,
        'collect',
        '--root',
        fixtureRoot,
        '--repo',
        'enterpriseaigroup/rates-review',
        '--ref',
        'refs/heads/main',
        '--branch',
        'main',
        '--commit',
        'abcdef1234567890abcdef1234567890abcdef12',
        '--artifact-id',
        '987654321',
        '--artifact-digest',
        `sha256:${'d'.repeat(64)}`,
        '--image-digest',
        `sha256:${'c'.repeat(64)}`,
        '--expected-config-hash',
        `sha256:${'f'.repeat(64)}`,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /config hash does not match/);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('assert-evidence-accepted accepts only accepted workflow evidence', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-source-unknown-handoff-'));
  try {
    for (const status of ['accepted']) {
      const responsePath = join(workDir, `deployment-response-${status}.json`);
      writeFileSync(
        responsePath,
        JSON.stringify({
          response: {
            status,
            deploymentRequestId: 'source-unknown-deploy-1',
            requiresTenantInfra: status === 'handoff_pending',
          },
        }),
      );

      const stdout = runEvidenceScript([
        'assert-evidence-accepted',
        '--response',
        responsePath,
      ]);
      assert.match(stdout, new RegExp(`^${status} source-unknown-deploy-1`));
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('assert-evidence-accepted rejects non-accepted responses', () => {
  const workDir = mkdtempSync(
    join(tmpdir(), 'eai-source-unknown-handoff-bad-'),
  );
  try {
    const responsePath = join(workDir, 'deployment-response-bad.json');
    writeFileSync(
      responsePath,
      JSON.stringify({
        response: {
          status: 'deployed',
          deploymentRequestId: 'source-unknown-deploy-1',
          requiresTenantInfra: false,
        },
      }),
    );

    const result = spawnSync(
      process.execPath,
      [evidenceScript, 'assert-evidence-accepted', '--response', responsePath],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Expected workflow evidence status accepted/);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});
