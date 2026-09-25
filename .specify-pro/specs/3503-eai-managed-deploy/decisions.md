# Decisions

## 2026-09-25 owner approval

Implement the reviewed hardening while preserving both successful source journeys and existing workflow callers. Do not merge, release, deploy, activate, bill, or run destructive live tests.

## Workflow input compatibility

Retain the historical `environment` input and add `env` as an alias. Resolve one value only when the other is absent; reject conflicting nonempty values.

## Release identity

Do not predict the automatic post-merge release. Consumers may record this exact candidate commit and byte digests, but the immutable release tag/commit remains a deferred gate until publication.

## Governed path authority

Treat every directory component beneath the application root as part of the configuration trust boundary. Reject a linked or non-directory ancestor before enumeration and recheck ancestors immediately before each no-follow file read so `src -> outside` cannot move configuration authority outside the checked-out source.

## Build output authority

Application lifecycle code may create or replace `.eai-build` before image-context preparation. Re-establish every output directory beneath the checked-out root through no-follow directory checks after the build and before any recursive removal, copy, write, archive digest, or evidence write. Use the generated-runtime app-key grammar consistently and preserve the template deployment contract's `demo` environment.
