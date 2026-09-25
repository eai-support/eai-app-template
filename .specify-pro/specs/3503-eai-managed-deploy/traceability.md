# Traceability

Requirements are defined by the [Issue #3503 hardening amendment](https://github.com/enterpriseaigroup/Issues2025/issues/3503#issuecomment-5826177803).

| Requirement      | Implementation                                                                                                                          | Owned evidence                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| DTE-018          | recursive source-only, no-follow configuration manifest and canonical base-template, approved-source, or approved-release provenance    | nested/generated-output/dangling-link/provenance tests    |
| DTE-020, DTE-021 | `.github/workflows/eai-app.yml` plus shared source-mode, path, and signed-grant validators                                              | workflow assertions and both source modes' negative tests |
| DTE-022, DTE-024 | hidden artifact upload, no-follow nonempty archive check, and pinned GitHub provenance attestation                                      | workflow assertions and archive link/empty tests          |
| DTE-023          | immutable workflow action SHAs and Node OCI digest                                                                                      | workflow and image-context assertions                     |
| DTE-025          | credential-free lifecycle/build job, post-build source check, then isolated OIDC handoff from immutable artifacts and step-local inputs | two-job permission, ordering, integrity, endpoint tests   |
| DTE-026          | additive `environment`/`env`, `publicapi_base_url`/`public_api_url`, and reusable-workflow compatibility inputs with conflict rejection | compatibility and conflict tests                          |
| DTE-086–DTE-088  | current-main merge; producer candidate remains unversioned until its automatic release                                                  | exact-head validation above and release-version tests     |
