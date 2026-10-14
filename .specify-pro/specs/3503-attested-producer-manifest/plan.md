# Plan: Release-attested template producer manifests

- **Engineer:** Van / #3503 delivery team
- **Primary repo:** `eai-support/eai-app-template`
- **Issue:** `enterpriseaigroup/Issues2025#3503`
- **Status:** draft; no feature implementation or merge authorized by this document

## 1. Why — business outcome

Every new approved app-template commit currently needs a separate AdminAPI and PublicAPI code change that adds its commit and workflow/collector hashes to static allowlists. AdminAPI #475 and PublicAPI #1106 did this for v1.0.17. That is a release bottleneck and makes a one-off local customer fixture look like a product release. The outcome is that an independently verified template release can be adopted without new backend code while unreviewed workflow bytes still fail closed. Success is a subsequent template version entering the customer deployment path through one release manifest and normal product pin/config adoption, with no new per-version AdminAPI/PublicAPI code PR.

## 2. Customer journey

The customer's Installer and CLI journey does not gain a step or click. Today the customer selects EAI-managed deployment, reviews the initial PR, and later updates the same repository; a new template version may fail producer admission until both services ship hardcoded hashes. In the proposed journey, release engineering publishes an attested template manifest, the CLI/Installer pin its immutable digest, and the customer proceeds through the same reviewed PR and deployment. Both services verify the exact release identity and bytes independently. The historical operation stays bound to the producer selected when it started. The customer-facing click count is unchanged.

## 3. Ecosystem scan

The skill's ecosystem discovery searched repositories in `enterpriseaigroup`, `eai-support`, `EAI-Website`, `EAI-verticals`, `eai-connectors`, and `eai-generated-apps` for `producer-pin.json`, `CLI_ENVIRONMENT_PRODUCERS`, and `eai.cli_managed_deployment_producer.v1`. Direct consumers found: template release workflow; CLI producer pin/verification; Installer packed-CLI verifier; AdminAPI operation/anchor verification; PublicAPI OIDC, customer-commit verifier, and model; Portal dispatch; TenantInfra transfer model; `eai-testing-dev` contract evidence. Reuse the existing anchor HMAC, GitHub OIDC allowlist, exact Git-blob reads, and release pin contracts. Existing AdminAPI #478 and PublicAPI #1108 are retained-customer local-fixture compatibility drafts; they must not be merged as product release maps. The existing template `3503-eai-managed-deploy/plan.md` is a task list, not an approval record for this feature.

## 4. Blast radius

This spans the template release workflow and the AdminAPI/PublicAPI producer-admission contract. It also changes the CLI release pin shape, Installer verification, and possibly Portal's source-planning request; TenantInfra must continue receiving the exact selected workflow/collector pair. `eai-testing-dev` owns a small deployed contract after the stable boundary changes. Change kinds: auth/provenance boundary, workflow release artifact, shared request/response shape, and possibly runtime configuration. No new Payload collection, OPA policy, queue, or Bicep module is proposed. Cross-project checklist: template publishes verified manifest; CLI pins it; Installer preserves/verifies the pin; AdminAPI seals it; PublicAPI independently verifies it; Portal passes it without choosing bytes; TenantInfra checks the same exact pair; tests cover old and new operation formats. Importer search found the above consumers; a later diff-based blast-radius scan remains required before any merge.

## 5. Multi-tenancy

1. JWT and tenant context remain on existing authenticated routes; the manifest is a global template-release artifact and cannot identify or select a tenant. 2. Operation and source-anchor database reads retain their existing tenant and app predicates. 3. No new OPA collection or permissive rule is proposed; existing route authorization must remain unchanged. 4. No new queue message is proposed; existing deployment messages retain tenant ID. 5. No role is added or elevated. 6. Regional PublicAPI remains the deployment gateway; no backend obtains direct Payload access. A customer-supplied manifest URL, repository, or signer is never trusted as authority. The final diff must be reviewed under `opa-auth-review` for any route or authorization edits.

## 6. Multi-region

The manifest represents one global, public template release, while each operation is still scoped to its existing tenant, app, home region, and regional PublicAPI. No `homeRegion` format change is proposed (`au` remains distinct from Azure `ae`). Verification must use the same pinned digest in AU, CC, and GWC, with bounded regional fetch/cache behavior and fail-closed errors. New App Configuration is deferred unless implementation proves a need; if introduced it must be defined in Infra2025 for all environments and read back live.

## 7. Architecture

```mermaid
flowchart LR
  T[Template CI and release] --> M[Attested immutable manifest]
  M --> C[CLI release pin]
  C --> I[Installer package verifier]
  C --> A[AdminAPI independent verifier]
  M --> P[PublicAPI independent verifier]
  A --> O[Sealed operation and source anchor]
  O --> P
  P --> G[Exact customer Git tree and GitHub OIDC]
  G --> N[TenantInfra exact-commit deployment]
```

Manifest v1 binds the canonical repository ID `1205696460`, release tag, exact template commit, producer workflow path and SHA-256, collector path and SHA-256, and release CI provenance. Its canonical bytes, digest, attestation bundle, and trusted workflow identity form one release artifact. New operations store a manifest reference/digest plus the exact producer pair in the existing HMAC-sealed operation/anchor. Existing operations without a manifest use the existing static map only; migration never recomputes their producer from today's release.

## 8. Flows

### Happy path

