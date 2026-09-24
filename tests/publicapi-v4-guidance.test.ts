import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = process.cwd();
const INCLUDED_EXTENSIONS = new Set([
  '.cjs',
  '.js',
  '.json',
  '.md',
  '.mdx',
  '.mjs',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);
const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.next',
  'coverage',
  'graphify-out',
  'node_modules',
]);
const EXCLUDED_FILES = new Set(['package-lock.json']);

function repositoryGuidanceFiles(directory = ROOT): string[] {
  return readdirSync(directory).flatMap((entry) => {
    if (EXCLUDED_DIRECTORIES.has(entry)) return [];
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return repositoryGuidanceFiles(path);
    if (EXCLUDED_FILES.has(entry) || !INCLUDED_EXTENSIONS.has(extname(entry))) {
      return [];
    }
    return [path];
  });
}

describe('PublicAPI V4 repository guidance', () => {
  const files = repositoryGuidanceFiles();

  it('contains no EAI browser proxy examples below V4', () => {
    const violations = files.flatMap((path) => {
      const text = readFileSync(path, 'utf8');
      return /\/api\/eai\/(?:stream\/)?v[123](?:\/|\b)/i.test(text)
        ? [relative(ROOT, path)]
        : [];
    });

    expect(violations).toEqual([]);
  });

  it('contains no PublicAPI or ResourceAPI guidance for versions below V4', () => {
    const violations = files.flatMap((path) => {
      const lines = readFileSync(path, 'utf8').split(/\r?\n/);
      return lines.flatMap((line, index) =>
        /(?:PublicAPI|ResourceAPI).{0,160}\bV[123]\b|\bV[123]\b.{0,160}(?:PublicAPI|ResourceAPI)/i.test(
          line,
        )
          ? [`${relative(ROOT, path)}:${index + 1}`]
          : [],
      );
    });

    expect(violations).toEqual([]);
  });

  it('keeps direct EAI PublicAPI command examples on V4 paths', () => {
    const commandPattern =
      /eai publicapi\s+(?:get|post|put|patch|delete|<method>)\b/gi;
    const violations = files.flatMap((path) => {
      const lines = readFileSync(path, 'utf8').split(/\r?\n/);
      return lines.flatMap((line, index) => {
        commandPattern.lastIndex = 0;
        return commandPattern.test(line) && !/\/v4\//i.test(line)
          ? [`${relative(ROOT, path)}:${index + 1}`]
          : [];
      });
    });

    expect(violations).toEqual([]);
  });
});
