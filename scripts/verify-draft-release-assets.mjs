import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSET_NAMES = [
  'producer-manifest.json',
  'producer-manifest.sigstore.json',
];

function digestRegularFile(path) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.size === 0) {
    throw new Error(`Release asset is not a nonempty regular file: ${path}`);
  }
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** The downloaded draft must contain only the two byte-identical, locally verified assets. */
export function verifyDraftReleaseAssets(localDirectory, downloadedDirectory) {
  const downloadedNames = readdirSync(downloadedDirectory).sort();
  if (JSON.stringify(downloadedNames) !== JSON.stringify(ASSET_NAMES)) {
    throw new Error(
      `Draft release asset names differ: ${downloadedNames.join(', ')}`,
    );
  }
  for (const name of ASSET_NAMES) {
    const localDigest = digestRegularFile(join(localDirectory, name));
    const downloadedDigest = digestRegularFile(join(downloadedDirectory, name));
    if (downloadedDigest !== localDigest) {
      throw new Error(`Draft release asset SHA-256 mismatch: ${name}`);
    }
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.length !== 4) {
    throw new Error(
      'Usage: node scripts/verify-draft-release-assets.mjs LOCAL_DIR DOWNLOADED_DIR',
    );
  }
  verifyDraftReleaseAssets(process.argv[2], process.argv[3]);
}
