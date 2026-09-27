import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidenceScript = join(
  repoRoot,
  'scripts/source-unknown-deployment-evidence.mjs',
);
const workflowPath = join(repoRoot, '.github/workflows/eai-app.yml');
const readmePath = join(repoRoot, 'README.md');
const digestPattern = /^sha256:[a-f0-9]{64}$/;

function writeFixtureApp(root) {
  mkdirSync(join(root, '.next/standalone'), { recursive: true });
  mkdirSync(join(root, '.next/static'), { recursive: true });
  mkdirSync(join(root, 'src/eai.config'), { recursive: true });
  mkdirSync(join(root, 'tests/fixtures/schema-provenance'), {
    recursive: true,
  });
  mkdirSync(join(root, '.eai-build'), { recursive: true });
  mkdirSync(join(root, '.github/workflows'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });

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
  cpSync(workflowPath, join(root, '.github/workflows/eai-app.yml'));
  cpSync(evidenceScript, join(root, 'scripts/source-unknown-deployment-evidence.mjs'));
}

function runEvidenceScript(args, options = {}) {
  return execFileSync(process.execPath, [evidenceScript, ...args], {
    encoding: 'utf8',
    ...options,
  });
}

function configHash(root) {
  return runEvidenceScript(['config-hash', '--root', root]).trim();
}

function sourceUnknownBindingArgs(root) {
  return [
    '--app-key',
    'rates-review',
    '--tenant-id',
    'tenant-parent',
    '--operation-id',
    'source-op-1',
    '--nonce',
    'single-use-nonce',
    '--environment',
    'preview',
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
    '--expected-config-hash',
    configHash(root),
  ];
}

function sourceUnknownCollectArgs(root) {
  return [
    'collect',
    '--root',
    root,
    ...sourceUnknownBindingArgs(root),
    '--artifact-id',
    '987654321',
    '--artifact-digest',
    `sha256:${'d'.repeat(64)}`,
    '--image-digest',
    `sha256:${'c'.repeat(64)}`,
  ];
}

function dispatchBindingArgs(root) {
  return [
    '--app-key',
    'rates-review',
    '--tenant-id',
    'tenant-parent',
    '--operation-id',
    'source-op-1',
    '--nonce',
    'single-use-nonce',
    '--environment',
    'preview',
    '--expected-config-hash',
    configHash(root),
  ];
}

