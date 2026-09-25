# Decisions

## 2026-09-25 owner approval

Implement the reviewed hardening while preserving both successful source journeys and existing workflow callers. Do not merge, release, deploy, activate, bill, or run destructive live tests.

## Workflow input compatibility

Retain the historical `environment` input and add `env` as an alias. Resolve one value only when the other is absent; reject conflicting nonempty values.

## Release identity

Do not predict the automatic post-merge release. Consumers may record this exact candidate commit and byte digests, but the immutable release tag/commit remains a deferred gate until publication.

## Governed path authority

Treat every directory component beneath the application root as part of the configuration trust boundary. Reject a linked or non-directory ancestor before enumeration and recheck ancestors immediately before each no-follow file read so `src -> outside` cannot move configuration authority outside the checked-out source.
