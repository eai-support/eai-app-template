# Plan: Release-attested template producer manifests

- **Engineer:** Van / #3503 delivery team
- **Primary repo:** `eai-support/eai-app-template`
- **Issue:** `enterpriseaigroup/Issues2025#3503`
- **Status:** original new-source MVP approved for isolated branch implementation; retained-customer successor amendment in Section 14 awaits separate Product and CEO approval; release activation and merge remain gated by the controls and evidence below

## 1. Why — business outcome

Every new approved app-template commit currently needs a separate AdminAPI and PublicAPI code change that adds its commit and workflow/collector hashes to static allowlists. Template release 1.0.17 required AdminAPI #475 and PublicAPI #1106. That is a release bottleneck and makes a one-off local customer fixture look like a product release. The outcome is that an independently verified template release can be adopted without new backend code while unreviewed workflow bytes still fail closed. Success is a subsequent template version entering the customer deployment path through one release manifest and normal product pin/config adoption, with no new per-version AdminAPI/PublicAPI code PR.

## 2. Customer journey

The customer's Installer and CLI journey does not gain a step or click. Today the customer selects EAI-managed deployment, reviews the initial PR, and later updates the same repository; a new template version may fail producer admission until both services ship hardcoded hashes. In the proposed journey, release engineering publishes an attested template manifest, the CLI/Installer pin its immutable digest, and the customer proceeds through the same reviewed PR and deployment. Both services verify the exact release identity and bytes independently. The historical operation stays bound to the producer selected when it started. The customer-facing click count is unchanged.

## 3. Ecosystem scan

The skill's ecosystem discovery searched repositories in `enterpriseaigroup`, `eai-support`, `EAI-Website`, `EAI-verticals`, `eai-connectors`, and `eai-generated-apps` for `producer-pin.json`, `CLI_ENVIRONMENT_PRODUCERS`, and `eai.cli_managed_deployment_producer.v1`. Direct consumers found: template release workflow; CLI producer pin/verification; Installer packed-CLI verifier; AdminAPI operation/anchor verification; PublicAPI OIDC, customer-commit verifier, and model; Portal dispatch; TenantInfra transfer model; `eai-testing-dev` contract evidence. Reuse the existing anchor HMAC, GitHub OIDC allowlist, exact Git-blob reads, and release pin contracts. Existing AdminAPI #478 and PublicAPI #1108 are retained-customer local-fixture compatibility drafts; they must not be merged as product release maps. The existing template `3503-eai-managed-deploy/plan.md` is a task list, not an approval record for this feature.

## 4. Blast radius

This spans the template release workflow and the AdminAPI/PublicAPI producer-admission contract. It also changes the CLI release pin shape, Installer verification, and possibly Portal's source-planning request; TenantInfra must continue receiving the exact selected workflow/collector pair. `eai-testing-dev` owns a small deployed contract after the stable boundary changes. Change kinds: auth/provenance boundary, workflow release artifact, shared request/response shape, and possibly runtime configuration. No new Payload collection, OPA policy, queue, or Bicep module is proposed. Cross-project checklist: template publishes verified manifest; CLI pins it; Installer preserves/verifies the pin; AdminAPI seals it; PublicAPI independently verifies it; Portal passes it without choosing bytes; TenantInfra checks the same exact pair; tests cover old and new operation formats. Importer search found the above consumers; a later diff-based blast-radius scan remains required before any merge.

## 5. Multi-tenancy

1. JWT and tenant context remain on existing authenticated routes; the manifest is a global template-release artifact and cannot identify or select a tenant. 2. Operation and source-anchor database reads retain their existing tenant and app predicates. 3. No new OPA collection or permissive rule is proposed; existing route authorization must remain unchanged. 4. No new queue message is proposed; existing deployment messages retain tenant ID. 5. No role is added or elevated. 6. Regional PublicAPI remains the deployment gateway; no backend obtains direct Payload access. A customer-supplied manifest URL, repository, or signer is never trusted as authority. The final diff must be reviewed under `opa-auth-review` for any route or authorization edits.

## 6. Multi-region

The manifest represents one global, public template release, while each operation is still scoped to its existing tenant, app, home region, and regional PublicAPI. No `homeRegion` format change is proposed (`au` remains distinct from Azure `ae`). Verification must use the same pinned digest in AU, CC, and GWC, with bounded regional fetch/cache behavior and fail-closed errors. Both AdminAPI and PublicAPI production images use Python 3.14; TypeScript verification is needed for the CLI and Installer package. New App Configuration is deferred unless implementation proves a need; if introduced it must be defined in Infra2025 for all environments and read back live.

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

