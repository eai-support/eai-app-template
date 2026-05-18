---
sidebar_position: 3
slug: /cli/commands
---

# Command Reference

Complete reference for all EAI CLI commands.

## `eai init`

Scaffold a new vertical application from the template.

```bash
eai init [name] [options]
```

| Argument/Flag    | Description                              | Default                                             |
| ---------------- | ---------------------------------------- | --------------------------------------------------- |
| `name`           | Project name (kebab-case)                | Interactive prompt                                  |
| `--from <repo>`  | Template repo URL or local path          | `https://github.com/eai-tools/eai-app-template.git` |
| `--skip-prompts` | Use defaults without interactive prompts | `false`                                             |

### Examples

```bash
# Interactive scaffold
eai init

# Quick scaffold with name
eai init my-vertical

# Use a custom template
eai init my-vertical --from https://github.com/my-org/my-template.git

# Non-interactive (CI/CD)
eai init my-vertical --skip-prompts
```

---

## `eai dev`

Start the local development server with platform connectivity.

```bash
eai dev [options]
```

| Flag            | Description              | Default |
| --------------- | ------------------------ | ------- |
| `--port <port>` | Port number              | `3000`  |
| `--turbo`       | Use Turbopack            | `true`  |
| `--no-turbo`    | Disable Turbopack        | —       |
| `--skip-checks` | Skip connectivity checks | `false` |

### Examples

```bash
# Start with defaults (port 3000, Turbopack)
eai dev

# Custom port
eai dev --port 3001

# Skip platform health checks
eai dev --skip-checks
```

---

## `eai verify calls`

Audit the exact read-only platform contracts the template now depends on.

```bash
eai verify calls --tenant-id <tenant-id> --resource-type application --format json
```

For post-012 verticals this should confirm:

- schema contract
- resource list contract
- resource cursor contract
- resource aggregate contract
- resource query contract
- optional resource get contract when `--resource-id` is supplied

Use this after `eai types seed` and before wiring dashboards or sync jobs onto large tenant datasets.

---

## `eai types`

Manage Object Type definitions — the data model for your vertical.

### `eai types validate`

Check local Object Types against platform schema rules.

```bash
eai types validate
```

Validates:

- PascalCase naming convention
- Required fields (name, properties)
- Property type correctness
- Select type has `options` array
- LinkType references valid target types

### `eai types seed`

Push Object Types from `src/eai.config/object-types.ts` to the platform.

```bash
eai types seed [options]
```

| Flag                  | Description                               | Default       |
| --------------------- | ----------------------------------------- | ------------- |
| `--env <environment>` | Target environment                        | `dev`         |
| `--tenant-key <key>`  | Specific tenant key                       | All tenants   |
| `--tenant-id <id>`    | Explicit platform tenant ID to publish to | Active tenant |
| `--dry-run`           | Preview without changes                   | `false`       |
| `--format <format>`   | Output format (`text` or `json`)          | `text`        |
| `--json`              | Deprecated alias for `--format json`      | `false`       |

### Examples

```bash
# Seed using the active tenant
eai types seed

# Seed only one tenant
eai types seed --tenant-key my-tenant

# Seed a specific tenant and emit machine-readable output
eai types seed --tenant-key my-tenant --tenant-id 50808ce0-f31b-4fd0-9861-74b83b8c112a --format json

# Preview what would be seeded
eai types seed --dry-run

# Seed to staging
eai types seed --env staging
```

### `eai types diff`

Compare local Object Types with what's deployed on the platform.

```bash
eai types diff [options]
```

Shows additions, removals, and modifications for each object type and property.

| Flag                 | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `--tenant-key <key>` | Compare only one tenant scope from `object-types.ts` |
| `--tenant-id <id>`   | Compare against an explicit remote tenant            |

Example:

```bash
eai types diff --tenant-key my-tenant --tenant-id 50808ce0-f31b-4fd0-9861-74b83b8c112a
```

### `eai types pull`

Download remote Object Types to local TypeScript definitions.

```bash
eai types pull [options]
```

Useful for syncing with changes made through the Configurator UI.

---

## `eai tenant`

Manage tenants on the platform.

### `eai tenant list`

```bash
eai tenant list [options]
```

| Flag                | Description                          | Default |
| ------------------- | ------------------------------------ | ------- |
| `--format <format>` | Output format (`text` or `json`)     | `text`  |
| `--json`            | Deprecated alias for `--format json` | `false` |

### `eai tenant info`

```bash
eai tenant info <id> [options]
```

Shows tenant details: name, slug, parent, domains, created date.

Example:

```bash
eai tenant info 50808ce0-f31b-4fd0-9861-74b83b8c112a --format json
```

### `eai tenant select`

```bash
eai tenant select <slug>
```

Select the active tenant for subsequent CLI commands. Use `eai whoami` to confirm the active tenant after selection.

### `eai tenant create`

```bash
eai tenant create [options]
```

| Flag                 | Description                             |
| -------------------- | --------------------------------------- |
| `--name <name>`      | Tenant display name                     |
| `--slug <slug>`      | URL-safe tenant identifier (kebab-case) |
| `--parent <id>`      | Parent tenant ID                        |
| `--domain <domains>` | Comma-separated domain list             |

### Example

```bash
eai tenant create \
  --name "My Application" \
  --slug my-app \
  --domain "myapp.com,app.myenterprise.ai"
```

For child-tenant workflows, `eai tenant create --parent <id>` performs a create-and-verify flow. If the resulting tenant is not actually usable, the CLI reports that explicitly instead of implying the workspace is ready.

---

## Template SDK Retry Behavior

The template resource SDK now retries `409` optimistic-lock conflicts by default when you call `resources.update(...)` through the platform SDK or `useResources()`.