test('collect normalizes upload-artifact bare hex and writes canonical handoff digests', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-source-unknown-evidence-'));
  try {
    const fixtureRoot = join(workDir, 'app');
    const outputFile = join(realpathSync(workDir), 'github-output.txt');
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
      '--environment',
      'demo',
      '--expected-config-hash',
      configHash(fixtureRoot),
      '--artifact-id',
      '987654321',
      '--artifact-digest',
      'd'.repeat(64),
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
    const summary = JSON.parse(stdout);
    assert.equal(evidence.nonce, 'single-use-nonce');
    assert.equal(evidence.environment, 'demo');
    assert.equal(Object.hasOwn(summary, 'nonce'), false);
    assert.equal(stdout.includes('single-use-nonce'), false);
    assert.equal(summary.operationId, evidence.operationId);
    assert.equal(summary.evidencePath, evidencePath);
    assert.equal(summary.configHash, evidence.configHash);
    assert.equal(summary.artifactDigest, evidence.artifactDigest);
    assert.equal(summary.imageDigest, evidence.imageDigest);
    assert.equal(evidence.operationId, 'source-op-1');
    assert.equal(evidence.validationSummary.status, 'passed');
    assert.match(evidence.configHash, digestPattern);
    assert.match(evidence.artifactDigest, digestPattern);
    assert.equal(evidence.artifactDigest, `sha256:${'d'.repeat(64)}`);
    assert.match(evidence.imageArtifact.archiveDigest, digestPattern);
    assert.match(evidence.imageDigest, digestPattern);
    assert.match(evidence.workflowBlobSha, /^[a-f0-9]{40}$/);
    assert.match(evidence.collectorDigest, digestPattern);
    const workflowBytes = readFileSync(
      join(fixtureRoot, '.github/workflows/eai-app.yml'),
    );
    assert.equal(
      evidence.workflowBlobSha,
      createHash('sha1')
        .update(`blob ${workflowBytes.length}\0`)
        .update(workflowBytes)
        .digest('hex'),
    );
    assert.equal(
      evidence.collectorDigest,
      `sha256:${createHash('sha256')
        .update(
          readFileSync(
            join(fixtureRoot, 'scripts/source-unknown-deployment-evidence.mjs'),
          ),
        )
        .digest('hex')}`,
    );
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
      'workflow_blob_sha',
      'collector_digest',
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

test('CLI managed source computes checked-out config hash and labels its evidence', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-cli-managed-evidence-'));
  try {
    const root = join(workDir, 'app');
    writeFixtureApp(root);
    const args = [
      'collect',
      '--root',
      root,
      '--repo',
      'eai-generated-apps/demo',
      '--app-key',
      'demo',
      '--tenant-id',
      'company-1',
      '--environment',
      'preview',
      '--ref',
      'refs/heads/main',
      '--branch',
      'main',
      '--commit',
      'a'.repeat(40),
      '--artifact-id',
      '123',
      '--artifact-digest',
      'd'.repeat(64),
      '--image-digest',
      `sha256:${'c'.repeat(64)}`,
      '--operation-id',
      'cli-op-1',
      '--nonce',
      'a'.repeat(64),
      '--expected-config-hash',
      configHash(root),
      '--target-tenant-id',
      'hosting-tenant-1',
      '--workflow-run-id',
      '123',
      '--workflow-run-attempt',
      '1',
    ];
    runEvidenceScript([...args, '--source-mode', 'eai-cli-generated']);
    const evidence = JSON.parse(
      readFileSync(
        join(
          root,
          '.eai-build/evidence/source-unknown-deployment-evidence.json',
        ),
        'utf8',
      ),
    );
    assert.equal(evidence.sourceMode, 'eai-cli-generated');
    assert.equal(evidence.targetTenantId, 'hosting-tenant-1');
    assert.equal(
      evidence.configHash,
      runEvidenceScript(['config-hash', '--root', root]).trim(),
    );

    for (const sourceMode of ['unreviewed-source']) {
      const failure = spawnSync(
        process.execPath,
        [evidenceScript, ...args, '--source-mode', sourceMode],
        { encoding: 'utf8' },
      );
      assert.equal(failure.status, 1);
    }
    const missingTargetArgs = [...args];
    missingTargetArgs.splice(
      missingTargetArgs.indexOf('--target-tenant-id'),
      2,
    );
    const missingTarget = spawnSync(
      process.execPath,
      [
        evidenceScript,
        ...missingTargetArgs,
        '--source-mode',
        'eai-cli-generated',
      ],
      { encoding: 'utf8' },
    );
    assert.equal(missingTarget.status, 1);
    assert.match(missingTarget.stderr, /signed target tenant ID/);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('CLI evidence binds each merged commit and remains repository-owner agnostic', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-cli-managed-update-'));
  try {
    const root = join(workDir, 'app');
    writeFixtureApp(root);
    const states = [
      {
        repo: 'eai-generated-apps/demo',
        commit: 'a'.repeat(40),
        operation: 'cli-managed-initial',
        nonce: '1'.repeat(64),
      },
      {
        repo: 'eai-generated-apps/demo',
        commit: 'b'.repeat(40),
        operation: 'cli-managed-update',
        nonce: '2'.repeat(64),
      },
      {
        repo: 'customer-org/demo',
        commit: 'c'.repeat(40),
        operation: 'cli-managed-relocated',
        nonce: '3'.repeat(64),
      },
    ];
    const configHashes = new Set();
    for (const [index, state] of states.entries()) {
      const evidenceFile = `source-unknown-deployment-evidence-${index}.json`;
      const evidencePath = join(root, '.eai-build/evidence', evidenceFile);
      const runtimePath = join(root, 'eai.runtime.json');
      const runtime = JSON.parse(readFileSync(runtimePath, 'utf8'));
      runtime.release = index;
      writeFileSync(runtimePath, `${JSON.stringify(runtime)}\n`);
      runEvidenceScript([
        'collect',
        '--root',
        root,
        '--source-mode',
        'eai-cli-generated',
        '--target-tenant-id',
        'hosting-tenant-1',
        '--app-key',
        'demo',
        '--tenant-id',
        'company-1',
        '--environment',
        'preview',
        '--repo',
        state.repo,
        '--ref',
        'refs/heads/main',
        '--branch',
        'main',
        '--commit',
        state.commit,
        '--operation-id',
        state.operation,
        '--nonce',
        state.nonce,
        '--expected-config-hash',
        configHash(root),
        '--artifact-id',
        '123',
        '--artifact-digest',
        'd'.repeat(64),
        '--image-digest',
        `sha256:${'c'.repeat(64)}`,
        '--workflow-run-id',
        String(100 + index),
        '--workflow-run-attempt',
        '1',
        '--evidence-file',
        evidenceFile,
      ]);
      const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
      assert.equal(evidence.sourceMode, 'eai-cli-generated');
      assert.equal(evidence.targetTenantId, 'hosting-tenant-1');
      assert.equal(evidence.operationId, state.operation);
      assert.equal(evidence.commitSha, state.commit);
      assert.equal(evidence.nonce, state.nonce);
      assert.equal(
        evidence.configHash,
        runEvidenceScript(['config-hash', '--root', root]).trim(),
      );
      configHashes.add(evidence.configHash);
    }
    assert.equal(configHashes.size, states.length);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('workflow sends OIDC evidence directly to the canonical PublicAPI route', () => {
  const workflow = readFileSync(workflowPath, 'utf8');
  const buildJob = workflow.slice(
    workflow.indexOf('  build:'),
    workflow.indexOf('  handoff:'),
  );
  const handoffJob = workflow.slice(workflow.indexOf('  handoff:'));
  assert.match(
    workflow,
    /^run-name: EAI deploy \$\{\{ inputs\.app_key \}\} \(\$\{\{ inputs\.operation_id \}\}\)$/m,
  );
  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.match(workflow, /^  workflow_call:/m);
  assert.doesNotMatch(workflow, /^  (push|pull_request|schedule):/m);
  assert.match(workflow, /^  packages: read$/m);
  assert.doesNotMatch(buildJob, /id-token: write|ACTIONS_ID_TOKEN/);
  assert.match(handoffJob, /^      attestations: write$/m);
  assert.match(handoffJob, /^      id-token: write$/m);
  assert.ok(
    buildJob.indexOf('Run dependency install scripts') <
      workflow.indexOf('  handoff:'),
  );
  assert.match(workflow, /name: eai-generated-app-image/);
  assert.match(workflow, /--platform linux\/amd64/);
  assert.match(workflow, /inputs\.public_api_url/);
  assert.match(workflow, /inputs\.publicapi_base_url/);
  assert.match(workflow, /inputs\.env \|\| inputs\.environment \|\| 'preview'/);
  assert.doesNotMatch(workflow, /vars\.EAI_PUBLIC_API_URL/);
  assert.doesNotMatch(workflow, /secrets\.EAI_PUBLIC_API_URL/);
  assert.match(
    workflow,
    /EAI_BOUND_PUBLIC_API_URL: \$\{\{ inputs\.public_api_url \|\| inputs\.publicapi_base_url \}\}/,
  );
  assert.match(
    workflow,
    /ref: \$\{\{ inputs\.commit_sha \|\| github\.sha \}\}/,
  );
  assert.match(workflow, /--commit "\$SOURCE_COMMIT_SHA"/);
  assert.match(workflow, /--workflow-sha "\$GITHUB_SHA"/);
  assert.ok(
    workflow.indexOf('validate-dispatch') <
      workflow.indexOf('Install dependencies'),
  );
  assert.match(workflow, /source-unknown\/workflow-evidence/);
  assert.match(
    workflow,
    /cli-managed-source\/operations\/\$\{OPERATION_ID\}\/workflow-evidence/,
  );
  assert.match(workflow, /api:\/\/enterprise-ai-publicapi\/eai-cli-generated/);
  assert.match(workflow, /--source-mode "\$SOURCE_MODE"/);
  assert.match(workflow, /--target-tenant-id "\$TARGET_TENANT_ID"/);
  assert.match(workflow, /--operation-id "\$OPERATION_ID"/);
  assert.match(workflow, /--nonce "\$NONCE"/);
  assert.match(workflow, /--expected-config-hash "\$CONFIG_HASH"/);
  assert.match(handoffJob, /NONCE: \$\{\{ inputs\.nonce \}\}/);
  assert.match(handoffJob, /nonce: process\.env\.NONCE/);
  assert.match(handoffJob, /workflowBlobSha/);
  assert.match(handoffJob, /collectorDigest/);
  assert.match(handoffJob, /async function sourceConfigHash\(\)/);
  assert.match(handoffJob, /\/git\/commits\/\$\{encodeURIComponent\(process\.env\.SOURCE_COMMIT_SHA\)\}/);
  assert.match(handoffJob, /\/git\/trees\/\$\{commit\.tree\.sha\}\?recursive=1/);
  assert.match(handoffJob, /\/git\/blobs\/\$\{entry\.sha\}/);
  assert.match(handoffJob, /Math\.min\(8, sortedEntries\.length\)/);
  assert.match(handoffJob, /blobs\[index\] = \{ path: entry\.path, bytes \}/);
  assert.doesNotMatch(handoffJob, /Promise\.all\(entries\.sort/);
  assert.match(handoffJob, /src\/eai\.config\/object-types\.provisioning\.json/);
  assert.match(handoffJob, /canonicalConfigHash !== process\.env\.CONFIG_HASH/);
  assert.match(handoffJob, /canonicalConfigHash !== evidence\.configHash/);
  assert.match(handoffJob, /function validateSchemaProvenance\(provenance\)/);
  assert.match(handoffJob, /Array\.isArray\(provenance\)/);
  assert.match(handoffJob, /Object\.keys\(provenance\).*canonicalFields\.has\(key\)/);
  assert.match(handoffJob, /\^sha256:\[a-f0-9\]\{64\}\$/);
  assert.match(handoffJob, /\^\[a-f0-9\]\{40\}\$/);
  assert.match(handoffJob, /provenance\.templateVersion\.trim\(\) !== provenance\.templateVersion/);
  assert.match(handoffJob, /\[\\r\\n\]\/\.test\(value\)/);
  assert.match(handoffJob, /anchors\.some\(\(\[, value\]\) => value !== undefined\)/);
  assert.match(
    handoffJob,
    /const sourceProvenance = validateSchemaProvenance\(runtime\.schemaProvenance\)/,
  );
  assert.match(
    handoffJob,
    /isDeepStrictEqual\(evidence\.schemaProvenance, sourceProvenance\)/,
  );
  assert.match(
    handoffJob,
    /actions\/artifacts\/\$\{evidence\.imageArtifact\.id\}/,
  );
  assert.match(handoffJob, /'tar', \['-xOf'/);
  assert.doesNotMatch(workflow, /secrets\.EAI_ACCESS_TOKEN|\$EAI_ACCESS_TOKEN/);
  assert.doesNotMatch(buildJob, /GITHUB_TOKEN|NODE_AUTH_TOKEN|_authToken/);
  assert.match(handoffJob, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  assert.match(handoffJob, /^      actions: read$/m);
  assert.match(workflow, /npm ci --ignore-scripts/);
  assert.doesNotMatch(workflow, /> \.npmrc|>> \.npmrc/);
  assert.match(workflow, /include-hidden-files: true/);
  assert.match(workflow, /actions\/attest-build-provenance@[a-f0-9]{40}/);
  assert.match(workflow, /actions\/download-artifact@[a-f0-9]{40}/);
  assert.match(workflow, /name: Verify post-build source integrity/);
  assert.match(workflow, /git diff --exit-code/);
  assert.match(workflow, /git status --porcelain=v1 --untracked-files=all/);
  assert.ok(
    workflow.indexOf('Verify post-build source integrity') <
      workflow.indexOf('Collect immutable build evidence'),
  );
  assert.ok(
    workflow.indexOf('Upload immutable build evidence') <
      workflow.indexOf('  handoff:'),
  );
  assert.ok(
    workflow.indexOf('  handoff:') <
      workflow.indexOf('Request GitHub OIDC token'),
  );
  assert.ok(
    workflow.indexOf('async function sourceConfigHash()') <
      workflow.indexOf('Request GitHub OIDC token'),
  );
  assert.match(
    handoffJob,
    /name: Request GitHub OIDC token and submit workflow evidence/,
  );
  assert.match(handoffJob, /Authorization: Bearer \$token/);
  assert.doesNotMatch(handoffJob, /steps\.github-oidc\.outputs\.token/);
  assert.doesNotMatch(handoffJob, /token=\$token.*GITHUB_OUTPUT/);
  assert.match(handoffJob, /\[\[ "\$EAI_BOUND_PUBLIC_API_URL" =~ \^https:\/\//);
  assert.match(
    handoffJob,
    /if \[\[ "\$SOURCE_MODE" == "eai-cli-generated" \|\| -n "\$TARGET_TENANT_ID" \]\]; then/,
  );
  assert.match(workflow, /--max-redirs 0/);
  for (const action of workflow.matchAll(/^\s+uses:\s+([^\s#]+)/gm)) {
    assert.match(action[1], /@[a-f0-9]{40}$/);
  }
});

test('reusable workflow compatibility keeps manual same-repository OIDC authority', () => {
  const workflow = readFileSync(workflowPath, 'utf8');
  const readme = readFileSync(readmePath, 'utf8');
  const invocationGate = workflow.indexOf('name: Validate workflow invocation');
  const checkout = workflow.indexOf('name: Check out repository');
  const applicationInstall = workflow.indexOf(
    'name: Install dependencies without running application-controlled scripts',
  );

  assert.match(workflow, /^  workflow_call:/m);
  assert.match(
    workflow,
    /EAI_CALLER_EVENT_NAME: \$\{\{ github\.event_name \}\}/,
  );
  assert.match(
    workflow,
    /if \[\[ "\$EAI_CALLER_EVENT_NAME" != "workflow_dispatch" \]\]; then/,
  );
  assert.ok(invocationGate >= 0 && invocationGate < checkout);
  assert.ok(checkout < applicationInstall);
  assert.match(workflow, /workflow_ref/);
  assert.match(workflow, /job_workflow_ref\/job_workflow_sha/);
  assert.doesNotMatch(workflow, /secrets\.EAI_ACCESS_TOKEN|\$EAI_ACCESS_TOKEN/);
  assert.match(readme, /same repository/);
  assert.match(readme, /Cross-repository and cross-ref reusable calls fail/);
  assert.match(readme, /`actions: read`, `attestations: write`, and `id-token: write`/);
});

test('handoff hashes the bounded OCI archive without whole-file allocation', () => {
  const workflow = readFileSync(workflowPath, 'utf8');
  const handoffJob = workflow.slice(workflow.indexOf('  handoff:'));
  const archiveHasher = handoffJob.slice(
    handoffJob.indexOf('function hashBoundedRegularFile('),
    handoffJob.indexOf('const expected = {'),
  );

  assert.match(handoffJob, /MAX_IMAGE_ARCHIVE_BYTES = 10 \* 1024 \* 1024 \* 1024/);
  assert.match(archiveHasher, /fs\.constants\.O_NOFOLLOW/);
  assert.match(archiveHasher, /before\.size > maxBytes/);
  assert.match(archiveHasher, /Buffer\.allocUnsafe\(1024 \* 1024\)/);
  assert.match(archiveHasher, /while \(offset < opened\.size\)/);
  assert.match(archiveHasher, /fs\.readSync\(descriptor, buffer/);
  assert.match(archiveHasher, /afterDescriptor = fs\.fstatSync\(descriptor\)/);
  assert.match(archiveHasher, /afterPath = fs\.lstatSync\(filePath\)/);
  assert.doesNotMatch(
    handoffJob,
    /fs\.readFileSync\('\.eai-build\/eai-generated-app-image\.tar'/,
  );
});

test('dispatch accepts only trusted endpoints and the exact source and workflow identity', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-dispatch-validation-'));
  try {
    writeFixtureApp(workDir);
    execFileSync('git', ['init', '-q'], { cwd: workDir });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.com',
        'commit',
        '--allow-empty',
        '-m',
        'fixture',
      ],
      { cwd: workDir },
    );
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: workDir,
      encoding: 'utf8',
    }).trim();
    const binding = dispatchBindingArgs(workDir);
    for (const host of [
      'api.au',
      'api.ca',
      'api.eu',
      'test-api.au',
      'test-api.ca',
      'test-api.eu',
      'dev-api.au',
    ]) {
      runEvidenceScript([
        'validate-dispatch',
        '--root',
        workDir,
        ...binding,
        '--commit',
        commit,
        '--workflow-sha',
        commit,
        '--public-api-url',
        `https://${host}.myenterprise.ai/public`,
      ]);
    }
    for (const endpoint of [
      'https://attacker.example/public',
      'https://api.au.myenterprise.ai.attacker.example/public',
      'http://api.au.myenterprise.ai/public',
      'https://api.au.myenterprise.ai:8443/public',
      'https://user@api.au.myenterprise.ai/public',
      'https://api.au.myenterprise.ai/public?redirect=bad',
      'https://api.au.myenterprise.ai/public#fragment',
      'https://api.au.myenterprise.ai/other',
    ]) {
      const result = spawnSync(
        process.execPath,
        [
          evidenceScript,
          'validate-dispatch',
          '--root',
          workDir,
          ...binding,
          '--commit',
          commit,
          '--workflow-sha',
          commit,
          '--public-api-url',
          endpoint,
        ],
        { encoding: 'utf8' },
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, /trusted EAI regional PublicAPI/);
    }
    for (const [sourceCommit, workflowSha] of [
      ['a'.repeat(40), commit],
      [commit, 'b'.repeat(40)],
      ['main', commit],
    ]) {
      const result = spawnSync(
        process.execPath,
        [
          evidenceScript,
          'validate-dispatch',
          '--root',
          workDir,
          ...binding,
          '--commit',
          sourceCommit,
          '--workflow-sha',
          workflowSha,
          '--public-api-url',
          'https://api.au.myenterprise.ai/public',
        ],
        { encoding: 'utf8' },
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, /source, and workflow identity must match/);
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('CLI dispatch rejects an incomplete or malformed signed grant before the build', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-cli-dispatch-validation-'));
  try {
    writeFixtureApp(workDir);
    execFileSync('git', ['init', '-q'], { cwd: workDir });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.com',
        'commit',
        '--allow-empty',
        '-m',
        'fixture',
      ],
      { cwd: workDir },
    );
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: workDir,
      encoding: 'utf8',
    }).trim();
    const args = [
      'validate-dispatch',
      '--root',
      workDir,
      '--source-mode',
      'eai-cli-generated',
      '--app-key',
      'demo',
      '--tenant-id',
      'company-1',
      '--target-tenant-id',
      'hosting-tenant-1',
      '--operation-id',
      'cli-managed-' + 'a'.repeat(32),
      '--nonce',
      'b'.repeat(64),
      '--expected-config-hash',
      configHash(workDir),
      '--environment',
      'preview',
      '--public-api-url',
      'https://dev-api.au.myenterprise.ai/public',
      '--commit',
      commit,
      '--workflow-sha',
      commit,
    ];
    runEvidenceScript(args);
    const demoArgs = [...args];
    demoArgs[demoArgs.indexOf('--environment') + 1] = 'demo';
    runEvidenceScript(demoArgs);
    for (const [flag, invalidValue, message] of [
      ['--operation-id', '../other', /safe operationId path segment/],
      ['--nonce', 'short', /exact signed nonce/],
      ['--expected-config-hash', 'not-a-hash', /approved sha256 config hash/],
      ['--environment', 'production', /approved deployment environment/],
      ['--app-key', 'other/app', /canonical app key/],
      ['--app-key', '1other', /canonical app key/],
      ['--app-key', 'Other', /canonical app key/],
    ]) {
      const altered = [...args];
      altered[altered.indexOf(flag) + 1] = invalidValue;
      const result = spawnSync(process.execPath, [evidenceScript, ...altered], {
        encoding: 'utf8',
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, message);
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('workflow runs independent validations concurrently and waits for both', () => {
  const workflow = readFileSync(workflowPath, 'utf8');

  assert.match(workflow, /npm run typecheck &\n\s+typecheck_pid=\$!/);
  assert.match(workflow, /npm run test:unit:ci &\n\s+tests_pid=\$!/);
  assert.match(workflow, /wait "\$typecheck_pid" \|\| validation_status=1/);
  assert.match(workflow, /wait "\$tests_pid" \|\| validation_status=1/);
  assert.match(workflow, /exit "\$validation_status"/);
  assert.match(
    workflow,
    /\[\[ "\$APP_KEY" =~ \^\[a-z\]\[a-z0-9-\]\{1,62\}\$ \]\]/,
  );
  assert.match(
    workflow,
    /source-unknown-deployment-evidence\.mjs read-image-digest/,
  );
});

test('workflow uploads only the staged image archive and binds its digest', () => {
  const workflow = readFileSync(workflowPath, 'utf8');
  const stageOffset = workflow.indexOf('- name: Stage verified image artifact');
  const uploadOffset = workflow.indexOf(
    '- name: Upload immutable image artifact',
  );
  const collectOffset = workflow.indexOf(
    '- name: Collect immutable build evidence',
  );

  assert.ok(stageOffset >= 0);
  assert.ok(uploadOffset > stageOffset);
  assert.ok(collectOffset > uploadOffset);
  assert.match(
    workflow,
    /stage-image-artifact[\s\S]*--staging-root "\$RUNNER_TEMP"/,
  );
  assert.match(
    workflow,
    /path: \$\{\{ steps\.staged-image\.outputs\.image_archive_path \}\}/,
  );
  assert.match(
    workflow,
    /--image-archive "\$STAGED_IMAGE_ARCHIVE"[\s\S]*--image-staging-root "\$IMAGE_STAGING_ROOT"[\s\S]*--expected-archive-digest "\$STAGED_ARCHIVE_DIGEST"/,
  );
});

test('artifact staging creates a private bound copy used by evidence', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-image-staging-'));
  try {
    const fixtureRoot = join(workDir, 'app');
    const stagingRoot = join(workDir, 'runner-temp');
    const outputFile = join(workDir, 'github-output.txt');
    writeFixtureApp(fixtureRoot);
    mkdirSync(stagingRoot);

    const sourcePath = join(
      fixtureRoot,
      '.eai-build/eai-generated-app-image.tar',
    );
    const sourceBytes = readFileSync(sourcePath);
    const expectedDigest = `sha256:${createHash('sha256')
      .update(sourceBytes)
      .digest('hex')}`;
    const staged = JSON.parse(
      runEvidenceScript([
        'stage-image-artifact',
        '--root',
        fixtureRoot,
        '--staging-root',
        stagingRoot,
        '--github-output',
        outputFile,
      ]),
    );

    const stagedRelativePath = relative(stagingRoot, staged.imageArchivePath);
    assert.notEqual(staged.imageArchivePath, sourcePath);
    assert.equal(isAbsolute(stagedRelativePath), false);
    assert.notEqual(stagedRelativePath, '');
    assert.equal(stagedRelativePath.startsWith('..'), false);
    assert.deepEqual(readFileSync(staged.imageArchivePath), sourceBytes);
    assert.equal(staged.archiveDigest, expectedDigest);
    assert.equal(staged.size, sourceBytes.length);

    const outputs = readFileSync(outputFile, 'utf8');
    assert.match(
      outputs,
      new RegExp(`^image_archive_path=${staged.imageArchivePath}$`, 'm'),
    );
    assert.match(
      outputs,
      new RegExp(`^archive_digest=${expectedDigest}$`, 'm'),
    );
    assert.match(
      outputs,
      new RegExp(`^archive_size=${sourceBytes.length}$`, 'm'),
    );

    writeFileSync(staged.imageArchivePath, 'substituted archive\n');
    const substituted = spawnSync(
      process.execPath,
      [
        evidenceScript,
        ...sourceUnknownCollectArgs(fixtureRoot),
        '--image-archive',
        staged.imageArchivePath,
        '--image-staging-root',
        stagingRoot,
        '--expected-archive-digest',
        staged.archiveDigest,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(substituted.status, 1);
    assert.match(substituted.stderr, /does not match its bound copy/);
    writeFileSync(staged.imageArchivePath, sourceBytes);

    runEvidenceScript([
      ...sourceUnknownCollectArgs(fixtureRoot),
      '--image-archive',
      staged.imageArchivePath,
      '--image-staging-root',
      stagingRoot,
      '--expected-archive-digest',
      staged.archiveDigest,
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
    assert.equal(evidence.imageArtifact.archiveDigest, expectedDigest);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('image context pins the runtime minimum Node image by immutable digest', () => {
  const workDir = mkdtempSync(
    join(tmpdir(), 'eai-source-unknown-image-context-'),
  );
  try {
    const fixtureRoot = join(workDir, 'app');
    writeFixtureApp(fixtureRoot);
    rmSync(join(fixtureRoot, '.eai-build/eai-generated-app-image.tar'));
    runEvidenceScript(['prepare-image-context', '--root', fixtureRoot]);
    assert.match(
      readFileSync(
        join(fixtureRoot, '.eai-build/image-context/Dockerfile'),
        'utf8',
      ),
      /^FROM node:24-alpine@sha256:[a-f0-9]{64}$/m,
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test(
  'image context rejects nested links in standalone, static, and public trees',
  { skip: process.platform === 'win32' },
  () => {
    const cases = [
      [
        '.next/standalone/nested/linked.js',
        '.eai-build/image-context/nested/linked.js',
      ],
      [
        '.next/static/nested/linked.js',
        '.eai-build/image-context/.next/static/nested/linked.js',
      ],
      [
        'public/nested/linked.txt',
        '.eai-build/image-context/public/nested/linked.txt',
      ],
    ];
    for (const [sourceRelative, destinationRelative] of cases) {
      const workDir = mkdtempSync(join(tmpdir(), 'eai-linked-image-source-'));
      try {
        const root = join(workDir, 'app');
        const outside = join(workDir, 'outside.txt');
        writeFixtureApp(root);
        writeFileSync(outside, 'outside must not be copied\n');
        mkdirSync(dirname(join(root, sourceRelative)), { recursive: true });
        symlinkSync(outside, join(root, sourceRelative));

        const result = spawnSync(
          process.execPath,
          [evidenceScript, 'prepare-image-context', '--root', root],
          { encoding: 'utf8' },
        );
        assert.equal(result.status, 1);
        assert.match(result.stderr, /cannot contain a symlink/);
        assert.equal(existsSync(join(root, destinationRelative)), false);
        assert.equal(
          readFileSync(outside, 'utf8'),
          'outside must not be copied\n',
        );
      } finally {
        rmSync(workDir, { recursive: true, force: true });
      }
    }
  },
);

test('image context rejects an application-controlled linked build-output root', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-linked-build-root-'));
  try {
    const root = join(workDir, 'app');
    const outside = join(workDir, 'outside');
    writeFixtureApp(root);
    mkdirSync(outside);
    rmSync(join(root, '.eai-build'), { recursive: true });
    symlinkSync(outside, join(root, '.eai-build'), 'dir');

    const result = spawnSync(
      process.execPath,
      [evidenceScript, 'prepare-image-context', '--root', root],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /must not contain links|no-follow directory/);
    assert.equal(existsSync(join(outside, 'image-context/Dockerfile')), false);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('image preparation rejects preexisting isolated outputs without deleting them', () => {
  for (const relativePath of [
    '.eai-build/image-context',
    '.eai-build/eai-generated-app-image.tar',
    '.eai-build/image-metadata.json',
  ]) {
    const workDir = mkdtempSync(join(tmpdir(), 'eai-preexisting-output-'));
    try {
      const root = join(workDir, 'app');
      writeFixtureApp(root);
      const output = join(root, relativePath);
      if (relativePath.endsWith('image-context')) {
        mkdirSync(output, { recursive: true });
        writeFileSync(join(output, 'sentinel'), 'unchanged');
      } else {
        mkdirSync(dirname(output), { recursive: true });
        writeFileSync(output, 'unchanged');
      }
      const result = spawnSync(
        process.execPath,
        [evidenceScript, 'prepare-image-context', '--root', root],
        { encoding: 'utf8' },
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, /must not exist before isolated image preparation/);
      if (relativePath.endsWith('image-context')) {
        assert.equal(readFileSync(join(output, 'sentinel'), 'utf8'), 'unchanged');
      } else {
        assert.equal(readFileSync(output, 'utf8'), 'unchanged');
      }
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
});

test('image preparation never truncates a hard-linked generated output', () => {
  const workDir = realpathSync(
    mkdtempSync(join(tmpdir(), 'eai-hard-linked-image-output-')),
  );
  try {
    const root = join(workDir, 'app');
    const protectedPath = join(workDir, 'protected.txt');
    const dockerfilePath = join(
      root,
      '.eai-build/image-context/Dockerfile',
    );
    const preload = join(workDir, 'hard-link-image-output.cjs');
    writeFixtureApp(root);
    writeFileSync(protectedPath, 'protected bytes\n');
    writeFileSync(
      preload,
      String.raw`
const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');
const originalOpenSync = fs.openSync;
let linked = false;
fs.openSync = function patchedOpenSync(path, ...args) {
  const target = process.env.EAI_TEST_IMAGE_OUTPUT_PATH;
  if (!linked && target && String(path) === target) {
    linked = true;
    fs.linkSync(process.env.EAI_TEST_PROTECTED_PATH, target);
  }
  return originalOpenSync.call(fs, path, ...args);
};
syncBuiltinESMExports();
`,
    );

    const result = spawnSync(
      process.execPath,
      [evidenceScript, 'prepare-image-context', '--root', root],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_OPTIONS: `--require=${preload}`,
          EAI_TEST_IMAGE_OUTPUT_PATH: dockerfilePath,
          EAI_TEST_PROTECTED_PATH: protectedPath,
        },
      },
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /EEXIST|file already exists/);
    assert.equal(readFileSync(protectedPath, 'utf8'), 'protected bytes\n');
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('collector error paths do not unlink a copy destination after parent validation fails', () => {
  const implementation = readFileSync(evidenceScript, 'utf8');
  const copyStart = implementation.indexOf('function copyRegularTreeNoFollow(');
  const copyEnd = implementation.indexOf('\nfunction writeRegularFileNoFollow(', copyStart);
  assert.ok(copyStart >= 0 && copyEnd > copyStart);
  const copy = implementation.slice(copyStart, copyEnd);
  assert.doesNotMatch(copy, /rmSync\(destinationPath/);
  assert.doesNotMatch(implementation, /rmSync\(path(?:,|\))/);
});

test('image-tree copies bind each source ancestor and final path through the read', () => {
  const implementation = readFileSync(evidenceScript, 'utf8');
  const copyStart = implementation.indexOf('function copyRegularTreeNoFollow(');
  const copyEnd = implementation.indexOf('\nfunction writeRegularFileNoFollow(', copyStart);
  assert.ok(copyStart >= 0 && copyEnd > copyStart);
  const copy = implementation.slice(copyStart, copyEnd);
  assert.match(copy, /snapshotAbsoluteDirectoryPath\(\s*dirname\(sourcePath\),\s*label/);
  assert.equal(
    (copy.match(/assertAbsoluteDirectorySnapshot\(sourceAncestors, label\)/g) || [])
      .length,
    2,
  );
  assert.match(copy, /sourceRebound\.ino !== opened\.ino/);
  assert.match(copy, /sourcePathAfter\.ino !== opened\.ino/);
  assert.match(copy, /after\.mtimeMs !== opened\.mtimeMs/);
  assert.match(copy, /realpathSync\(sourcePath\)/);
});

test('image metadata digest is read through a bounded no-follow path', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-image-metadata-'));
  try {
    const root = join(workDir, 'app');
    const outside = join(workDir, 'outside');
    writeFixtureApp(root);
    rmSync(join(root, '.eai-build/eai-generated-app-image.tar'));
    runEvidenceScript(['prepare-image-context', '--root', root]);
    writeFileSync(
      join(root, '.eai-build/image-metadata.json'),
      JSON.stringify({ 'containerimage.digest': `sha256:${'a'.repeat(64)}` }),
    );
    assert.equal(
      runEvidenceScript(['read-image-digest', '--root', root]).trim(),
      `sha256:${'a'.repeat(64)}`,
    );

    mkdirSync(outside);
    writeFileSync(
      join(outside, 'image-metadata.json'),
      JSON.stringify({ 'containerimage.digest': `sha256:${'b'.repeat(64)}` }),
    );
    rmSync(join(root, '.eai-build'), { recursive: true });
    symlinkSync(outside, join(root, '.eai-build'), 'dir');
    const linked = spawnSync(
      process.execPath,
      [evidenceScript, 'read-image-digest', '--root', root],
      { encoding: 'utf8' },
    );
    assert.equal(linked.status, 1);
    assert.match(linked.stderr, /no-follow directory tree/);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('bounded collector reads bind parent and leaf identity through the read', () => {
  const implementation = readFileSync(evidenceScript, 'utf8');
  const start = implementation.indexOf('function readBoundedRegularFileNoFollow(');
  const end = implementation.indexOf('\nfunction readImageDigest(', start);
  assert.ok(start >= 0 && end > start);
  const reader = implementation.slice(start, end);
  assert.match(reader, /snapshotAbsoluteDirectoryPath\(dirname\(path\), label\)/);
  assert.equal(
    (reader.match(/assertAbsoluteDirectorySnapshot\(ancestors, label\)/g) || []).length,
    2,
  );
  assert.match(reader, /rebound\.dev !== opened\.dev/);
  assert.match(reader, /after\.mtimeMs !== opened\.mtimeMs/);
  assert.match(reader, /finalPath\.ino !== opened\.ino/);
  assert.match(reader, /bytes\.length !== opened\.size/);
});

test('configuration hashing repeats inventory and binds each post-read path', () => {
  const implementation = readFileSync(evidenceScript, 'utf8');
  const hashStart = implementation.indexOf('function buildConfigHash(');
  const hashEnd = implementation.indexOf('\nfunction prepareImageContext(', hashStart);
  const readerStart = implementation.indexOf('function readRegularFileNoFollow(');
  const readerEnd = implementation.indexOf('\nfunction optionalLstat(', readerStart);
  assert.ok(hashStart >= 0 && hashEnd > hashStart && readerStart >= 0 && readerEnd > readerStart);
  const hash = implementation.slice(hashStart, hashEnd);
  const reader = implementation.slice(readerStart, readerEnd);
  assert.equal((hash.match(/listGovernedConfigFiles\(root\)/g) || []).length, 2);
  assert.match(hash, /paths\.some\(\(path, index\) => path !== finalPaths\[index\]\)/);
  assert.match(reader, /assertRelativeDirectorySnapshot\(ancestors, relativePath\)/);
  assert.match(reader, /finalPath\.ino !== opened\.ino/);
  assert.match(reader, /opened\.size !== before\.size/);
  assert.match(reader, /opened\.mtimeMs !== before\.mtimeMs/);
  assert.match(reader, /opened\.ctimeMs !== before\.ctimeMs/);
  assert.match(reader, /rebound\.mtimeMs !== opened\.mtimeMs/);
  assert.match(reader, /rebound\.ctimeMs !== opened\.ctimeMs/);
  assert.match(reader, /after\.mtimeMs !== opened\.mtimeMs/);
  assert.match(reader, /after\.ctimeMs !== opened\.ctimeMs/);
  assert.match(reader, /finalPath\.mtimeMs !== opened\.mtimeMs/);
  assert.match(reader, /finalPath\.ctimeMs !== opened\.ctimeMs/);
  assert.match(reader, /bytes\.length !== opened\.size/);
});

test('configuration hashing rejects an in-place rewrite before no-follow open', () => {
  const workDir = realpathSync(
    mkdtempSync(join(tmpdir(), 'eai-config-pre-open-rewrite-')),
  );
  try {
    const root = join(workDir, 'app');
    const target = join(root, 'eai.runtime.json');
    const preload = join(workDir, 'rewrite-config-before-open.cjs');
    writeFixtureApp(root);
    writeFileSync(
      preload,
      String.raw`
const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');
const originalOpenSync = fs.openSync;
const originalCloseSync = fs.closeSync;
const originalWriteSync = fs.writeSync;
let rewritten = false;
fs.openSync = function patchedOpenSync(path, ...args) {
  const target = process.env.EAI_TEST_CONFIG_REWRITE_PATH;
  if (!rewritten && target && String(path) === target) {
    rewritten = true;
    const length = fs.readFileSync(target).length;
    const writer = originalOpenSync.call(
      fs,
      target,
      fs.constants.O_WRONLY | fs.constants.O_TRUNC,
    );
    try {
      originalWriteSync.call(fs, writer, Buffer.alloc(length, 0x78));
    } finally {
      originalCloseSync.call(fs, writer);
    }
    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(target, future, future);
  }
  return originalOpenSync.call(fs, path, ...args);
};
syncBuiltinESMExports();
`,
    );

    const result = spawnSync(
      process.execPath,
      [evidenceScript, 'config-hash', '--root', root],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_OPTIONS: `--require=${preload}`,
          EAI_TEST_CONFIG_REWRITE_PATH: target,
        },
      },
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /changed before its no-follow read/);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('schema provenance must be present in the governed runtime manifest', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-source-unknown-provenance-'));
  try {
    const fixtureRoot = join(workDir, 'app');
    writeFixtureApp(fixtureRoot);
    writeFileSync(
      join(fixtureRoot, 'eai.runtime.json'),
      '{"runtime":"legacy"}\n',
    );
    const result = spawnSync(
      process.execPath,
      [
        evidenceScript,
        'collect',
        '--root',
        fixtureRoot,
        ...sourceUnknownBindingArgs(fixtureRoot),
        '--artifact-id',
        '987654321',
        '--artifact-digest',
        `sha256:${'d'.repeat(64)}`,
        '--image-digest',
        `sha256:${'c'.repeat(64)}`,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /schemaProvenance is required/);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('schema provenance accepts every approved source anchor and preserves it in evidence', () => {
  const anchors = [
    ['baseTemplateSha', 'a'.repeat(40), 'base_template_sha'],
    ['approvedSourceSha', 'b'.repeat(40), 'approved_source_sha'],
    ['approvedReleaseId', 'approved-release-2026-09-25', 'approved_release_id'],
  ];
  for (const [key, value, outputKey] of anchors) {
    const workDir = mkdtempSync(join(tmpdir(), `eai-source-unknown-${key}-`));
    try {
      const fixtureRoot = join(workDir, 'app');
      const outputFile = join(realpathSync(workDir), 'github-output.txt');
      writeFixtureApp(fixtureRoot);
      writeFileSync(
        join(fixtureRoot, 'eai.runtime.json'),
        JSON.stringify({
          runtime: 'fixture',
          schemaProvenance: {
            templateVersion: '0.1.0',
            [key]: value,
            schemaDigest: `sha256:${'c'.repeat(64)}`,
            validatorDigest: `sha256:${'d'.repeat(64)}`,
          },
        }),
      );
      runEvidenceScript([
        'collect',
        '--root',
        fixtureRoot,
        ...sourceUnknownBindingArgs(fixtureRoot),
        '--artifact-id',
        '987654321',
        '--artifact-digest',
        `sha256:${'e'.repeat(64)}`,
        '--image-digest',
        `sha256:${'f'.repeat(64)}`,
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
      assert.equal(evidence.schemaProvenance[key], value);
      assert.match(
        readFileSync(outputFile, 'utf8'),
        new RegExp(`^${outputKey}=${value}$`, 'm'),
      );
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
});

test('schema provenance rejects missing and malformed approved source anchors', () => {
  const invalidProvenance = [
    {
      templateVersion: '0.1.0',
      schemaDigest: `sha256:${'c'.repeat(64)}`,
      validatorDigest: `sha256:${'d'.repeat(64)}`,
    },
    {
      templateVersion: '0.1.0',
      approvedSourceSha: 'not-a-commit',
      schemaDigest: `sha256:${'c'.repeat(64)}`,
      validatorDigest: `sha256:${'d'.repeat(64)}`,
    },
    {
      templateVersion: '0.1.0\ninjected=value',
      baseTemplateSha: 'a'.repeat(40),
      schemaDigest: `sha256:${'c'.repeat(64)}`,
      validatorDigest: `sha256:${'d'.repeat(64)}`,
    },
    {
      templateVersion: '0.1.0',
      approvedReleaseId: '',
      schemaDigest: `sha256:${'c'.repeat(64)}`,
      validatorDigest: `sha256:${'d'.repeat(64)}`,
    },
    {
      templateVersion: '0.1.0',
      approvedReleaseId: 'release-1\ninjected=value',
      schemaDigest: `sha256:${'c'.repeat(64)}`,
      validatorDigest: `sha256:${'d'.repeat(64)}`,
    },
    {
      templateVersion: '0.1.0',
      approvedReleaseId: ' release-with-whitespace ',
      schemaDigest: `sha256:${'c'.repeat(64)}`,
      validatorDigest: `sha256:${'d'.repeat(64)}`,
    },
    {
      templateVersion: '0.1.0',
      approvedReleaseId: 'release-1',
      unexpectedAnchor: 'not-canonical',
      schemaDigest: `sha256:${'c'.repeat(64)}`,
      validatorDigest: `sha256:${'d'.repeat(64)}`,
    },
  ];
  for (const schemaProvenance of invalidProvenance) {
    const workDir = mkdtempSync(
      join(tmpdir(), 'eai-source-unknown-invalid-provenance-'),
    );
    try {
      writeFixtureApp(workDir);
      writeFileSync(
        join(workDir, 'eai.runtime.json'),
        JSON.stringify({ runtime: 'fixture', schemaProvenance }),
      );
      const result = spawnSync(
        process.execPath,
        [
          evidenceScript,
          'collect',
          '--root',
          workDir,
          ...sourceUnknownBindingArgs(workDir),
          '--artifact-id',
          '987654321',
          '--artifact-digest',
          `sha256:${'e'.repeat(64)}`,
          '--image-digest',
          `sha256:${'f'.repeat(64)}`,
        ],
        { encoding: 'utf8' },
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Schema provenance/);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
});

test('collect rejects multiline provenance before writing evidence or GitHub outputs', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-output-injection-'));
  try {
    writeFixtureApp(workDir);
    const runtimePath = join(workDir, 'eai.runtime.json');
    const runtime = JSON.parse(readFileSync(runtimePath, 'utf8'));
    runtime.schemaProvenance.templateVersion = '0.1.0\ninjected=value';
    writeFileSync(runtimePath, JSON.stringify(runtime));
    const githubOutput = join(realpathSync(workDir), 'github-output.txt');
    writeFileSync(githubOutput, 'trusted=value\n');

    const result = spawnSync(
      process.execPath,
      [
        evidenceScript,
        'collect',
        '--root',
        workDir,
        ...sourceUnknownBindingArgs(workDir),
        '--artifact-id',
        '987654321',
        '--artifact-digest',
        `sha256:${'e'.repeat(64)}`,
        '--image-digest',
        `sha256:${'f'.repeat(64)}`,
        '--github-output',
        githubOutput,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /templateVersion is required/);
    assert.equal(readFileSync(githubOutput, 'utf8'), 'trusted=value\n');
    assert.equal(
      existsSync(
        join(
          workDir,
          '.eai-build/evidence/source-unknown-deployment-evidence.json',
        ),
      ),
      false,
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('collect never follows a replaced GitHub output command file', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-linked-github-output-'));
  try {
    const root = join(workDir, 'app');
    const protectedPath = join(workDir, 'protected.txt');
    const githubOutput = join(realpathSync(workDir), 'github-output.txt');
    writeFixtureApp(root);
    writeFileSync(protectedPath, 'protected\n');
    symlinkSync(protectedPath, githubOutput);

    const result = spawnSync(
      process.execPath,
      [
        evidenceScript,
        ...sourceUnknownCollectArgs(root),
        '--github-output',
        githubOutput,
      ],
      { encoding: 'utf8' },
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /ELOOP|symbolic link/i);
    assert.equal(readFileSync(protectedPath, 'utf8'), 'protected\n');
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('collect rejects a linked GitHub output command-file ancestor', () => {
  const workDir = realpathSync(
    mkdtempSync(join(tmpdir(), 'eai-linked-github-output-parent-')),
  );
  try {
    const root = join(workDir, 'app');
    const protectedDirectory = join(workDir, 'protected');
    const linkedDirectory = join(workDir, 'linked-output');
    writeFixtureApp(root);
    mkdirSync(protectedDirectory);
    writeFileSync(join(protectedDirectory, 'marker.txt'), 'protected\n');
    symlinkSync(protectedDirectory, linkedDirectory, 'dir');

    const result = spawnSync(
      process.execPath,
      [
        evidenceScript,
        ...sourceUnknownCollectArgs(root),
        '--github-output',
        join(linkedDirectory, 'github-output.txt'),
      ],
      { encoding: 'utf8' },
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /ancestors must be no-follow directories/);
    assert.equal(
      existsSync(join(protectedDirectory, 'github-output.txt')),
      false,
    );
    assert.equal(
      readFileSync(join(protectedDirectory, 'marker.txt'), 'utf8'),
      'protected\n',
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('collect rejects a GitHub output command file replaced after append', () => {
  const workDir = realpathSync(
    mkdtempSync(join(tmpdir(), 'eai-replaced-github-output-after-append-')),
  );
  try {
    const root = join(workDir, 'app');
    const githubOutput = join(workDir, 'github-output.txt');
    const preload = join(workDir, 'replace-command-file.cjs');
    writeFixtureApp(root);
    writeFileSync(githubOutput, 'trusted=before\n');
    writeFileSync(
      preload,
      String.raw`
const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');
const originalWriteSync = fs.writeSync;
let replaced = false;
fs.writeSync = function patchedWriteSync(descriptor, ...args) {
  const result = originalWriteSync.call(fs, descriptor, ...args);
  const target = process.env.EAI_TEST_GITHUB_OUTPUT_SWAP_PATH;
  if (!replaced && target) {
    try {
      const opened = fs.fstatSync(descriptor);
      const leaf = fs.lstatSync(target);
      if (opened.dev === leaf.dev && opened.ino === leaf.ino) {
        replaced = true;
        fs.renameSync(target, target + '.bound');
        fs.writeFileSync(target, 'attacker=value\n');
      }
    } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error;
    }
  }
  return result;
};
syncBuiltinESMExports();
`,
    );

    const result = spawnSync(
      process.execPath,
      [
        evidenceScript,
        ...sourceUnknownCollectArgs(root),
        '--github-output',
        githubOutput,
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          NODE_OPTIONS: `--require=${preload}`,
          EAI_TEST_GITHUB_OUTPUT_SWAP_PATH: githubOutput,
        },
      },
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, /path changed during append/);
    assert.equal(readFileSync(githubOutput, 'utf8'), 'attacker=value\n');
    assert.match(
      readFileSync(`${githubOutput}.bound`, 'utf8'),
      /artifact_digest=sha256:/,
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
        ...sourceUnknownBindingArgs(fixtureRoot),
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

test('collect rejects malformed upload-artifact digests without weakening image validation', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-source-unknown-digest-'));
  try {
    writeFixtureApp(workDir);
    const configHash = runEvidenceScript([
      'config-hash',
      '--root',
      workDir,
    ]).trim();
    for (const artifactDigest of [
      'd'.repeat(63),
      'D'.repeat(64),
      `md5:${'d'.repeat(64)}`,
      `sha256:sha256:${'d'.repeat(64)}`,
    ]) {
      const result = spawnSync(
        process.execPath,
        [
          evidenceScript,
          'collect',
          '--root',
          workDir,
          ...sourceUnknownBindingArgs(workDir),
          '--artifact-id',
          '987654321',
          '--artifact-digest',
          artifactDigest,
          '--image-digest',
          `sha256:${'c'.repeat(64)}`,
          '--expected-config-hash',
          configHash,
        ],
        { encoding: 'utf8' },
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, /artifactDigest must be a sha256 digest/);
    }
    const result = spawnSync(
      process.execPath,
      [
        evidenceScript,
        'collect',
        '--root',
        workDir,
        ...sourceUnknownBindingArgs(workDir),
        '--artifact-id',
        '987654321',
        '--artifact-digest',
        'd'.repeat(64),
        '--image-digest',
        'c'.repeat(64),
        '--expected-config-hash',
        configHash,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /imageDigest must be a sha256 digest/);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('configuration digest binds nested tenants, deployment contract, and rejects symlinks', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-config-manifest-'));
  try {
    writeFixtureApp(workDir);
    mkdirSync(join(workDir, 'src/eai.config/tenants/acme'), {
      recursive: true,
    });
    writeFileSync(
      join(workDir, 'src/eai.config/deployment-contract.ts'),
      'export const deployment = { region: "au" };\n',
    );
    const tenantPath = join(
      workDir,
      'src/eai.config/tenants/acme/runtime.json',
    );
    writeFileSync(tenantPath, '{"tenant":"one"}\n');
    const first = configHash(workDir);

    writeFileSync(
      join(workDir, 'src/eai.config/object-types.json'),
      '{"generated":"changed"}\n',
    );
    writeFileSync(
      join(workDir, 'src/eai.config/object-types.provisioning.json'),
      '{"generated":"new"}\n',
    );
    assert.equal(first, configHash(workDir));

    const specPath = join(workDir, 'src/eai.config/policy.spec.ts');
    writeFileSync(specPath, 'export const policy = "one";\n');
    const specAdded = configHash(workDir);
    assert.notEqual(first, specAdded);

    const testPath = join(workDir, 'src/eai.config/policy.test.json');
    writeFileSync(testPath, '{"policy":"one"}\n');
    const testAdded = configHash(workDir);
    assert.notEqual(specAdded, testAdded);

    writeFileSync(specPath, 'export const policy = "two";\n');
    const specChanged = configHash(workDir);
    assert.notEqual(testAdded, specChanged);

    writeFileSync(tenantPath, '{"tenant":"two"}\n');
    const nestedChanged = configHash(workDir);
    assert.notEqual(specChanged, nestedChanged);

    writeFileSync(
      join(workDir, 'src/eai.config/deployment-contract.ts'),
      'export const deployment = { region: "ca" };\n',
    );
    assert.notEqual(nestedChanged, configHash(workDir));

    symlinkSync(
      join(workDir, 'eai.runtime.json'),
      join(workDir, 'src/eai.config/tenants/runtime-link.json'),
    );
    const result = spawnSync(
      process.execPath,
      [evidenceScript, 'config-hash', '--root', workDir],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /cannot be a symlink/);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('configuration digest rejects dangling governed root links', () => {
  const cases = [
    ['eai.config.ts', 'missing-config.ts'],
    ['src/eai.config', 'missing-config-directory'],
  ];
  for (const [governedPath, target] of cases) {
    const workDir = mkdtempSync(join(tmpdir(), 'eai-config-dangling-'));
    try {
      writeFixtureApp(workDir);
      rmSync(join(workDir, governedPath), { recursive: true, force: true });
      symlinkSync(target, join(workDir, governedPath));
      const result = spawnSync(
        process.execPath,
        [evidenceScript, 'config-hash', '--root', workDir],
        { encoding: 'utf8' },
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, /regular (?:file|directory)/);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
});

test(
  'configuration digest rejects linked or non-directory governed ancestors',
  { skip: process.platform === 'win32' },
  () => {
    for (const scenario of ['link', 'file']) {
      const workDir = mkdtempSync(
        join(tmpdir(), `eai-config-ancestor-${scenario}-`),
      );
      try {
        const root = join(workDir, 'app');
        const outside = join(workDir, 'outside');
        writeFixtureApp(root);
        mkdirSync(join(outside, 'eai.config'), { recursive: true });
        writeFileSync(
          join(outside, 'eai.config/runtime.ts'),
          'export const escaped = true;\n',
        );
        rmSync(join(root, 'src'), { recursive: true, force: true });
        if (scenario === 'link') symlinkSync(outside, join(root, 'src'), 'dir');
        else writeFileSync(join(root, 'src'), 'not a directory\n');

        const result = spawnSync(
          process.execPath,
          [evidenceScript, 'config-hash', '--root', root],
          { encoding: 'utf8' },
        );
        assert.equal(result.status, 1);
        assert.match(result.stderr, /ancestor must be a regular directory/);
      } finally {
        rmSync(workDir, { recursive: true, force: true });
      }
    }
  },
);

test(
  'configuration digest rejects nonregular governed entries',
  { skip: process.platform === 'win32' },
  () => {
    const workDir = mkdtempSync(join(tmpdir(), 'eai-config-special-file-'));
    try {
      writeFixtureApp(workDir);
      const fifoPath = join(workDir, 'src/eai.config/runtime-input');
      execFileSync('mkfifo', [fifoPath]);
      const result = spawnSync(
        process.execPath,
        [evidenceScript, 'config-hash', '--root', workDir],
        { encoding: 'utf8' },
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, /regular file or directory/);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  },
);

test('dispatch rejects auto config grants, unsafe source-unknown paths, and conflicting aliases', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-dispatch-aliases-'));
  try {
    writeFixtureApp(workDir);
    execFileSync('git', ['init', '-q'], { cwd: workDir });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.com',
        'commit',
        '--allow-empty',
        '-m',
        'fixture',
      ],
      { cwd: workDir },
    );
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: workDir,
      encoding: 'utf8',
    }).trim();
    const valid = [
      'validate-dispatch',
      '--root',
      workDir,
      ...dispatchBindingArgs(workDir),
      '--commit',
      commit,
      '--workflow-sha',
      commit,
      '--public-api-url',
      'https://api.au.myenterprise.ai/public',
    ];
    runEvidenceScript([
      ...valid,
      '--target-tenant-id',
      '',
      '--preferred-environment',
      '',
      '--legacy-environment',
      '',
      '--preferred-public-api-url',
      '',
      '--legacy-public-api-url',
      '',
    ]);
    for (const extra of [
      ['--expected-config-hash', 'auto'],
      ['--app-key', '../other'],
      ['--nonce', '../other'],
      ['--preferred-environment', 'test', '--legacy-environment', 'prod'],
      [
        '--preferred-public-api-url',
        'https://api.au.myenterprise.ai/public',
        '--legacy-public-api-url',
        'https://api.ca.myenterprise.ai/public',
      ],
    ]) {
      const result = spawnSync(
        process.execPath,
        [evidenceScript, ...valid, ...extra],
        { encoding: 'utf8' },
      );
      assert.equal(result.status, 1);
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('collect rejects an empty OCI archive before producing evidence', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-empty-image-'));
  try {
    writeFixtureApp(workDir);
    writeFileSync(join(workDir, '.eai-build/eai-generated-app-image.tar'), '');
    const result = spawnSync(
      process.execPath,
      [
        evidenceScript,
        'collect',
        '--root',
        workDir,
        ...sourceUnknownBindingArgs(workDir),
        '--artifact-id',
        '987654321',
        '--artifact-digest',
        `sha256:${'d'.repeat(64)}`,
        '--image-digest',
        `sha256:${'c'.repeat(64)}`,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /nonempty regular file/);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('collect rejects a linked OCI archive before hashing evidence', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-linked-image-'));
  try {
    writeFixtureApp(workDir);
    const archivePath = join(workDir, '.eai-build/eai-generated-app-image.tar');
    rmSync(archivePath);
    symlinkSync(join(workDir, 'eai.runtime.json'), archivePath);
    const result = spawnSync(
      process.execPath,
      [
        evidenceScript,
        'collect',
        '--root',
        workDir,
        ...sourceUnknownBindingArgs(workDir),
        '--artifact-id',
        '987654321',
        '--artifact-digest',
        `sha256:${'d'.repeat(64)}`,
        '--image-digest',
        `sha256:${'c'.repeat(64)}`,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /nonempty regular file/);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('collect rejects a linked OCI archive ancestor before hashing evidence', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-linked-image-parent-'));
  try {
    const root = join(workDir, 'app');
    const outside = join(workDir, 'outside');
    writeFixtureApp(root);
    mkdirSync(outside);
    writeFileSync(
      join(outside, 'eai-generated-app-image.tar'),
      'outside archive\n',
    );
    rmSync(join(root, '.eai-build'), { recursive: true });
    symlinkSync(outside, join(root, '.eai-build'), 'dir');
    const result = spawnSync(
      process.execPath,
      [evidenceScript, ...sourceUnknownCollectArgs(root)],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /no-follow directory tree/);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('collect confines evidence to a no-link directory inside the application root', () => {
  const cases = ['outside-root', 'escaped-file', 'linked-directory'];
  for (const scenario of cases) {
    const workDir = mkdtempSync(join(tmpdir(), `eai-evidence-${scenario}-`));
    try {
      const root = join(workDir, 'app');
      const outside = join(workDir, 'outside');
      writeFixtureApp(root);
      mkdirSync(outside);
      const args = sourceUnknownCollectArgs(root);
      if (scenario === 'outside-root') {
        args.push('--output-dir', outside);
      } else if (scenario === 'escaped-file') {
        args.push('--evidence-file', '../escaped.json');
      } else {
        symlinkSync(outside, join(root, '.eai-build/evidence'), 'dir');
      }

      const result = spawnSync(process.execPath, [evidenceScript, ...args], {
        encoding: 'utf8',
      });
      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /must remain within its approved directory|must not contain links/,
      );
      assert.equal(
        existsSync(join(outside, 'source-unknown-deployment-evidence.json')),
        false,
      );
      assert.equal(existsSync(join(root, '.eai-build/escaped.json')), false);
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
});

test('collect never replaces an existing or linked evidence file', () => {
  for (const scenario of ['regular', 'link']) {
    const workDir = mkdtempSync(join(tmpdir(), `eai-evidence-${scenario}-`));
    try {
      const root = join(workDir, 'app');
      writeFixtureApp(root);
      const evidenceDir = join(root, '.eai-build/evidence');
      const evidencePath = join(
        evidenceDir,
        'source-unknown-deployment-evidence.json',
      );
      const protectedPath = join(workDir, 'protected.txt');
      mkdirSync(evidenceDir);
      writeFileSync(protectedPath, 'protected\n');
      if (scenario === 'regular') {
        writeFileSync(evidencePath, 'existing evidence\n');
      } else {
        symlinkSync(protectedPath, evidencePath);
      }

      const result = spawnSync(
        process.execPath,
        [evidenceScript, ...sourceUnknownCollectArgs(root)],
        { encoding: 'utf8' },
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, /EEXIST/);
      assert.equal(readFileSync(protectedPath, 'utf8'), 'protected\n');
      if (scenario === 'regular') {
        assert.equal(readFileSync(evidencePath, 'utf8'), 'existing evidence\n');
      }
    } finally {
      rmSync(workDir, { recursive: true, force: true });
    }
  }
});

test('assert-evidence-accepted accepts persisted evidence with accepted or deferred handoff', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-source-unknown-handoff-'));
  try {
    for (const status of ['accepted', 'handoff_pending']) {
      for (const nested of [false, true]) {
        const responsePath = join(
          workDir,
          `deployment-response-${status}.json`,
        );
        const response = {
          status,
          deploymentRequestId: 'source-unknown-deploy-1',
          requiresTenantInfra: status === 'handoff_pending',
        };
        writeFileSync(
          responsePath,
          JSON.stringify(nested ? { response } : response),
        );

        const stdout = runEvidenceScript([
          'assert-evidence-accepted',
          '--response',
          responsePath,
        ]);
        assert.match(stdout, new RegExp(`^${status} source-unknown-deploy-1`));
      }
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});

test('assert-evidence-accepted rejects unknown states and unpersisted pending handoff', () => {
  const workDir = mkdtempSync(
    join(tmpdir(), 'eai-source-unknown-handoff-bad-'),
  );
  try {
    const responsePath = join(workDir, 'deployment-response-bad.json');
    for (const response of [
      {
        status: 'deployed',
        deploymentRequestId: 'request',
        requiresTenantInfra: false,
      },
      {
        status: 'failed',
        deploymentRequestId: 'request',
        requiresTenantInfra: true,
      },
      {
        status: 'handoff_pending',
        deploymentRequestId: 'request',
        requiresTenantInfra: false,
      },
      {
        status: 'handoff_pending',
        deploymentRequestId: 'request',
        requiresTenantInfra: 'true',
      },
      { status: 'handoff_pending', requiresTenantInfra: true },
      {
        status: 'handoff_pending',
        deploymentRequestId: ' ',
        requiresTenantInfra: true,
      },
      {},
    ]) {
      writeFileSync(responsePath, JSON.stringify({ response }));
      const result = spawnSync(
        process.execPath,
        [
          evidenceScript,
          'assert-evidence-accepted',
          '--response',
          responsePath,
        ],
        { encoding: 'utf8' },
      );
      assert.equal(result.status, 1);
      assert.match(
        result.stderr,
        /Expected accepted evidence or a persisted pending handoff/,
      );
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});
