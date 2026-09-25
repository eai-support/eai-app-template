# Tasks

- [x] Record 2026-09-25 approval and preserved user contract.
- [x] Merge current `main` without force-pushing.
- [x] Validate every dispatch/path/operation input (DTE-020, DTE-021).
- [x] Hash complete nested configuration and validate every canonical provenance anchor (DTE-018).
- [x] Upload and attest the hidden nonempty artifact (DTE-022, DTE-024).
- [x] Pin actions and the base image immutably (DTE-023).
- [x] Preserve `environment`/`env` caller compatibility (DTE-026).
- [x] Update owned tests and traceability.
- [x] Run prescribed checks and record exact results.

## Exact-head evidence

- `actionlint .github/workflows/eai-app.yml`
- `npm run test:object-types-generator`
- `npm run test:release-version`
- `npm run test:source-unknown-evidence` (18 passed)
- `npm run test:ai-workspace-guidance`
- `npm run test:cross-platform-lifecycle`
- `npm run test:unit:ci` (322 passed)
- `npm run typecheck`
- `npm run build`
