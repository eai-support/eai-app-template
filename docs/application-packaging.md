# Reusable EnterpriseAI application packaging

`eai.application.json` is the source package. Run `npm run
build:application-package` after changing it and commit the deterministic
generated file. CI runs `npm run check:application-package` and the package
fixture tests.

The template always locks the published `@enterpriseaigroup/application-package`
version for main and release workflows. While a new package version is awaiting
publication, pull-request validation alone may build that dependency from the
approved exact producer commit. CI verifies the producer commit and the schema
and runtime SHA-256 values before installing the ephemeral tarball. Missing
GitHub App access, a different commit, changed contract bytes or use outside a
pull request fails closed; it never becomes a release fallback.

Customer and partner distributable apps use isolated EAI-hosted or buyer-hosted
runtime. Trusted embedded mode is EAI first-party only. App code sends all
platform calls through its server BFF to regional PublicAPI. It never calls
Curate, Configurator, Payload, AICore or another platform service directly.

## Install

Installation binds an approved immutable version to one buyer tenant. Purchase,
consent, installation and user/group assignment are separate decisions.

## Security and tenant isolation

Interactive access uses the signed-in user and requires active entitlement,
membership, assignment, consent and user rights. Tokens stay encrypted and
server-side. Browser-supplied tenant, app and installation headers are removed.
Background callbacks use short-lived installation identity, exact operations,
expiry and replay protection; human tokens and provider credentials are never
used as a fallback.

## Operations and support

Audit, usage and operational state remain buyer-governed in the buyer geography.
Publisher export is off by default. Support access is buyer-approved,
incident-bound, operation-bound, audited and limited to 60 minutes.

## Update

An update is a new immutable version. Expanded data, purpose, service,
capability or workload access requires renewed consent.

## Migration

Migrations are resumable, idempotent and retain the current/prior version and
checkpoint. No migration silently changes an Object Type transport slug.

## Rollback

On readiness or migration failure, restore the last healthy artifact and
compatible state. Record `UPDATE_FAILED` and the rollback audit receipt.

## Uninstall and deletion

Enumerate and verify removal of bindings, assignments, app-owned data, secrets
and routes. A legal hold preserves only the affected data and evidence.

## Commercial

Price and terms bind to an exact approved listing/version. Buyer-local usage is
idempotent; only privacy-minimal aggregate evidence may leave the buyer region.

## Accessibility

The owning app CI verifies keyboard, screen-reader, focus, contrast and browser
journeys for every package version.
