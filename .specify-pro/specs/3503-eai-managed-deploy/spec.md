# Issue #3503: authenticated generated-app build evidence

## Approval and scope

The owner approved this hardening scope on 2026-09-25. It covers reviewed provenance, identity, compatibility, credential-safety, and workflow fixes while preserving both successful source-mode journeys. It does not authorize merge, release, deployment, activation, billing, or destructive live tests.

Canonical amendment: https://github.com/enterpriseaigroup/Issues2025/issues/3503#issuecomment-5826177803

## Preserved user contract

- The workflow supports both `source-unknown` and `eai-cli-generated` sources.
- Existing callers using the prior `environment` input remain compatible while `env` is supported.
- Exact commit build and evidence submission remain the workflow outcome.
- No long-lived EAI, GitHub App, Azure, or platform credential is exposed to application scripts.

## Requirements

- **DTE-018:** hash all governed configuration source and runtime provenance inputs, including nested `.test.*` and `.spec.*` files and the deployment contract; exclude only the two deterministic generated Object Type outputs, reject live and dangling links in every governed path component plus every nonregular filesystem entry, recheck ancestors before reading, and accept the canonical base-template, approved-source, or approved-release provenance anchors without an unbound fixture fallback.
- **DTE-020, DTE-021:** expose a canonical workflow/collector pair, declare all dispatch inputs, preserve explicitly empty optional aliases, and reject malformed operation/path values before URL construction. Apply the generated-runtime app-key grammar at every validation stage and retain every deployment environment supported by the template contract, including `demo`.
- **DTE-022:** explicitly upload the hidden build artifact, prove it is a nonempty no-follow regular file with size and digest evidence, and create the image context, archive metadata, and evidence output only through confined no-link directory trees without replacing an existing evidence file. Copy standalone, static, and public trees entry by entry without following nested links or accepting nonregular files.
- **DTE-023:** pin actions and base images to immutable commits or digests.
- **DTE-024:** emit a standard artifact provenance attestation where the repository/action capability supports it.
- **DTE-025:** run application-controlled install/build/test work in a job without OIDC authority, verify post-build source integrity, and perform attestation and handoff in a separate job that receives only immutable artifacts and exact dispatch inputs. Revalidate the downloaded evidence against the exact one-time nonce before requesting OIDC. Never select the endpoint from a mutable secret, persist credentials into app-visible files, or allow provenance values to inject additional GitHub outputs.
- **DTE-026:** preserve existing workflow inputs additively and test conflict/precedence behavior.
- **DTE-086 through DTE-088:** integrate current `main`, rerun owned checks, and defer the release tag/commit until the producer is actually released.

## Acceptance

1. Both source modes validate operation, nonce, canonical app key, tenant, every template-supported environment, workflow, ref, and commit before composing an evidence URL. `eai-cli-generated` requires and validates the exact target tenant; the legacy `source-unknown` contract validates it when supplied without making the compatibility input mandatory. Explicitly empty optional aliases remain empty and do not become boolean flags.
2. Configuration and provenance hashes change for every governed source input, including `.test.*` and `.spec.*` files, remain stable only across the two deterministic generated Object Type outputs, and reject dangling or live symlinks in a governed entry or any ancestor plus FIFOs, sockets, devices, and other nonregular entries.
3. Runtime provenance preserves and validates any canonical approved source anchor.
4. Hidden OCI artifacts upload with a nonzero size and digest; EAI evidence and standard attestation identify the same subject. Image-context preparation, archive inspection, metadata, and evidence creation reject a linked or non-directory ancestor, linked or existing evidence files, paths outside the application root, and links or nonregular entries nested in standalone, static, or public source trees, including an application-controlled `.eai-build` replacement after the build.
5. Existing `environment` callers and new `env` callers work; conflicting values fail.
6. All third-party workflow actions and the OCI base image use immutable identities.
7. Application lifecycle code cannot request the handoff OIDC token or change the validated endpoint; a post-build integrity check rejects source mutation before evidence collection, the handoff rejects evidence with a different nonce before requesting OIDC, and every value appended to `$GITHUB_OUTPUT` is a single safe line.
8. Owned validation and evidence-collector tests pass on current `main`.
