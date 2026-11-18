# Generated app handoff artifact identity

Issue [#3658](https://github.com/enterpriseaigroup/Issues2025/issues/3658)

The report from a DEV generated app used a decimal string for the GitHub
image artifact ID. TenantInfra accepted the corresponding integer in the native
handoff receipt. The workflow reported a mismatch after that acceptance.

- Validate the build evidence ID as a canonical positive safe integer encoded as
  a decimal string. Convert it only for the final comparison to the receipt.
- Preserve exact matching of the sealed source, artifact, environment and
  runtime handoff fields.
- Test the form emitted by the collector and refuse malformed or rounded IDs
  in the same isolated inline workflow step.