Default retry policy:

- `100ms`
- `200ms`
- `400ms`

Each retry refreshes the latest resource version before reattempting the update. Pass `retry: { enabled: false }` when a caller needs to handle conflicts directly.

---

## `eai resources`

CRUD operations on platform resources (data stored in ResourceAPI).

### `eai resources list`

```bash
eai resources list <type> [options]
```

| Flag                | Description                                       | Default       |
| ------------------- | ------------------------------------------------- | ------------- |
| `--page <n>`        | Page number                                       | `1`           |
| `--limit <n>`       | Items per page                                    | `20`          |
| `--sort <field>`    | Sort field (`-` prefix for descending)            | `-created_at` |
| `--tenant-id <id>`  | Run the read-only query against a specific tenant | Active tenant |
| `--format <format>` | Output format (`text` or `json`)                  | `text`        |
| `--json`            | Deprecated alias for `--format json`              | `false`       |

### `eai resources get`

```bash
eai resources get <type> <id> [options]
```

Supports `--tenant-id`, `--format json`, and `--json`.

### `eai resources create`

```bash
eai resources create <type> [options]
```

| Flag                | Description                                |
| ------------------- | ------------------------------------------ |
| `--data <json>`     | Resource data as JSON string               |
| `--file <path>`     | Read data from a JSON file                 |
| `--tenant-id <id>`  | Run the mutation against a specific tenant |
| `--format <format>` | Output format (`text` or `json`)           |

### `eai resources update`

```bash
eai resources update <type> <id> [options]
```

Supports `--data`, `--file`, `--tenant-id`, `--format json`, and `--json`.

### `eai resources delete`

```bash
eai resources delete <type> <id> [options]
```

Supports `--tenant-id`, `--format json`, and `--json`.

### `eai resources query`

Cross-type query for complex searches.

```bash
eai resources query [options]
```

Supports `--tenant-id`, `--where <json>`, `--limit <n>`, `--format json`, and `--json`.

### `eai resources schema`

Show published Object Types for the current tenant.

```bash
eai resources schema [options]
```

Supports `--tenant-id`, `--format json`, and `--json`.

### Examples

```bash
# List all Applications in the active tenant
eai resources list Application

# List against an explicit tenant
eai resources list Application --tenant-id 50808ce0-f31b-4fd0-9861-74b83b8c112a --format json

# Get a specific resource
eai resources get Application abc123

# Create from inline JSON
eai resources create Application --tenant-id 50808ce0-f31b-4fd0-9861-74b83b8c112a --data '{"applicantName":"Jane","status":"draft"}'

# Create from file
eai resources create Application --file ./seed-data/app1.json

# Check published schema before writing data
eai resources schema --tenant-id 50808ce0-f31b-4fd0-9861-74b83b8c112a --format json

# Delete a resource
eai resources delete Application abc123
```

---

## `eai chat`

Interact with AI workflows configured on the platform.

### `eai chat send`

Send a single message and receive a complete response.

```bash
eai chat send <message> [options]
```

### `eai chat stream`

Interactive streaming chat session.

```bash
eai chat stream <message> [options]
```

### Examples

```bash
# Quick question
eai chat send "What documents are needed for a work visa?"

# Interactive streaming session
eai chat stream "Help me understand the asylum process"
```

---

## `eai docs`

Document upload, classification, and RAG indexing.

### `eai docs upload`

```bash
eai docs upload <file>
```

### `eai docs classify`

```bash
eai docs classify <file>
```

### `eai docs index`

```bash
eai docs index <documentId>
```

### Examples

```bash
# Upload a document
eai docs upload ./passport-scan.pdf

# Classify a document
eai docs classify ./unknown-document.pdf

# Index for RAG search
eai docs index doc-abc123
```

---

## `eai env`

Manage environment variables between local and cloud.

### `eai env pull`

Sync cloud configuration to local `.env.local`.

```bash
eai env pull [options]
```

### `eai env list`

Show current environment variables.

```bash
eai env list [options]
```

### `eai env push`

Push local config overrides to cloud (admin only).

```bash
eai env push [options]
```

### Examples

```bash
# Download cloud config
eai env pull

# View current config
eai env list

# Push overrides (admin)
eai env push
```

---

## `eai deploy`

Deployment management for Azure App Service.

### `eai deploy setup`

Generate GitHub Actions workflow and configure secrets.

```bash
eai deploy setup [options]
```

| Flag            | Description                      |
| --------------- | -------------------------------- |
| `--repo <repo>` | GitHub repo in `org/name` format |

### `eai deploy trigger`

Trigger a deployment.

```bash
eai deploy trigger [options]
```

### `eai deploy status`

Check current deployment status.

```bash
eai deploy status [options]
```

### Examples

```bash
# Initial setup
eai deploy setup --repo eai-tools/my-vertical

# Deploy
eai deploy trigger

# Check status
eai deploy status
```

---

## `eai verify`

Run platform connectivity checks against PublicAPI, Configurator, ResourceAPI, and AICore.

```bash
eai verify
```

Checks:

- PublicAPI reachability
- Authentication validity
- Configurator tenant access
- ResourceAPI schema availability
- AICore chat endpoint

---

## `eai doctor`

Diagnose common issues and optionally fix them.

```bash
eai doctor [options]
```

| Flag    | Description             | Default |
| ------- | ----------------------- | ------- |
| `--fix` | Attempt automatic fixes | `false` |

### What it checks

- Node.js version (18+)
- npm version (9+)
- `.env.local` completeness
- Authentication status
- Platform connectivity
- Package dependency health
- TypeScript compilation

### Example

```bash
# Diagnose
eai doctor

# Diagnose and fix
eai doctor --fix
```
