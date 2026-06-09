#!/usr/bin/env node
/**
 * Generate object-types.json from object-types.ts
 *
 * Strips TypeScript type declarations, evaluates the runtime JS, and writes
 * the resulting JSON to src/eai.config/object-types.json.
 *
 * Usage:
 *   node scripts/generate-object-types-json.mjs
 *   npm run build:object-types
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const inputPath = join(projectRoot, 'src/eai.config/object-types.ts');
const outputPath = join(projectRoot, 'src/eai.config/object-types.json');

// Read TypeScript source
const tsContent = readFileSync(inputPath, 'utf-8');

// Strip TypeScript-only syntax to produce valid JavaScript
let jsContent = tsContent;

// Remove type/interface/enum declarations (single-line and multi-line)
const lines = jsContent.split('\n');
const cleaned = [];
let inBlock = false;
let braceDepth = 0;

for (const line of lines) {
  const stripped = line.trim();

  // Skip standalone type/interface/enum declarations
  if (/^export\s+(type|interface|enum)\s+/.test(stripped) ||
      /^(type|interface|enum)\s+/.test(stripped)) {
    if (stripped.endsWith(';') && !stripped.includes('{')) {
      continue; // Single-line type alias
    }
    // Multi-line block
    inBlock = true;
    braceDepth = (stripped.match(/{/g) || []).length - (stripped.match(/}/g) || []).length;
    if (braceDepth <= 0) inBlock = false;
    continue;
  }

  if (inBlock) {
    braceDepth += (stripped.match(/{/g) || []).length - (stripped.match(/}/g) || []).length;
    if (braceDepth <= 0) inBlock = false;
    continue;
  }

  // Strip type annotations from const declarations
  let cleanedLine = line
    .replace(/export\s+const\s+(\w+)\s*:\s*[^=]+=/, 'const $1 =')
    .replace(/^(\s*)const\s+(\w+)\s*:\s*[^=]+=/, '$1const $2 =')
    .replace('export const', 'const')
    .replace('export default', 'const objectTypes =');

  cleaned.push(cleanedLine);
}

// Evaluate the cleaned JavaScript to extract the objectTypes value
const evalCode = cleaned.join('\n') + '\n\nobjectTypes;';
const objectTypes = (0, eval)(evalCode);

// Validate
if (typeof objectTypes !== 'object' || objectTypes === null) {
  console.error('Error: objectTypes is not an object');
  process.exit(1);
}

// Write JSON
const json = JSON.stringify(objectTypes, null, 2);
writeFileSync(outputPath, json + '\n', 'utf-8');

// Summary
const tenantKeys = Object.keys(objectTypes);
const totalTypes = tenantKeys.reduce((sum, key) => sum + objectTypes[key].length, 0);
console.log(`Generated ${outputPath}`);
console.log(`  ${tenantKeys.length} tenant(s): ${tenantKeys.join(', ')}`);
console.log(`  ${totalTypes} Object Type(s) total`);
