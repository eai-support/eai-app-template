---
feature: 3438-ncb-sugar-rush
source_commit: 2b80cdb5253d1ba060c8230da2625fe517926b64
generated: 2026-09-17
---

# UI preview brief

## Target experience

Published generated workflows preserve the builder's branded two-panel layout:
workflow steps and fields occupy the main panel, while the Assistant remains in a
bounded right panel with its composer aligned to the form navigation.

## Acceptance checks

- Branding, workflow title, steps, required fields, and file upload are visible.
- The Assistant remains beside the form and does not cover workflow fields.
- Back, Continue, and the Assistant composer share the bottom action rail.
- A new public submission starts successfully before the UI is captured.

## Preview runtime

- Hosted URL: `https://i-need-help-with-sup-cfab5e43.jollyground-6e01a69c.australiaeast.azurecontainerapps.io/`.
- Browser target: Google Chrome 1440 x 1000.
- Evidence:
  - `preview/hosted-two-panel-runtime.png` for the deployed generated runtime.
  - `preview/local-builder-parity.jpg` for the current local builder preview.
- Open issues: none.
