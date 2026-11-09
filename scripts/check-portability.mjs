import { realpathSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const excluded = new Set(['.git', 'node_modules', '.next', '.eai-build', 'out', 'build', 'coverage', 'test-results', 'playwright-report', 'blob-report']);

/** INVARIANT: reject ambiguous names rather than selecting or overwriting a duplicate. */
export function validatePaths(paths) {
  const failures = [];
  const seen = new Map();
  for (const path of paths) {
    for (const component of path.split('/')) {
      if (/[\x00-\x1f\x7f<>:"\\|?*]/.test(component) || /[ .]$/.test(component) ||
          /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(component)) {
        failures.push(`Invalid portable path: ${JSON.stringify(path)}`);
        break;
      }
    }
    const key = path.normalize('NFC').toLowerCase();
    if (seen.has(key) && seen.get(key) !== path) {
      failures.push(`Case/Unicode collision: ${JSON.stringify(seen.get(key))} and ${JSON.stringify(path)}`);
    }
    seen.set(key, path);
  }
  return failures;
}

export async function checkDirectory(root) {
  const paths = [];
  const failures = [];
  async function walk(relative = '') {
    for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
      if (entry.isDirectory() && excluded.has(entry.name)) continue;
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      paths.push(path);
      if (entry.isSymbolicLink()) failures.push(`Non-portable symlink: ${JSON.stringify(path)}`);
      else if (entry.isDirectory()) await walk(path);
      else if (entry.isFile() && path.endsWith('.sh') && (await readFile(join(root, path))).includes(13)) {
        failures.push(`Shell script requires LF line endings: ${JSON.stringify(path)}`);
      }
    }
  }
  await walk();
  return [...validatePaths(paths), ...failures];
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  const failures = await checkDirectory(resolve(process.argv[2] || '.'));
  if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
  } else console.log('Portable project paths validated');
}