Manifest v1 binds the canonical repository ID `1205696460`, release tag, exact template commit, producer workflow path and SHA-256, collector path and SHA-256, and release CI provenance. Its canonical bytes, digest, GitHub artifact-attestation bundle, and trusted workflow identity form one release artifact. AdminAPI and PublicAPI each run a pinned `gh attestation verify` binary against those same immutable bytes and a TUF-validated trusted root, then independently check the verified certificate's source repository ID, workflow identity, commit, ref, subject digest, and manifest fields. A repository name or workflow-controlled predicate alone is insufficient. New operations store a manifest reference/digest plus the exact producer pair in the existing HMAC-sealed operation/anchor. Existing operations without a manifest use the existing static map only; migration never recomputes their producer from today's release.

**Proposed DEV branch-candidate boundary (not part of the approved MVP):** The current release workflow accepts only a successful exact-main push and signs `refs/heads/main`; it cannot attest an unmerged PR branch as a release. For isolated customer proof of **product code intended for release**, use a distinct `eai.template_producer_candidate.v1` manifest produced from the exact canonical-repository branch `refs/heads/feat/3503-attested-producer-release`, after an exact-head independent review and a no-bypass branch ruleset are recorded. Its signed bytes bind repository ID, full branch ref, 40-character source SHA, producer workflow and collector paths/blob SHA-256s, Actions workflow path, run ID/attempt, and expiry. After attestation and artifact upload, a separate DEV admission envelope binds the manifest subject digest to GitHub artifact ID/digest and run ID/attempt; the manifest cannot self-reference an artifact ID assigned after upload. It has **no semver release tag** and is never uploaded to or accepted as an immutable GitHub Release. A candidate artifact is content-addressed but expires with its Actions retention; a branch name, green PR checks, or an Actions artifact without the verified signed bundle is not authority. Its type cannot be parsed as release manifest v1. The candidate is not a route for promoting a local-E2E-only customer patch into canonical release policy.

With the user's one-branch rule, first finish and independently review the existing PR branch at an exact SHA. Then activate and read back an exact-ref ruleset that freezes updates/deletion/force pushes with no bypass; retain the required CI results and review receipt for that SHA. A `push` trigger on the branch can create the candidate workflow run before the freeze. **Rerun that same run at the same SHA only after the freeze is effective**, and accept only the attestation and artifact generated in this later run attempt; record its start time after ruleset activation. An unmerged `workflow_dispatch`-only workflow is not sufficient because GitHub requires the workflow file on the default branch. A future implementation must verify exact successful CI for the same head before attestation, then verify the Actions run's repository ID, event=`push`, ref, head SHA, rerun attempt, completed success, artifact ID/digest and signed certificate identity/subject. The signer identity must name the canonical repository and candidate workflow at that **exact branch ref**; never reuse the production `release.yml@refs/heads/main` identity. If the branch moves, its rule is disabled/bypassed, or the artifact expires, reject new candidate admissions. Existing sealed candidate operations remain readable; any retry or redeploy must reverify the same candidate within its eligibility window, never silently upgrade it to a release or a newer branch head.

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

For the proposed DEV candidate, a caller cannot choose a branch or artifact as its own trust root. A DEV server-side, short-lived, exact tenant/app/operation-scope candidate admission record must be reviewed and enabled separately from production release admission. AdminAPI and PublicAPI independently verify the same pinned candidate bytes and signed claims, then compare the customer's merged Git-tree workflow/collector pair and OIDC evidence to those bytes. Production and TEST reject the candidate type even if the caller sends the same digest. Wrong scope, missing branch protection or review, PR merge-ref attestation, branch/head movement, expired/deleted artifact, changed archive/manifest, wrong run or signer, mixed producer pair, or a second candidate field are hard failures with no fallback to a static allowlist. Customer GitHub `refs/heads/main` OIDC is checked separately from the *template* candidate ref. A candidate proves a DEV path only; production eligibility still requires a new, immutable, main-derived release and a separately authorized operation. GitHub [documents](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onworkflow_dispatch) the default-branch requirement for `workflow_dispatch`, [artifact metadata](https://docs.github.com/en/rest/actions/artifacts), and [branch rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).

