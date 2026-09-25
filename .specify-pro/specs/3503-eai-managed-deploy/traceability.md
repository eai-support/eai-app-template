# Traceability

| Requirement | Planned implementation | Owned evidence |
| --- | --- | --- |
| DTE-018 | evidence collector configuration/provenance inventory | `tests/source-unknown-deployment-evidence.test.mjs` |
| DTE-020, DTE-021 | `.github/workflows/eai-app.yml`, collector input validators | workflow static assertions and collector tests |
| DTE-022, DTE-024 | hidden artifact upload, digest/attestation steps | workflow static assertions and evidence tests |
| DTE-023 | immutable workflow action/base-image references | workflow static assertions |
| DTE-025 | post-build OIDC acquisition and secret-free build | workflow ordering assertions |
| DTE-026 | additive `environment` and `env` inputs | compatibility tests |
| DTE-086–DTE-088 | current-main merge and producer release gate | `npm run verify`, release-version checks |
