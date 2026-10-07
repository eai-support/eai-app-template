# EAI App Template

A production-ready Next.js template for building workspace-based applications on the Enterprise AI platform.

**[Documentation](https://eai-support.github.io/eai-app-docs/)** | **[Package Registry](https://enterpriseaigroup.github.io/enterpriseai-packages/)** | **[Mirror Repo](https://github.com/eai-support/eai-app-template)**

Customer-facing guidance calls this an EAI workspace. Some stable contract
fields, routes, and CLI flags keep the historical word `tenant` in their names.
For example, `tenantId` and `--tenant-id` carry an EAI workspace ID. The CLI
accepts `eai workspace` as the preferred command and keeps `eai tenant` as an
alias.

## What This Template Assumes

- App developers work through the `eai` CLI, not direct platform credentials.
- The `eai` CLI release manifest pins this repository's latest `main` commit
  when the CLI is released; this template does not need a separate template
  release tag.
- Object types declare a logical storage backend such as `postgresql`, `documentdb`, `blob`, or `search`.
- Workspace connections resolve the physical store for that workspace at runtime.
- PublicAPI and ResourceAPI enforce workspace access. Frontends do not receive raw Blob, DocumentDB, PostgreSQL, or AI Search credentials.

## Quick Start

```bash
git clone https://github.com/eai-support/eai-app-template.git my-app
cd my-app
npm install
cp .env.example .env.local
./run.sh dev 3001
```

On Windows, use:

```bat
run.bat dev 3001
```

The runner installs missing dependencies, builds the app, stops any process that
already listens on the chosen port, and restarts the development server on that
same port. AI agents should use this runner instead of calling `npm run dev`
directly.

Then connect the project to an EAI workspace:

```bash
npm config set @enterpriseai:registry https://eai-support.github.io/eai/registry/ --location=user
npm install -g @enterpriseai/cli
eai update --check
eai login
eai workspace list --format json
eai workspace select <workspace-slug>
eai whoami
eai app provision <app-key> --tenant-id <workspace-id> --format json
eai types validate
eai types diff --tenant-key template --tenant-id <workspace-id>
eai types seed --tenant-key template --tenant-id <workspace-id> --format json
eai resources schema --tenant-id <workspace-id> --format json
```

Review the pre-seed `types diff`, then seed the intended definitions. Re-run
`types diff` after seeding when you need convergence evidence; any remaining
drift must be understood before continuing.

## Runtime Contract

This template declares its deploy-time requirements in `eai.runtime.json`. The
contract is provider-neutral: Vercel, Docker, Azure, AWS, Kubernetes, a VM, or
an internal demo host can all translate the same requirements into their own
environment and secret mechanism.

The default contract requires:

- Auth.js with Microsoft Entra sign-in
- PublicAPI access through the app BFF at `/api/eai`
- workspace/workflow runtime configuration through `/api/eai/config`
- `/health` for host-level liveness
- user-delegated access for workspace data calls

Validate the local contract and a deployed app with:

```bash
eai runtime validate
eai deploy env --provider generic
eai deploy doctor --url https://your-deployed-app.example.com
```

`/health` returning 200 is only the first check. A deployment is not considered
healthy until Auth.js, runtime config, workspace/workflow values, and declared
smoke tests pass.

The readiness smoke test remains authenticated. The deploy-doctor process and
the deployed runtime must receive matching values for
`EAI_READINESS_PROBE_TOKEN`, `NEXT_PUBLIC_EAI_TENANT_ID`, `EAI_PRODUCT_SLUG`,
`EAI_ENVIRONMENT`, `EAI_CONFIG_HASH`, and the server-only
`EAI_DEPLOYMENT_ID`. TenantInfra sends the exact active deployment ID with its
authenticated readiness probe. Inject the probe token through the operator or
CI secret environment; do not put it on the command line or commit it. The CLI
resolves the contract's `${ENV_NAME}` header values only in memory, sends them
to the declared endpoint, and does not include them in output. If a required
value is absent, doctor does not send an unauthenticated request and reports
missing probe configuration instead of PublicAPI authorization failure.

### Managed deployment workflow invocation

The EAI CLI starts `.github/workflows/eai-app.yml` with `workflow_dispatch`.
Existing reusable callers can keep using `workflow_call` when the caller is in
the same repository, was started manually with `workflow_dispatch`, and uses
the same source ref as the canonical EAI workflow. PublicAPI verifies the
signed GitHub caller and callee workflow claims, ref, and source SHA before it
accepts the handoff. Cross-repository and cross-ref reusable calls fail.
The direct CLI dispatch supplies the server-approved `config_hash`. A reusable
caller can omit that newer input: the called workflow derives the exact
checked-out configuration digest before application work. If the reusable
caller supplies `config_hash`, it must match that digest.
The reusable schema's `eai_reusable_call` input is an internal trigger marker;
leave its default value unchanged. Direct dispatch does not expose that input.

The reusable caller must grant `contents: read`, `packages: read`,
`actions: read`, `attestations: write`, and `id-token: write`. GitHub can reduce
permissions through a reusable workflow call, but the called workflow cannot
add a permission that its caller did not grant. Deprecated
`EAI_ACCESS_TOKEN` and `EAI_PUBLIC_API_URL` secrets are accepted as unused
compatibility declarations; they do not authorize a deployment.

## Workspace Data Access

Workspace data access is user-delegated. Browser code calls the app BFF at
`/api/eai/...`, and the BFF forwards to PublicAPI with the signed-in user's
session token. PublicAPI, OPA/Authz, and ResourceAPI then evaluate the user,
app, and workspace together.

Do not add app-only `client_credentials` access for normal ResourceAPI reads,
writes, files, or search. If work must continue after the user leaves the page,
have the user request a platform workflow/job and pass workspace, app, and user
context into that workflow.

These credentials and identities have different purposes:

- Auth.js uses the app registration's confidential-client secret to complete
  interactive sign-in and establish the user's server-side session.
- The BFF uses the signed-in user's delegated token for workspace-scoped PublicAPI
  calls; PublicAPI evaluates the user, app client, and workspace together.
- An app-only/service identity is optional and separate. Generic workspace apps do
  not need one for normal data-plane access, and `eai app provision` must not
  create one merely to repair an interactive login.

## AI Agent Workflow

Projects created with `eai init` include current Gofer assets for GitHub
Copilot, Claude, Codex, Grok Build, and Gemini-compatible AI workspaces. Detect
and open an installed workspace with:

```bash
eai start --check
eai start
```

Detection reads installed application and command metadata only. The final
start action is the user's approval for the selected provider to read the
project and use the provider account. The first conversation starts with the
business outcome, uses the public `eai` skill, and pauses for approval of the
business specification before implementation continues.

After Gofer is installed or refreshed, treat each agent chat in this repository
as if the public `eai` entrypoint is active, even when the user omits `/eai`,
`$eai`, or `#eai`. Do not inject a slash command into the chat box. Route the
request through the same Gofer decision path and keep replies short, direct,
and business-focused.

For any local UI preview, use the repo runner:

```bash
./run.sh dev 3001
```

On Windows, use:

```bat
run.bat dev 3001
```

Do not start the UI with direct `npm run dev` commands unless the runner is
missing. If the runner is missing, refresh the EAI app template before preview
work continues.

When an AI agent is working in this template, it should use the EAI CLI as the source of truth instead of guessing command shapes:

```bash
eai --describe
eai agent guide --format json
```

If an `eai` command fails, the agent should explain the known error before choosing recovery steps:

```bash
eai errors explain <code-or-reason> --format json
```

Use `eai update --check` or `eai doctor --check-updates` when a command is missing, help looks stale, or the local CLI may be behind the published release. Direct PublicAPI calls through `eai publicapi` should use only `/v4/...` paths.

Use the app-owned test scripts before inventing commands:

| Script                            | Purpose                                                                                |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `npm run verify`                  | Local template health: object types, route exports, config, typecheck, and unit tests. |
| `npm run test:smoke`              | Fast local smoke checks for template and AI workspace guidance.                        |
| `npm run test:business-scenarios` | Gofer-created browser journeys for business outcomes.                                  |
| `npm run test:e2e`                | Browser end-to-end tests for app journeys.                                             |
| `npm run test:playwright`         | Full Playwright runner for explicit browser test work.                                 |

Gofer should prefer `test:business-scenarios` for user journeys, then
`test:e2e`, then `test:playwright`. A screenshot is only visual evidence. It
does not replace a click-through browser test for app behavior. These browser
aliases must contain real Playwright tests and must not use empty-suite bypasses.

If platform user lookup or membership prerequisite calls return
`MISSING_TENANT`, `app_token_tenant_context_required`, or "Tenant context
required for app tokens", explain that error before changing state:

```bash
eai errors explain app_token_tenant_context_required --format json
```

Then confirm the workspace with `eai whoami` and `eai workspace list --format json`
and use workspace-scoped platform routes. Existing platform routes retain the `tenants` path name, such as
`/v4/platform/tenants/<workspace-id>/users/by-email?email=<email>`,
`/v4/platform/tenants/<workspace-id>/users/<oid>/memberships`,
`/v4/platform/tenants/<workspace-id>/members`, and
`/v4/platform/tenants/<workspace-id>/role-definitions`. Do not change
workspace members, Entra configuration, role definitions, databases, or cloud
portals.

## Workspace Data Plane Model

- `postgresql`: canonical structured resource storage for most app data.
- `documentdb`: workspace-scoped document storage when a resource type genuinely needs a document model.
- `blob`: file and large object storage behind API-mediated access.
- `search`: derived search/vector projection only, never the system of record.

For the default scaffold, canonical runtime data remains in structured resource storage and search is a derived index. Prefer that model for new apps unless a resource type clearly needs `blob` or `documentdb`.

For file upload, use the v4 documents workflow when the file should be
processed, classified, indexed for RAG, or used by AI. Use ResourceAPI file
properties when the file is an attachment to a typed business resource. Do not
create standalone browser-visible blob upload paths for new apps. See
`docs/platform/documents-and-files.md`.

## Common Local Workflow

```bash
# 1. Edit workspace config and object types

# 2. Validate locally
eai types validate

# 3. Publish to the selected workspace
eai types seed --tenant-key template --tenant-id <workspace-id> --format json

# 4. Confirm the remote platform matches local source
eai types diff --tenant-key template --tenant-id <workspace-id>
eai resources schema --tenant-id <workspace-id> --format json
eai verify calls --tenant-id <workspace-id> --resource-type application
```

## Object Type Naming

- Define object types in PascalCase in `src/eai.config/object-types.ts`.
- Let the shared SDK normalize those names to kebab-case route slugs.
- Use `useResources('WatchTarget')`, `client.resources.get('Campaign', id)`,
  and related helpers instead of hand-writing `/v4/data/resources/...` paths.
- If you need the slug explicitly, use the shared `toObjectTypeSlug(...)`
  helper from `@enterpriseaigroup/platform-sdk` instead of creating a local
  slugifier.

## App Router Guardrail

- In `src/app/**/route.ts`, export only HTTP methods like `GET`, `POST`, `PUT`,
  `PATCH`, `DELETE`, `HEAD`, and `OPTIONS`
- Only export supported route config fields such as `dynamic`, `runtime`, and
  `revalidate`
- Keep reusable logic in a sibling `handler.ts` or a module under `src/lib/`
- Run `npm run check:route-exports` to catch unsupported `route.ts` exports
  before `next build`

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

Full documentation is available at **https://eai-support.github.io/eai-app-docs/**, covering:

- Getting started and onboarding
- CLI usage and workspace workflows
- Architecture and workspace data patterns
- Platform service usage patterns for resources, storage, documents, search, and chat
- Config-driven UI composition with store bindings and component registries
- App configuration and extension points

## License

Proprietary - Enterprise AI Group
