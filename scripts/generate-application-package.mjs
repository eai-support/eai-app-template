import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  canonicalizeApplicationPackage,
  digestApplicationPackage,
  parseApplicationPackage,
} from '@enterpriseaigroup/application-package';

/** Validate source and return deterministic release bytes without selecting tenant state. */
export function generateApplicationPackage(value) {
  const applicationPackage = parseApplicationPackage(value);
  return {
    applicationPackage,
    canonical: canonicalizeApplicationPackage(applicationPackage),
    digest: digestApplicationPackage(applicationPackage),
  };
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const check = process.argv.includes('--check');
  const source = JSON.parse(await readFile(path.join(root, 'eai.application.json'), 'utf8'));
  const generated = generateApplicationPackage(source);
  const outputPath = path.join(root, 'eai.application.generated.json');
  const output = `${JSON.stringify({ ...generated.applicationPackage, packageDigest: generated.digest }, null, 2)}\n`;
  if (check) {
    const existing = await readFile(outputPath, 'utf8').catch(() => '');
    if (existing !== output) throw new Error('Generated application package is stale.');
  } else {
    await writeFile(outputPath, output);
  }
}
