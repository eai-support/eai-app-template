---
sidebar_position: 1
slug: /cli/overview
---

# EAI CLI

The Enterprise AI CLI (`eai`) is the supported operator workflow for tenant-scoped vertical development on the Enterprise AI platform.

## Installation

```bash
npm install -g @eai-tools/cli@0.3.0
```

Verify installation:

```bash
eai --version
# 0.3.0
```

## Quick Reference

| Command | Description |
|---------|-------------|
| `eai init` | Scaffold a new vertical application |
| `eai login` | Authenticate with Entra CIAM |
| `eai dev` | Start local development server |
| `eai types` | Manage Object Type definitions |
| `eai tenant` | Manage tenants on the platform |
| `eai resources` | CRUD operations on platform resources |
| `eai chat` | Chat with AI workflows |
| `eai docs` | Document upload, classification, and indexing |
| `eai deploy` | Deployment management |
| `eai env` | Manage environment variables |
| `eai verify` | Run platform connectivity checks |
| `eai doctor` | Diagnose common issues and suggest fixes |
| `eai whoami` | Show auth status and tenant info |

## Getting Started Workflow

The standard workflow for a new or newly connected vertical is:

```bash
# 1. Authenticate and pick the tenant you are actually working on
eai login
eai tenant list --format json
eai tenant select <tenant-slug>
eai whoami

# 2. Define and validate your data model
eai types validate

# 3. Publish to the target tenant explicitly
eai types seed --tenant-key <tenant-key> --tenant-id <tenant-id> --format json

# 4. Verify remote convergence before you build on top
eai types diff --tenant-key <tenant-key> --tenant-id <tenant-id>
eai resources schema --tenant-id <tenant-id> --format json
eai verify calls --tenant-id <tenant-id> --resource-type <resource-type>

# 5. Start developing
eai dev
```

If `eai types diff` still shows local-only types or mismatched properties, treat the seed as incomplete and fix the underlying issue first.

## Common Workflows

### Define → Validate → Seed → Verify

```bash
eai types validate
eai types seed --tenant-key <tenant-key> --tenant-id <tenant-id> --format json
eai types diff --tenant-key <tenant-key> --tenant-id <tenant-id>
eai resources schema --tenant-id <tenant-id> --format json
```

### Check Platform Health

```bash
eai verify
eai verify calls --tenant-id <tenant-id> --resource-type <resource-type>
```

### Debug Issues

```bash
eai doctor --fix
```

### Deploy to Azure

```bash
eai deploy setup --repo eai-tools/my-vertical
eai deploy trigger
eai deploy status
```

## Global Options

| Flag | Description |
|------|-------------|
| `-V, --version` | Display CLI version |
| `-h, --help` | Display help for any command |

Use `eai help <command>` to see detailed help for any command.
