# Tasks

- [x] Record 2026-09-25 approval and preserved user contract.
- [x] Merge current `main` without force-pushing.
- [x] Validate every dispatch/path/operation input (DTE-020, DTE-021).
- [x] Hash complete nested source configuration, exclude deterministic generated outputs, reject links, and validate every canonical provenance anchor (DTE-018).
- [x] Upload and attest the hidden nonempty no-follow artifact (DTE-022, DTE-024).
- [x] Isolate application lifecycle work from OIDC and recheck source/endpoint integrity in the trusted handoff (DTE-025).
- [x] Pin actions and the base image immutably (DTE-023).
- [x] Preserve `environment`/`env` caller compatibility (DTE-026).
- [x] Preserve optional `target_tenant_id` compatibility for legacy `source-unknown` callers while requiring it for `eai-cli-generated`.
- [x] Preserve explicitly empty optional dispatch aliases as values rather than boolean flags (DTE-020, DTE-021).
- [x] Reject multiline provenance and GitHub output values (DTE-025).
- [x] Confine evidence creation to a no-link path and refuse existing destinations (DTE-022).
- [x] Revalidate the immutable evidence nonce at the trusted handoff boundary before OIDC (DTE-025).
- [x] Reject every nonregular entry in the governed configuration tree (DTE-018).
- [x] Reject a link or non-directory in every governed configuration ancestor and recheck ancestors before file reads (DTE-018).
- [x] Reject an application-controlled link or non-directory in `.eai-build`, image-context, archive, metadata, and evidence ancestors before copying, writing, or hashing (DTE-022, DTE-025).
- [x] Include `.test.*` and `.spec.*` files in the governed configuration digest while excluding only the two generated Object Type outputs (DTE-018).
- [x] Copy standalone, static, and public source trees entry by entry without following nested links or accepting nonregular files (DTE-022).
- [x] Apply the canonical generated-runtime app-key grammar in collector and handoff validation and retain the template's supported `demo` environment (DTE-020, DTE-021, DTE-026).
- [x] Write collector values to `$GITHUB_OUTPUT` only through a verified no-follow regular-file descriptor (DTE-025).
- [x] Update owned tests and traceability.
- [x] Rerun prescribed checks and record exact-head results after GitHub command-file hardening.

## Exact-head evidence

- `actionlint .github/workflows/eai-app.yml`
- `npm run test:object-types-generator`
- `npm run test:release-version`
- `npm run test:source-unknown-evidence` (30 passed)
- `npm run test:ai-workspace-guidance`
- `npm run test:cross-platform-lifecycle`
- `npm run test:unit:ci` (322 passed)
- `npm run typecheck`
- `npm run build`
