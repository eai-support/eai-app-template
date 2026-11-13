# Local validation — #3653

Date: 2026-11-12. Node 24.16.0; npm 11.13.0. These results cover the uncommitted local candidate, not a published release or deployed environment.

## Implemented

- Core candidate 3.1.3 removes unused Zod and admits Sharp 0.35.5. The shared DAISY and Assess package manifests now require core 3.1.3; their application repositories are unchanged and were not deployed.
- Template pins core 3.1.3/demo 1.0.107 and the planned runtime updates; removes unused npm/jsrsasign; moves tooling to dev dependencies; overrides nested PostCSS. Lodash and Nanoid also advance to eliminate remaining high findings.
- CI uses locked installation with dev dependencies available, fails on production audit findings at high/critical severity or registry errors, and retains audit JSON. Standalone production packaging remains intact. Core publication validates packed exports and the static registry first.
- Jest handles the upgraded package graph. Fourteen new Entra configuration/token/redirect tests cover server-only tokens, expiry, refresh failures and empty/prefixed callback paths; they do not prove live Entra sessions.

## Passing local checks

| Check | Result | Local evidence |
| --- | --- | --- |
| Locked template installation | Passed with the locally packed core candidate | `/private/tmp/eai-3653-template-install.log` |
| Production audit | 0 critical, 0 high, 3 moderate; exit 0 | `/private/tmp/eai-3653-template-production-audit-final.json` |
| Template Jest | 51 suites, 385 tests passed | `/private/tmp/eai-3653-template-unit-final.log` |
| Template Node owner tests | 262 passed, 3 skipped, 0 failed | `/private/tmp/eai-3653-template-node-tests-unsigned.log` |
| Template typecheck and production build | Passed; standalone output generated | `/private/tmp/eai-3653-template-typecheck-final.log`, `/private/tmp/eai-3653-template-build.log` |
| Core owner integration/auth suites | 61 tests passed in 6 files | `/private/tmp/eai-3653-core-owner-tests.log` |
| Core security suites | 40 tests passed in 5 files | `/private/tmp/eai-3653-core-security-tests.log` |
| Existing CLI template/hash guards | 124 tests passed in 4 files; existing published identity only | `/private/tmp/eai-3653-cli-template-guards-unsigned.log` |
| Packed image processing | DOCX body/header/footer images, bounds, invalid/oversized inputs and favicons passed | `/private/tmp/eai-3653-image-regression.log` |

Packed exports, lock parity, one installed core version, packed ESM, the candidate static registry and focused audit-gate tests also passed. BrowserOS exercised the local production demo/theme without console errors. Workflow owner tests include invalid and oversized requests. Fixture Git commits required a per-process `commit.gpgsign=false` override; no global Git settings changed.

## Candidate provenance

The local core tarball is `docs-site/static/registry/tarballs/enterpriseaigroup-core-3.1.3.tgz` in enterpriseai-packages. Its SHA-1 is `88334a9a86c13609a7c9454cb6c5cee42c39a45e`; its integrity is `sha512-RkGIuUkfyvGZM8awQXLwuoPWfwI1qvohamBqQYHUKlyd2jttzOOAcQ00IrLnGHlzsSDlhDCwY1z3SJOKm3Mclw==`.

Installation used this local tarball cached at the canonical registry URL. This proves candidate installation/build compatibility, not remote package availability. Rebuilds may change the tarball integrity; publication must reconcile the template lock against the actual published bytes.

## Not yet verified

- No package publication, immutable template release, CLI producer/pin update, Infra identity update, PR, commit, push or deployment occurred. Do not substitute a working-tree SHA for an immutable release identity. Preserve unrelated Gofer pins and #3638 CLI work.
- Released-CLI scaffold and v1.0.20 update, disposable relationship/file Object Types fixture, DEV/TEST validation, live Entra login/expiry/logout and authenticated BFF routing remain pending. PROD requires separate explicit approval and all three regional identity readbacks. Keep #3653 and deployment/validation follow-ups open; coordinate #3639 and verify Infra #1005 propagation.
- Playwright platform-readiness passed; the starter-app browser test could not launch its required Chromium headless-shell build. BrowserOS demo evidence is narrower, not a substitute for that test or live authentication. Whole-workspace GAS tests were not run against the unrelated dirty checkouts.
- Three moderate production findings remain. The full graph also retains dev-only high/critical findings; this remediation target is production high/critical, not a clean full-development audit. The existing root-route dynamic-server warning and PNG-encoded ICO fallback were not changed.