## 9. UI/UX

N/A — this is a release and backend trust contract, not a new screen. Existing Installer/Portal error surfaces should render the bounded admission error. The customer journey and click count stay unchanged.

## 10. Performance, scalability, responsiveness

The number of releases is low relative to deployment operations. Verification should fetch bounded JSON/bundle bytes only on cache miss, keyed by immutable manifest digest and trusted repository/release identity; caches must never turn a bad signature into acceptance. The existing GitHub exact-tree checks still dominate deployment latency. At 10x rate, GitHub API rate limits or attestation-service availability break first; use a bounded timeout and negative-cache only transient failures briefly. No unbounded release-history scan on each request. Exact limits and expiry require performance tests before rollout.

## 11. Infra and config

The MVP reuses the template GitHub release, GitHub Actions artifact attestation, existing service GitHub App credentials, and current operation storage. The only new backend runtime component is a version-pinned GitHub CLI verifier packaged in the AdminAPI and PublicAPI images; its GitHub TUF trust root is refreshed and cached with a bounded policy, while an imported `trusted_root.jsonl` plus bundle permits offline verification. No new Azure resource or backend signing secret is assumed. The release workflow does require a repository-scoped GitHub App ID variable and private-key secret for its read-only immutability preflight; these are not yet provisioned. A real GitHub Actions DSSE bundle was verified offline with `gh 2.96.0` against its artifact, exact repository, workflow, source SHA, and ref; a changed artifact and wrong source SHA were rejected. Python `sigstore` cannot parse GitHub's TSA-only bundle, so it is not an acceptable verifier fallback. The CLI/Installer pin verifies the manifest SHA-256 and exact release identity; both backends independently verify its attestation.