```mermaid
sequenceDiagram
  participant R as Template release
  participant C as CLI/Installer
  participant A as AdminAPI
  participant P as PublicAPI
  participant G as GitHub
  participant T as TenantInfra
  R->>R: Verify exact main CI and producer blob hashes
  R->>G: Publish manifest plus attest exact bytes
  C->>C: Pin release tag, commit, manifest digest
  C->>A: Start source operation with pinned release identity
  A->>G: Fetch and verify trusted manifest independently
  A->>A: HMAC-seal manifest digest and exact producer
  A->>P: Pass sealed operation/anchor
  P->>G: Fetch and verify manifest independently
  P->>G: Read customer merged tree and OIDC claims
  P->>T: Handoff exact accepted producer and commit
```

### Failure paths

Unauthenticated or wrong-tenant requests retain current 401/403 and no manifest lookup. A malformed version, untrusted repository/signer, invalid attestation, moved tag, manifest digest mismatch, workflow/collector mismatch, or missing release CI is 409 and cannot create a deployment. GitHub timeout/5xx is a bounded retriable 503; no static-map fallback for a new operation. A release upload that partially succeeds never marks the manifest usable. Existing sealed operations continue under their original static entry or pinned verified manifest even after newer releases; retries never substitute current template defaults. Portal/CLI show the existing actionable producer-admission error without exposing credentials.

## 9. UI/UX

N/A — this is a release and backend trust contract, not a new screen. Existing Installer/Portal error surfaces should render the bounded admission error. The customer journey and click count stay unchanged.

## 10. Performance, scalability, responsiveness

The number of releases is low relative to deployment operations. Verification should fetch bounded JSON/bundle bytes only on cache miss, keyed by immutable manifest digest and trusted repository/release identity; caches must never turn a bad signature into acceptance. The existing GitHub exact-tree checks still dominate deployment latency. At 10x rate, GitHub API rate limits or attestation-service availability break first; use a bounded timeout and negative-cache only transient failures briefly. No unbounded release-history scan on each request. Exact limits and expiry require performance tests before rollout.

## 11. Infra and config

The intended MVP reuses the template GitHub release, GitHub Actions attestation, existing service GitHub App credentials, and current operation storage. No new Azure resource, secret, or environment variable is assumed. Template tag/release protection and privileged workflow path protection are required release controls, not merely source-code comments. The live GitHub rules read for `eai-support/eai-app-template` currently shows only an organization Copilot-review rule on `main`, and the branch-protection endpoint reports unprotected. Its v1.0.17 release API says `immutable: false` and has no release assets. The existing release workflow also allows manual dispatch without an exact-commit CI check. GitHub documents [tag rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), [release immutability](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/establish-provenance-and-integrity/prevent-release-changes), and [artifact-attestation verification](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/verify-attestations-offline). The `gh attestation verify` contract requires checking signed certificate identity/repository ID and signer workflow, because predicate fields are workflow-controlled. OPEN QUESTION: who owns enabling and recording tag/release/workflow protection, and which verified attestation API/library works in both backend runtimes without a shared secret? If configuration is required, Infra2025 owns DEV/TEST/PROD/region parity and live readback.

## 12. Options and reasoning

### Option A — Continue per-version backend allowlists

Lowest one-release implementation cost and no new network dependency. Every template release still requires coordinated AdminAPI/PublicAPI PRs and deployment; local fixture entries can accidentally become product policy. Rejected as the steady state.

### Option B — Release-attested manifest, independently verified

One-time cross-repo work and a stronger explicit release trust chain. Later releases publish one immutable manifest and update normal CLI/Installer/config pins. Costs: attestation verification, release ruleset/CI enforcement, bounded caching, historical dual-read, and rollback tests. Provisional choice because it meets the outcome without relaxing exact-byte checks.

### Option C — Trust CLI-provided digest alone

Smallest service change, but lets a caller select its own trusted workflow bytes unless independently bound to a protected release. Rejected for a security boundary.

### Decision

Propose Option B. OPEN QUESTION: Product and CEO must agree the initial MVP versus later cleanup, and the exact trust anchor for a GitHub artifact attestation must pass security review. The AI recommendation is Option B; no engineer/stakeholder decision has been recorded yet.

## 13. Test and release evidence

Template CI must test canonical manifest generation from the exact Git tree, successful exact-main CI requirement, trusted repo ID, tag/commit consistency, release/asset immutability behavior, and tamper/partial-upload failures. AdminAPI and PublicAPI each need independent unit/contract tests for valid manifest, bad signer, wrong repo, wrong SHA/digest, changed workflow/collector bytes, timeout, historical operation, and multiple template versions without code edits. CLI and Installer must verify packaged pin and release asset, including Windows/macOS/Linux portability. TenantInfra must preserve exact selected producer. Update each owner's `.eai/test-coverage.json`; add one deterministic DEV deployed contract in `eai-testing-dev` after the stable boundary exists. Green CI alone does not sign off #3503: run a new customer journey, exact deploy, HTTPS, and independent Saved Task readback. Cross-service review and blast-radius scans precede merge.

## 14. MVP negotiation (80:20)

### In MVP

Proposed: one trusted manifest per future template release; exact-byte and attestation verification independently in AdminAPI/PublicAPI; manifest digest sealed per new operation; historical static-map dual-read; CLI/Installer pin verification; owning tests and one deployed contract. This is a proposal, not an approved commitment.

### Deferred

Remove legacy static entries only after every historical operation has aged out with audited evidence. Portal UI changes, broad producer registry admin UI, and general third-party template support.

### Cut

None proposed.

### Decision log

- OPEN QUESTION: Product approval name and date.
- OPEN QUESTION: CEO approval name and date.
- OPEN QUESTION: security owner confirms attestation verifier and tag/release protection before implementation.
