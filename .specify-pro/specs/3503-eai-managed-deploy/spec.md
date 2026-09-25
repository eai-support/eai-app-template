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

- **DTE-018:** hash all governed configuration and runtime provenance inputs, including nested files and the deployment contract; no unbound fixture fallback.
- **DTE-020, DTE-021:** expose a canonical workflow/collector pair, declare all dispatch inputs, and reject malformed operation/path values before URL construction.
- **DTE-022:** explicitly upload the hidden build artifact and prove it is nonempty with size and digest evidence.
- **DTE-023:** pin actions and base images to immutable commits or digests.
- **DTE-024:** emit a standard artifact provenance attestation where the repository/action capability supports it.
- **DTE-025:** request credentials only after application-controlled install/build/test work and never persist them into app-visible files.
- **DTE-026:** preserve existing workflow inputs additively and test conflict/precedence behavior.
- **DTE-086 through DTE-088:** integrate current `main`, rerun owned checks, and defer the release tag/commit until the producer is actually released.

## Acceptance

1. Both source modes validate operation, nonce, app, tenant, target tenant, environment, workflow, ref, and commit before composing an evidence URL.
2. Configuration and provenance hashes change for every governed nested input.
3. Hidden OCI artifacts upload with a nonzero size and digest; EAI evidence and standard attestation identify the same subject.
4. Existing `environment` callers and new `env` callers work; conflicting values fail.
5. All third-party workflow actions and the OCI base image use immutable identities.
6. Owned validation and evidence-collector tests pass on current `main`.
