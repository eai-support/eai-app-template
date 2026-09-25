# Plan

1. Record approval, preserved contract, and DTE traceability.
2. Merge current `main` and retain its V4-only template documentation and coverage.
3. Harden workflow inputs, every governed path and output component, complete configuration/provenance hashing, no-follow entry-by-entry image-context construction, GitHub command-file output writes, and artifact upload.
4. Isolate application-controlled work in a credential-free build job, verify post-build source integrity, then attest and submit from a separate OIDC-authorized handoff job using exact step-local inputs.
5. Preserve existing workflow input compatibility with explicit conflict validation.
6. Keep app-key and environment validation aligned with the generated-runtime and deployment contracts.
7. Expand owned tests, run the repository validation suite, and publish no release.
