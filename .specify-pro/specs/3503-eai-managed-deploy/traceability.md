# Traceability

Requirements are defined by the [Issue #3503 hardening amendment](https://github.com/enterpriseaigroup/Issues2025/issues/3503#issuecomment-5826177803).

| Requirement      | Implementation                                                                                                                          | Owned evidence                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| DTE-018          | recursive, no-symlink configuration manifest and required runtime provenance in `scripts/source-unknown-deployment-evidence.mjs`        | nested/deployment-contract/provenance evidence tests      |
| DTE-020, DTE-021 | `.github/workflows/eai-app.yml` plus shared source-mode, path, and signed-grant validators                                              | workflow assertions and both source modes' negative tests |
| DTE-022, DTE-024 | hidden artifact upload, nonempty archive check, and pinned GitHub provenance attestation                                                | workflow assertions and empty-archive test                |
| DTE-023          | immutable workflow action SHAs and Node OCI digest                                                                                      | workflow and image-context assertions                     |
| DTE-025          | public immutable dependency download with scripts disabled, credential-free lifecycle/build, then OIDC                                   | workflow ordering and credential-isolation assertions     |
| DTE-026          | additive `environment`/`env`, `publicapi_base_url`/`public_api_url`, and reusable-workflow compatibility inputs with conflict rejection | compatibility and conflict tests                          |
| DTE-086–DTE-088  | current-main merge; producer candidate remains unversioned until its automatic release                                                  | exact-head validation above and release-version tests     |
