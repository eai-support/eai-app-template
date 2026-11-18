# Preserve template bytes through Git publication

Issue: https://github.com/enterpriseaigroup/Issues2025/issues/3658

## Problem

Real DEV lifecycle verification reached the generated app's OCI build, but its
unchanged Windows launcher files failed the existing source integrity gate.
GitHub's Git Data API stores uploaded CRLF bytes without Git add-time filters;
the template's Windows EOL conversion then reports those same bytes as dirty.
Five other template text files also fail native init with core.safecrlf enabled.

## Acceptance criteria

- AC-1. Native scaffold files can be added with core.safecrlf enabled and normal Git text handling.
- AC-2. Exact provider blob publication and checkout pass the existing diff/status integrity checks, preserve Windows launcher bytes, and still detect changed or untracked source.

## Out of scope

No deployment workflow, integrity gate, collector, source digest, admission,
credential, permission or automatic retry changes. Existing operations retain
their original pinned source and evidence; a new template release is required.

## Config keys added

None.

## Validation

Owning portability tests use real Git object/index/checkout operations, including
raw blobs matching the provider's publication behavior. Both regressions fail
on the preceding template. The five text files change only CRLF to LF; Windows
launchers retain their authored CRLF bytes without checkout-time conversion.
