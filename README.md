# Vertical Template

A production-ready Next.js template for building tenant-scoped vertical applications on the Enterprise AI platform.

**[Documentation](https://eai-tools.github.io/eai-app-docs/)** | **[Package Registry](https://enterpriseaigroup.github.io/enterpriseai-packages/)** | **[Mirror Repo](https://github.com/eai-tools/eai-app-template)**

## What This Template Assumes

- Vertical developers work through the `eai` CLI, not direct platform credentials.
- Object types declare a logical storage backend such as `postgresql`, `documentdb`, `blob`, or `search`.
- Tenant connections resolve the physical store for that tenant at runtime.
- PublicAPI and ResourceAPI enforce tenant access. Frontends do not receive raw Blob, DocumentDB, PostgreSQL, or AI Search credentials.

## Quick Start

```bash
git clone https://github.com/eai-tools/eai-app-template.git my-vertical
cd my-vertical
npm install
cp .env.example .env.local
npm run dev
```

Then connect the project to a real tenant:

```bash
npm install -g @eai-tools/cli@0.3.0
eai login
eai tenant list --format json
eai tenant select <tenant-slug>
eai whoami
eai types validate
eai types seed --tenant-key template --tenant-id <tenant-id> --format json
eai types diff --tenant-key template --tenant-id <tenant-id>
eai resources schema --tenant-id <tenant-id> --format json
```

The `types seed` step should converge cleanly. If `types diff` still shows drift, stop and fix the object types before continuing.

## Tenant Data Plane Model

- `postgresql`: canonical structured resource storage for most vertical data.
- `documentdb`: tenant-scoped document storage when a resource type genuinely needs a document model.
- `blob`: file and large object storage behind API-mediated access.
- `search`: derived search/vector projection only, never the system of record.

For the current council MVP, canonical runtime data remains in PostgreSQL and AI Search is a derived index. The same model should be the default for most new verticals unless a type clearly needs `blob` or `documentdb`.

## Common Local Workflow

```bash
# 1. Edit tenant config and object types

# 2. Validate locally
eai types validate

# 3. Publish to the selected tenant
eai types seed --tenant-key template --tenant-id <tenant-id> --format json

# 4. Confirm the remote platform matches local source
eai types diff --tenant-key template --tenant-id <tenant-id>
eai resources schema --tenant-id <tenant-id> --format json
eai verify calls --tenant-id <tenant-id> --resource-type application
```

## Package Registry

The `@enterpriseaigroup/*` packages are served from a public registry. The included `.npmrc` configures this automatically.

```text
@enterpriseaigroup:registry=https://enterpriseaigroup.github.io/enterpriseai-packages/registry
```

## Tech Stack

- **Framework**: Next.js 15+ with App Router
- **Language**: TypeScript (strict mode)
- **UI**: React 18+, Tailwind CSS, Shadcn/ui
- **State**: Zustand (via `@enterpriseaigroup/core`)
- **Auth**: Auth.js with Microsoft Entra ID
- **API**: BFF proxy to PublicAPI and downstream platform services

## Documentation

Full documentation is available at **https://eai-tools.github.io/eai-app-docs/**, covering:

- Getting started and onboarding
- CLI usage and tenant workflows
- Architecture and tenant data-plane patterns
- Vertical configuration and extension points

## License

Proprietary - Enterprise AI Group
