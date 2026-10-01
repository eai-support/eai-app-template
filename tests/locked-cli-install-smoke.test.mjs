import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflowPath = join(repoRoot, '.github/workflows/eai-app.yml');

test('released CLI and locked dependencies support both privileged handoff commands', () => {
  const workflow = readFileSync(workflowPath, 'utf8');
  const marker =
    '      - name: Install immutable EAI CLI dependency closure\n        run: |\n';
  const start = workflow.indexOf(marker);
  assert.notEqual(start, -1, 'exact CLI install step must exist');
  const bodyStart = start + marker.length;
  const end = workflow.indexOf('\n      - name:', bodyStart);
  assert.notEqual(end, -1, 'CLI install step must end before the next step');
  const script = workflow
    .slice(bodyStart, end)
    .split('\n')
    .map((line) => (line.startsWith('          ') ? line.slice(10) : line))
    .join('\n');

  const cliDir = mkdtempSync(join(tmpdir(), 'eai-locked-cli-smoke-'));
  try {
    execFileSync('bash', ['-c', script], {
      cwd: repoRoot,
      env: {
        ...process.env,
        EAI_CLI_INSTALL_DIR: cliDir,
      },
      stdio: 'pipe',
      timeout: 120_000,
    });

    const cli = join(cliDir, 'dist/index.js');
    const evidenceHelp = execFileSync(
      process.execPath,
      [cli, 'app', 'workflow-evidence', '--help'],
      { encoding: 'utf8', timeout: 15_000 },
    );
    const handoffHelp = execFileSync(
      process.execPath,
      [cli, 'app', 'deploy-source-unknown', '--help'],
      { encoding: 'utf8', timeout: 15_000 },
    );
    assert.match(evidenceHelp, /--github-oidc-token/);
    assert.match(evidenceHelp, /--workflow-run-attempt/);
    assert.match(handoffHelp, /--image-digest/);
    assert.match(handoffHelp, /--target-kind/);
  } finally {
    rmSync(cliDir, { recursive: true, force: true });
  }
});
