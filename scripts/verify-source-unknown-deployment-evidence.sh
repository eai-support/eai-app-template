#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/eai-source-unknown-evidence.XXXXXX")"
FIXTURE_ROOT="$WORK_DIR/app"
OUTPUT_FILE="$WORK_DIR/github-output.txt"
RESPONSE_FILE="$WORK_DIR/deployment-response.json"
BAD_RESPONSE_FILE="$WORK_DIR/deployment-response-bad.json"
trap 'rm -rf "$WORK_DIR"' EXIT

mkdir -p \
  "$FIXTURE_ROOT/.next/standalone" \
  "$FIXTURE_ROOT/.next/static" \
  "$FIXTURE_ROOT/src/eai.config" \
  "$FIXTURE_ROOT/tests/fixtures/schema-provenance" \
  "$FIXTURE_ROOT/.eai-build"

printf 'console.log("ok");\n' > "$FIXTURE_ROOT/.next/standalone/server.js"
printf 'static\n' > "$FIXTURE_ROOT/.next/static/app.js"
printf '{"name":"fixture-app"}\n' > "$FIXTURE_ROOT/package.json"
printf '{"runtime":"fixture"}\n' > "$FIXTURE_ROOT/eai.runtime.json"
printf '{"types":[]}\n' > "$FIXTURE_ROOT/src/eai.config/object-types.json"
cp "$ROOT_DIR/tests/fixtures/schema-provenance/valid.json" \
  "$FIXTURE_ROOT/tests/fixtures/schema-provenance/valid.json"
printf 'oci image archive fixture\n' > "$FIXTURE_ROOT/.eai-build/eai-app-image.oci.tar"

node "$ROOT_DIR/scripts/source-unknown-deployment-evidence.mjs" collect \
  --root "$FIXTURE_ROOT" \
  --app-key rates-review \
  --tenant-id tenant-parent \
  --repo enterpriseaigroup/rates-review \
  --workflow .github/workflows/eai-app.yml \
  --ref refs/heads/main \
  --branch main \
  --commit abcdef1234567890abcdef1234567890abcdef12 \
  --workflow-run-id 123456789 \
  --workflow-run-attempt 1 \
  --github-output "$OUTPUT_FILE" \
  > "$WORK_DIR/evidence.stdout.json"

node - "$FIXTURE_ROOT/.eai-build/evidence/source-unknown-deployment-evidence.json" "$OUTPUT_FILE" <<'NODE'
const fs = require('node:fs');
const evidence = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outputs = fs.readFileSync(process.argv[3], 'utf8');
if (evidence.contract !== 'source-unknown-app-template-deployment-handoff') throw new Error('wrong contract');
if (evidence.sourceMode !== 'source-unknown') throw new Error('wrong source mode');
if (evidence.handoff.expectedStatus !== 'handoff_pending') throw new Error('handoff status not pinned');
if (evidence.handoff.tenantInfraImplementedHere !== false) throw new Error('TenantInfra must stay out of template evidence');
for (const value of [evidence.configHash, evidence.artifact.digest, evidence.image.digest]) {
  if (!/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error(`bad digest: ${value}`);
}
for (const key of ['config_hash', 'artifact_digest', 'image_digest', 'template_version', 'base_template_sha', 'schema_digest', 'validator_digest']) {
  if (!outputs.includes(`${key}=`)) throw new Error(`missing GitHub output ${key}`);
}
NODE

cat > "$RESPONSE_FILE" <<'JSON'
{
  "response": {
    "status": "handoff_pending",
    "deploymentRequestId": "source-unknown-deploy-1",
    "requiresTenantInfra": true
  }
}
JSON

node "$ROOT_DIR/scripts/source-unknown-deployment-evidence.mjs" assert-handoff-pending \
  --response "$RESPONSE_FILE" >/dev/null

cat > "$BAD_RESPONSE_FILE" <<'JSON'
{
  "response": {
    "status": "deployed",
    "deploymentRequestId": "source-unknown-deploy-1",
    "requiresTenantInfra": false
  }
}
JSON

if node "$ROOT_DIR/scripts/source-unknown-deployment-evidence.mjs" assert-handoff-pending \
  --response "$BAD_RESPONSE_FILE" >/dev/null 2>&1; then
  echo "Expected non-pending handoff assertion to fail" >&2
  exit 1
fi

echo "source-unknown deployment evidence validation passed"
