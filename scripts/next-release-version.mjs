#!/usr/bin/env node
/**
 * Resolve the next release tag for the app template.
 *
 * The template is private and unpublished, so `package.json` version is not the
 * release identity — the git tag is. Consumers (eai-cli `linked-sources.json`,
 * Admin-Portal generated-app export) record the tag for humans and the commit
 * SHA for the actual fetch, so a moved or deleted tag can never silently change
 * what a pinned consumer resolves.
 */

import { pathToFileURL } from 'node:url';

const BUMPS = new Set(['major', 'minor', 'patch']);
const RELEASE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;

/** First tag cut for the template; `0.1.0` in package.json predates releases. */
export const FIRST_RELEASE = '1.0.0';

/**
 * @param {string | null | undefined} latestTag Highest existing `vX.Y.Z` tag, or empty for the first release.
 * @param {'major' | 'minor' | 'patch'} bump
 * @returns {string} Bare semver, without the leading `v`.
 */
export function nextReleaseVersion(latestTag, bump = 'patch') {
  if (!BUMPS.has(bump)) {
    throw new Error(`Unsupported bump "${bump}". Use major, minor, or patch.`);
  }

  const trimmed = (latestTag ?? '').trim();
  if (!trimmed) {
    return FIRST_RELEASE;
  }

  const match = RELEASE_TAG.exec(trimmed);
  if (!match) {
    // Refuse to guess: a malformed tag would otherwise restart numbering at
    // 1.0.0 and hand consumers a version that moves backwards.
    throw new Error(
      `Latest tag "${trimmed}" is not a vMAJOR.MINOR.PATCH release tag.`,
    );
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [latestTag = '', bump = 'patch'] = process.argv.slice(2);
  process.stdout.write(nextReleaseVersion(latestTag, bump));
}