Control readback on 2026-10-16 (Australia/Sydney) found repository immutable releases enabled for **future** releases (`enabled: true`, `enforced_by_owner: false`). Active tag ruleset [`25162501`](https://github.com/eai-support/eai-app-template/settings/rules/25162501) matches `refs/tags/v*` and blocks updates and deletions. Active main ruleset [`25162756`](https://github.com/eai-support/eai-app-template/settings/rules/25162756) requires pull requests, resolved review threads, squash merge, strict `validate`, Linux/macOS/Windows portability, and `plan-gate` checks; its required approving review count is currently zero. This protects release-workflow edits through the main PR path but is not a separate path-specific owner approval. The draft release workflow now requires exact-main successful push CI, two immutable-setting reads, exact peeled remote tag SHA, and pre/post-publication asset-byte readback. The existing v1.0.17 release is not retroactively immutable (`immutable: false`) and has no manifest assets. Neither these rulesets nor green draft CI constitute a genuine EAI release attestation or customer sign-off.

Activation remains blocked on the repository-only `TEMPLATE_RELEASE_ADMIN_READ_APP_ID` variable and `TEMPLATE_RELEASE_ADMIN_READ_PRIVATE_KEY` secret for a dedicated GitHub App installed only on `eai-support/eai-app-template` with Administration(read), a named release/security owner and completed control receipts, a genuine immutable template release with matching attestation and verified assets, and a reviewed branch-candidate contract for isolated DEV proof before main activation. Until then producer admission remains disabled and historical operations keep their existing pins. GitHub documents [tag rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets), [release immutability](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/establish-provenance-and-integrity/prevent-release-changes), and [offline artifact-attestation verification](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/verify-attestations-offline). The `gh attestation verify` result must be checked for signed certificate source repository ID and signer workflow; predicate fields are workflow-controlled. If new App Configuration is required, Infra2025 owns DEV/TEST/PROD/region parity and live readback.

The active rulesets named above cover `main` and `refs/tags/v*`; **they do not protect the proposed candidate branch**. Before the DEV candidate attestation rerun, independently read back an exact-ref, no-bypass freeze rule, required CI and review receipts for the final branch head, and the trusted candidate workflow blob; the initial push attempt is never an eligible candidate. Store the candidate admission record only in the local DEV authority for the named fixture tenant/app, with a short expiry and no global fallback. Do not add a candidate acceptance switch to TEST/PROD configuration. GitHub Actions artifact storage is not an immutable release; preserve the downloaded manifest, signed bundle, API run/artifact metadata, ruleset readback, and verifier output as bounded private receipts before expiry.

## 12. Options and reasoning

### Option A — Continue per-version backend allowlists

Lowest one-release implementation cost and no new network dependency. Every template release still requires coordinated AdminAPI/PublicAPI PRs and deployment; local fixture entries can accidentally become product policy. Rejected as the steady state.

### Option B — Release-attested manifest, independently verified

One-time cross-repo work and a stronger explicit release trust chain. Later releases publish one immutable manifest and update normal CLI/Installer/config pins. Costs: attestation verification, release ruleset/CI enforcement, bounded caching, historical dual-read, and rollback tests. Provisional choice because it meets the outcome without relaxing exact-byte checks.

### Option C — Trust CLI-provided digest alone

Smallest service change, but lets a caller select its own trusted workflow bytes unless independently bound to a protected release. Rejected for a security boundary.

### Decision

Choose Option B for the 80:20 MVP. Use GitHub's version-pinned CLI as the common cryptographic verifier in both Python services; each service still independently fetches and checks the attestation and manifest. CLI/Installer verify their packaged manifest digest and release pin. The security boundary remains disabled until the template release/security owner supplies the live protection receipts in Section 11 and the exact verifier package plus signed-field checks pass review. Product and CEO approvals below authorize branch implementation and validation, not an unprotected release or customer sign-off.

## 13. Test and release evidence

Template CI must test canonical manifest generation from the exact Git tree, successful exact-main CI requirement, trusted repo ID, tag/commit consistency, release/asset immutability behavior, and tamper/partial-upload failures. AdminAPI and PublicAPI each need independent unit/contract tests for valid manifest, bad signer, wrong repo, wrong SHA/digest, changed workflow/collector bytes, timeout, historical operation, and multiple template versions without code edits. CLI and Installer must verify packaged pin and release asset, including Windows/macOS/Linux portability. TenantInfra must preserve exact selected producer. Update each owner's `.eai/test-coverage.json`; add one deterministic DEV deployed contract in `eai-testing-dev` after the stable boundary exists. Green CI alone does not sign off #3503: run a new customer journey, exact deploy, HTTPS, and independent Saved Task readback. Cross-service review and blast-radius scans precede merge.

If the proposed DEV candidate is approved, run separate negative tests for unprotected/moved/deleted branch, missing exact-head independent review, failed/mismatched CI, `pull_request` merge-ref instead of branch `push`, wrong run ID/attempt or expired artifact, tampered archive/manifest/bundle, wrong certificate workflow/repository ID/ref/SHA/subject, candidate accepted in TEST/PROD, wrong tenant/app, and dual release+candidate fields. On 2026-10-16 the canonical Template collector reads `f20a4291…`; customer PR #16's `5e35010c…` differs only in the local-tunnel predecessor check. Do not make that test-only delta eligible by copying it into the release branch. A branch DEV proof must use the exact reviewed product pair, a newly authorized successor operation, accepted deployment, HTTPS, and an independent hosted read of the same Saved Task. A later main-derived release gets its own exact artifact/digest and new operation; a successful candidate does not auto-promote.

## 14. MVP negotiation (80:20)

### In MVP

Approved: one trusted manifest per future template release; exact-byte and attestation verification independently in AdminAPI/PublicAPI; manifest digest sealed per new operation; historical static-map dual-read; CLI/Installer pin verification; owning tests and one deployed contract. Development stays in isolated branches and DEV runs from exact checkouts before a merge decision. No new manifest may be admitted before Section 11 trust controls are recorded.

### Deferred

Remove legacy static entries only after every historical operation has aged out with audited evidence. Portal UI changes, broad producer registry admin UI, and general third-party template support.

### Cut

None proposed.

### Decision log

- Product: Vandana Rao Emaneni, 2026-10-15 (Australia/Sydney), approved this Section 14 MVP in chat.
- CEO: Vandana Rao Emaneni, 2026-10-15 (Australia/Sydney), approved this Section 14 MVP in chat.
- The offline trust spike selected `gh attestation verify` with exact signed-field checks; this permits isolated branch implementation. The template release/security owner must be named and provide live tag, workflow, release-immutability, CI, and verifier-package receipts before activation or merge. This approval does not waive those controls.

### Proposed retained-customer successor amendment — pending Product and CEO approval

The approved MVP binds a manifest to a **new source operation's original** template commit. It does not authorize an older retained operation to change its original producer identity. For the retained customer app, the committed source marker still names template `c8a8aed26c4d159a4fa2598d9b5e8a495203dd8b` and its historical predecessor. The current successor dispatch names a later, server-sealed predecessor. Customer PR #16 correctly leaves the historical marker intact. Its workflow SHA-256 is `74ede3c4e1de12fa5f63135349e61365bd845443dbb4dbe51573d8c490baa1d5`, but its changed local-DEV collector SHA-256 is `5e35010c3d26aeac691f5dfc536eef9781b34f82ea1557a72497e49fceb00c1e`; the released v1.0.17 collector is `f20a4291b03b6f877ebaa9bdba9c2c2a839225d181c23b8be19a617a25536dc6`. The five-line PR #16 delta affects only `localE2eBinding`: it removes equality between the historical committed marker predecessor and the current server-supplied predecessor, retaining ID-shape and non-self checks. The normal regional PublicAPI path does not run that marker comparison; the local path is gated to direct DEV/preview `workflow_dispatch` and an expiring devtunnel URL. This is a local-E2E compatibility patch, **not a product collector release requirement**. Neither the current static pair nor the approved new-source manifest contract admits PR #16's pair. A customer-only digest must not become a global allowlist entry.

**Proposed addition to In MVP, only after a new dated decision:** A *newly authorized customer successor operation* may select a separately attested, immutable producer release from the canonical template repository. Keep the original template commit, original producer profile, completed source anchor, historical marker, repository identity, and predecessor chain unchanged. Seal the selected release tag, manifest digest, release commit, and exact workflow/collector pair on that new operation as a distinct `successorProducerManifest`; never derive it from a mutable default or a caller-supplied digest alone. A separate `successorProducerCandidate` variant may select the exact protected, signed, expiring branch candidate above **only for the named DEV fixture**; the two variants are mutually exclusive and both are HMAC-sealed with the selected exact pair. The customer-merged Git tree and workflow OIDC evidence must match that selected pair, while the customer authorization remains bound to the reviewed PR head, merge commit, tenant, app, repository, installation, and current server-issued predecessor. AdminAPI and PublicAPI independently fetch and verify the same selected release or DEV candidate signed identity before accepting the pair; TenantInfra receives only the accepted exact pair. Historical operations without either field continue under their original sealed/static identity. A failed or rejected operation is not rewritten.

**Production-compatible successor path:** Keep the committed marker's original template, original operation ID, and historical predecessor unchanged. A *new* server-issued successor operation separately pins the current predecessor, customer authorization, exact customer merged commit, and selected release manifest. AdminAPI and PublicAPI validate those fields and producer bytes independently; the collector consumes the exact server-issued operation/nonce through the normal regional PublicAPI endpoint, with no `local_e2e_*` inputs. A new reviewed customer commit must restore the canonical, release-attested collector bytes; PR #16's already merged commit is a failed local attempt, not the deployable product commit. The existing v1.0.17 pair `74ede3c4…/f20a4291…` can be selected only through a verified release/successor contract, not by making PR #16's `5e35010c…` a static exception. This product route uses each environment's PublicAPI and datastore. The retained Saved Task currently lives in the local DEV stack, so hosted same-Task proof through cloud DEV additionally needs a supported data-continuity route or a separately reviewed local DEV routing contract; neither is established by changing the collector digest. Do not claim final SOT until that boundary is proven.

**Proposed evidence and exclusions:** CLI/Installer must pin and verify the selected candidate or release according to its distinct type. Add negative tests for an unprotected/missing release or candidate, wrong signer/repository/ref, changed manifest or Git blob, mixed workflow and collector, mismatched original versus selected identities, stale or crossed predecessor, edited historical marker, wrong customer actor/tenant/repo, replay, and legacy-operation compatibility. Test normal DEV/TEST/PROD successor dispatch without local flags, a new customer commit with exact canonical collector bytes, independent backend predecessor and original-marker validation, and denial when PR #16's local-only pair is selected as a release. A branch-based DEV run must prove the reviewed successor, deployment, HTTPS, and hosted same-Task read. The Section 11 protection receipts, genuine EAI attestation, and cross-service review remain activation gates. This amendment does **not** authorize changing the existing customer source marker, adding PR #16's hash to a static product allowlist, accepting arbitrary customer code, or treating local-only verifier overrides as SOT.

The 2026-10-15 Product and CEO approvals above apply to the original MVP only. This amendment is a proposal; do not implement or merge it until both roles approve this exact addition and `check_plan.py --phase approved` passes for the amended plan.
