# Plan

1. Record approval, preserved contract, and DTE traceability.
2. Merge current `main` and retain its V4-only template documentation and coverage.
3. Harden workflow inputs, every governed path and output component, complete configuration/provenance hashing, exact workflow/collector byte identity, complete isolated-handoff revalidation, no-follow entry-by-entry image-context construction, GitHub command-file output writes, and artifact upload.
4. Isolate application-controlled work in a credential-free build job, verify post-build source integrity, then attest and submit from a separate OIDC-authorized handoff job using exact step-local inputs.
5. Preserve existing workflow input compatibility with explicit conflict validation.
6. Keep app-key and environment validation aligned with the generated-runtime and deployment contracts.
7. Expand owned tests, run the repository validation suite, and publish no release.
8. Recompute the complete governed configuration from exact commit GitHub reads at handoff and bind every generated output write to stable parent and leaf identities.
9. Bind authenticated readiness to TenantInfra's exact active deployment ID, preserve the response schema, and cover exact, missing, and substituted deployment identities in owned route and runtime-contract tests.
10. Revalidate the bound GitHub output descriptor, exact leaf path, and complete parent chain after each trusted append, with a deterministic replacement-race regression.
11. Reapply canonical runtime provenance validation in the isolated OIDC handoff, create generated files exclusively, and bind governed-file size and timestamps before every read.
12. Retain same-repository reusable workflow compatibility for manually dispatched callers, reject unsupported caller events before source checkout, and rely on PublicAPI's signed caller/callee OIDC claim binding without restoring a long-lived token.
13. Replace whole-file archive hashing in the isolated handoff with a bounded fixed-buffer no-follow read that revalidates the opened file identity.
14. Read collector metadata and governed configuration only through fixed-size descriptor loops capped by an explicit per-file limit, and reject growth beyond the opened snapshot before allocating more memory.
15. Bind copied generated-tree and archive sources to pre-open size, modification time, and change time, and use the same 10 MiB per-file, 32 MiB total, and 4,096-file governed-manifest limits in collector and isolated handoff.
16. Hash the collector's staged archive only through its opened size with a fixed buffer and one-byte growth probe; no collector stream or descriptor read may continue to EOF without an explicit bound.
17. Cap the PublicAPI handoff response at 1 MiB during transfer, then parse it through bounded no-follow inline code in the clean handoff job instead of checking out or executing repository code with OIDC authority; keep the collector command subject to the same response-file rules for standalone use.
18. Read downloaded build evidence through a bounded no-follow descriptor and cap every GitHub provenance response before parsing or retaining bytes, including exact-source files, commit/tree/blob metadata, artifact metadata, and the OIDC token response.
19. Preserve the historical reusable-call schema by deriving the exact governed configuration digest when `workflow_call` omits `config_hash`, while keeping the direct dispatch input required and rejecting any supplied mismatch before application work.
20. Replace the OIDC token command-substitution response buffer with an actual-stream byte counter so unknown-length and chunked responses cannot bypass the 1 MiB cap.
21. Verify the actual bounded OCI manifest blob bytes selected by the archive index before OIDC, and reject descriptor-only digest agreement.
22. Route every collector no-follow open through one fail-closed capability helper and prove the flag cannot silently degrade to zero.
23. Preserve local Windows configuration hashing through a command-scoped read-only fallback with the same complete path and descriptor binding, while keeping every deployment command fail closed when secure open flags are unavailable.
24. Validate the OCI layout marker and the bound manifest's configuration and layer descriptor structure, family, count, and byte limits, then stream each unique referenced blob once and verify its regular member type, path, size, and digest before OIDC. Count both archive-member and validator records to reject mixed-type duplicates, keep the full 1,024-layer expected table below Linux's per-string execution limit, and derive the validator output cap so the complete valid maximum fits while any extra record fails.
25. Route Buildx OCI bytes through collector-owned stdout into an exclusively opened no-follow descriptor, derive metadata from that bound archive, and revalidate the exact output without exposing a mutable Buildx destination path.
26. Bind every copied, generated, and evidence destination to its exact expected byte length and single-link identity after writing.
27. Reject an empty or malformed direct-dispatch commit before checkout while preserving the signed same-repository reusable caller SHA fallback.
28. Retain the canonical algorithm-qualified GitHub REST artifact digest comparison and record its live/API contract evidence.
