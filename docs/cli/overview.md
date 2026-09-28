---
sidebar_position: 1
slug: /cli/overview
---

# EAI CLI

The Enterprise AI CLI (`eai`) is the supported operator workflow for workspace-based app development on the Enterprise AI platform.

## Installation

```bash
npm config set @enterpriseai:registry https://eai-support.github.io/eai/registry/ --location=user
npm install -g @enterpriseai/cli
```

Verify installation:

```bash
eai --version
eai update --check
```

## Quick Reference

| Command           | Description                                             |
| ----------------- | ------------------------------------------------------- |
| `eai init`        | Scaffold a new app                                      |
| `eai login`       | Authenticate with Entra CIAM                            |
| `eai dev`         | Start local development server                          |
| `eai types`       | Manage Object Type definitions                          |
| `eai workspace`  | Manage EAI workspaces (the `tenant` alias remains supported)                          |
| `eai resources`   | CRUD operations on platform resources                   |
| `eai chat`        | Chat with AI workflows                                  |
| `eai docs`        | Document upload, classification, and indexing           |
| `eai deploy`      | Deployment management                                   |
| `eai env`         | Manage environment variables                            |
| `eai verify`      | Run platform connectivity checks                        |
| `eai doctor`      | Diagnose common issues and suggest fixes                |
| `eai whoami`      | Show auth status and workspace info                        |
| `eai errors`      | Explain known CLI/platform errors and recovery commands |
| `eai agent guide` | Print AI-readable EAI CLI operating guidance            |
| `eai update`      | Check for and install newer CLI releases                |

## AI Agent Discovery

Agents should ask the CLI how to use it before guessing command names or flags:

```bash
eai --describe
eai agent guide --format json
```

After an `eai` error, use the structured explanation path:

```bash
eai errors explain <code-or-reason> --format json
```

When a command is missing or help output looks stale, check drift first:

```bash
eai update --check
eai doctor --check-updates
```

When calling PublicAPI directly through `eai publicapi`, use only `/v4/...` paths.
For support/platform automation that uses app-token lookup routes outside the
workspace app runtime, use workspace-scoped routes like
`/v4/platform/tenants/<workspace-id>/users/by-email?email=<email>` and
`/v4/platform/tenants/<workspace-id>/users/<oid>/memberships`. Workspace app
ResourceAPI access should go through the signed-in-user `/api/eai` BFF path. If
a workspace-scoped platform request reports `MISSING_TENANT` or "Tenant context
required for app tokens", run:

```bash
eai errors explain app_token_tenant_context_required --format json
```

Do that before changing workspace members, role definitions, Entra configuration,
databases, or cloud portals.

## Getting Started Workflow

The standard workflow for a new or newly connected app is:

```bash
# 1. Authenticate and pick the workspace you are actually working in
eai login
eai workspace list --format json
eai workspace select <workspace-slug>
eai whoami

# 2. Define and validate your data model
eai types validate

# 3. Publish to the target workspace explicitly
eai types seed --tenant-key <scope-key> --tenant-id <workspace-id> --format json

# 4. Verify remote convergence before you build on top
eai types diff --tenant-key <scope-key> --tenant-id <workspace-id>
eai resources schema --tenant-id <workspace-id> --format json
eai verify calls --tenant-id <workspace-id> --resource-type <resource-type>

# 5. Start developing
eai dev
```

If `eai types diff` still shows local-only types or mismatched properties, treat the seed as incomplete and fix the underlying issue first.

## Common Workflows

### Define → Validate → Seed → Verify

```bash
eai types validate
eai types seed --tenant-key <scope-key> --tenant-id <workspace-id> --format json
eai types diff --tenant-key <scope-key> --tenant-id <workspace-id>
eai resources schema --tenant-id <workspace-id> --format json
```

### Check Platform Health

```bash
eai verify
eai verify calls --tenant-id <workspace-id> --resource-type <resource-type>
```

### Debug Issues

```bash
eai doctor --fix
eai errors explain <code-or-reason> --format json
```

### Deploy to Azure

```bash
eai deploy setup --repo eai-support/my-app
eai deploy trigger
eai deploy status
```

## Global Options

| Flag            | Description                  |
| --------------- | ---------------------------- |
| `-V, --version` | Display CLI version          |
| `-h, --help`    | Display help for any command |

Use `eai help <command>` to see detailed help for any command.
