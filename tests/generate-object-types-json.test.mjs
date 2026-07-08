import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatorScript = join(repoRoot, 'scripts/generate-object-types-json.mjs');

test('object type generator accepts scaffolded TypeScript const assertions', () => {
  const workDir = mkdtempSync(join(tmpdir(), 'eai-object-types-generator-'));
  try {
    const inputPath = join(workDir, 'object-types.ts');
    const outputPath = join(workDir, 'object-types.json');
    const provisioningOutputPath = join(workDir, 'object-types.provisioning.json');

    mkdirSync(dirname(inputPath), { recursive: true });
    writeFileSync(
      inputPath,
      `
export type StorageBackend = 'postgresql' | 'documentdb' | 'blob' | 'search';

export interface ObjectTypeDefinition {
  name: string;
  storageBackend: StorageBackend;
}

export const objectTypes: Record<string, ObjectTypeDefinition[]> = {
  postPilot: [
    {
      name: 'Campaign',
      displayName: 'Campaign',
      storageBackend: 'postgresql' as const,
      status: 'published' as const,
      properties: [
        { name: 'title', type: 'text' as const, required: true },
      ] as const,
    },
  ],
};
`,
    );

    execFileSync(process.execPath, [generatorScript], {
      env: {
        ...process.env,
        EAI_OBJECT_TYPES_INPUT_PATH: inputPath,
        EAI_OBJECT_TYPES_OUTPUT_PATH: outputPath,
        EAI_OBJECT_TYPES_PROVISIONING_OUTPUT_PATH: provisioningOutputPath,
      },
      stdio: 'pipe',
    });

    const objectTypes = JSON.parse(readFileSync(outputPath, 'utf8'));
    assert.equal(objectTypes.postPilot[0].name, 'Campaign');
    assert.equal(objectTypes.postPilot[0].storageBackend, 'postgresql');
    assert.equal(objectTypes.postPilot[0].properties[0].type, 'text');

    const provisioning = JSON.parse(readFileSync(provisioningOutputPath, 'utf8'));
    assert.deepEqual(provisioning[0].declaredBackends, ['postgresql']);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
});
