# Stage 050 Schema Provenance Evidence

- Command: `./scripts/verify-stage050-schema-provenance.sh`
- Fixture: `tests/fixtures/stage050/schema-provenance/`
- Positive assertion: approved template version, base template SHA, schema digest, and validator digest are accepted.
- Negative assertions: forged template versions and schema digest mismatches are rejected.
- Result: passed
