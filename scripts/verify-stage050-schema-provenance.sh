#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE_DIR="$ROOT_DIR/tests/fixtures/stage050/schema-provenance"
ARTIFACT_DIR="${STAGE050_ARTIFACT_DIR:-$ROOT_DIR/.stage050-artifacts}"
ARTIFACT="$ARTIFACT_DIR/schema-provenance.md"

cd "$ROOT_DIR"

node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const fixtureDir = path.join(process.cwd(), 'tests/fixtures/stage050/schema-provenance');
const approved = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'valid.json'), 'utf8'));
const forged = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'forged-template-version.json'), 'utf8'));
const digestMismatch = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'digest-mismatch.json'), 'utf8'));

function errorsFor(candidate) {
  const errors = [];
  for (const key of ['templateVersion', 'baseTemplateSha', 'schemaDigest', 'validatorDigest']) {
    if (candidate[key] !== approved[key]) {
      errors.push(`${key} is not approved`);
    }
  }
  return errors;
}

if (errorsFor(approved).length !== 0) {
  throw new Error('valid schema provenance fixture was rejected');
}
if (!errorsFor(forged).includes('templateVersion is not approved')) {
  throw new Error('forged template version fixture was not rejected');
}
if (!errorsFor(digestMismatch).includes('schemaDigest is not approved')) {
  throw new Error('schema digest mismatch fixture was not rejected');
}
NODE

npm test -- --runTestsByPath src/lib/platform/schema-provenance.test.ts src/lib/platform/runtime-contract.test.ts

mkdir -p "$ARTIFACT_DIR"
cat > "$ARTIFACT" <<EOF
# Stage 050 Schema Provenance Evidence

- Command: \`./scripts/verify-stage050-schema-provenance.sh\`
- Fixture: \`tests/fixtures/stage050/schema-provenance/\`
- Positive assertion: approved template version, base template SHA, schema digest, and validator digest are accepted.
- Negative assertions: forged template versions and schema digest mismatches are rejected.
- Result: passed
EOF

echo "Wrote $ARTIFACT"
