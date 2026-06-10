---
sidebar_position: 4
slug: /platform/eai-service-patterns
---

# EAI Service Patterns

This guide is the public-safe reference for generated apps and eai-gofer when
choosing how to use Enterprise AI platform services from the EAI App Template.

## Boundary Rules

- Browser code calls the app BFF at `/api/eai/...`; it does not call PublicAPI
  directly.
- App code should prefer the template SDK and hooks before hand-written fetches.
- CLI automation may call platform services through the authenticated `eai`
  command.
- Direct `eai publicapi ...` calls are an escape hatch for authorized PublicAPI
  V4 routes that do not yet have named CLI commands.
- Access tokens, database credentials, blob credentials, and search credentials
  stay server-side.
- Prefer PublicAPI V4 routes. V3 route-family mapping is compatibility glue, not
  the pattern for new work.

## Service Selection Matrix

| Need                         | App Pattern                                                                              | CLI Pattern                                                                                 | Notes                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Compose frontend UI          | `src/eai.config/default.ts` layout slots plus `src/eai.blocks.tsx` registry              | `eai gofer refresh` installs public-safe guidance                                           | Keep config data-only; put callbacks in overrides.                             |
| Define data model            | `src/eai.config/object-types.ts`                                                         | `eai types validate`, `eai types seed`, `eai types diff`                                    | Object Types are the contract for ResourceAPI-backed data.                     |
| CRUD tenant resources        | `useResources(type)` or `client.resources`                                               | `eai resources list/get/create/update/delete/query`                                         | Use ResourceAPI for tenant-scoped business data.                               |
| Batch or aggregate resources | `client.resources.batch*`, `client.resources.aggregate`                                  | `eai resources batch-*`, `eai resources aggregate`                                          | Prefer batch APIs for bulk work.                                               |
| Execute resource action      | `client.resources.executeAction(type, id, action)`                                       | named resources command if available, otherwise `eai publicapi post /v4/data/resources/...` | Actions enforce configured object-type rules.                                  |
| Search resources             | add a local helper around `/v4/data/resources/{tenant}/search` until the SDK exposes one | `eai resources search "query" --mode hybrid`                                                | Search is a derived projection over canonical data.                            |
| Upload resource file         | add a local helper around resource file routes                                           | `eai resources file upload <type> <id> <property> <path>`                                   | Use for file properties on resources.                                          |
| Upload documents             | `useDocuments().upload(file, metadata)`                                                  | `eai docs upload <file>`                                                                    | Uses the platform document service.                                            |
| Classify documents           | `useDocuments().classify(files)` or `classifyByUrl(url)`                                 | `eai docs classify <file>`                                                                  | Classification may return immediate results or a job.                          |
| Index documents for RAG      | `useDocuments().ragIndex(documentId)`                                                    | `eai docs index <documentId>`                                                               | RAG indexing is document-service indexing, not an Object Type storage backend. |
| Non-streaming chat           | `useChat(workflowId, stage).send(...)`                                                   | `eai chat send "message"`                                                                   | Requires tenant, workflow, stage, message, conversation ID, and params.        |
| Streaming chat               | `useChat(workflowId, stage).stream(...)`                                                 | `eai chat stream "message"`                                                                 | Uses the stream BFF path `/api/eai/stream/...`.                                |
| Identity/session             | server route, middleware, or auth helpers                                                | `eai whoami`, `eai tenant select`, `eai publicapi get /v4/identity/me`                      | Keep access tokens server-side in apps.                                        |
| Advanced V4 route            | BFF route or approved server helper                                                      | `eai publicapi <method> /v4/...`                                                            | Use named SDK/CLI commands when available.                                     |

## Storage Backend Patterns

Object Types declare a logical `storageBackend`; tenant connections resolve the
physical store at runtime.

| Backend      | Use For                                                                                         | Do Not Use For                                     |
| ------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `postgresql` | canonical structured resources, status workflows, joins, history, aggregate/list/query behavior | large binary file contents                         |
| `documentdb` | resources that genuinely need document-model persistence                                        | default relational business records                |
| `blob`       | large files or file-like resources with API-managed metadata                                    | free-form bypass around document/resource APIs     |
| `search`     | derived full-text/vector/hybrid search projections                                              | the only system of record for mutable runtime data |

Rules:

- Start new business resources in `postgresql` unless there is a clear reason
  for another backend.
- `documentdb` and `blob` object types still need metadata, links, history, and
  query behavior; the platform may provision PostgreSQL shadow records for that.
- `search` is a projection. Pair it with a canonical write store.
- For document RAG, use `eai docs index` or `client.documents.ragIndex(...)`;
  do not model RAG as a search-only Object Type.

## Chat Payload Pattern

Use the v4 AI chat shape:

```ts
await client.chat.send({
  workflowId,
  stage: 'chat',
  message: 'Summarise this application',
  conversationId,
  params: {},
  runtime_context: { applicationId },
});
```

The platform expects `message`, `conversation_id`, and `params`. Do not generate
legacy payloads such as `chat_input` for new apps.

## Resource Payload Pattern

Use PascalCase object type names in app code and let the SDK normalize route
slugs:

```ts
const { list, create, update, executeAction } = useResources<ApplicationData>(
  'Application',
  tenantId,
);

const applications = await list({ limit: 20, sort: '-created_at' });
const created = await create({ applicantName: 'Jane', status: 'draft' });
await update(created.id, { status: 'submitted' }, created.version);
await executeAction(created.id, 'submit');
```

Updates require the current `version` for optimistic locking. The SDK retries
safe conflict refreshes by default; callers can opt out when they need explicit
conflict handling.

## Document Pattern

Use the documents module when the file itself is the subject of platform
processing:

```ts
const { upload, classify, ragIndex } = useDocuments(tenantId);

const uploaded = await upload(file, {
  category: 'supporting-document',
  application_id: applicationId,
});

await classify([file]);
await ragIndex(uploadedDocumentId);
```

Use ResourceAPI file routes when the file is a property of a ResourceAPI object.
Use document upload/classification/RAG routes when the platform should process
the document content.

## eai-gofer Decision Rules

When eai-gofer is generating or modifying an EAI app:

1. Scaffold or compare against `https://github.com/eai-tools/eai-app-template`.
2. Inspect `docs/platform/config-driven-ui.md`,
   `docs/platform/eai-service-patterns.md`, `src/eai.config`, `src/eai.blocks.tsx`,
   `src/hooks`, and `packages/platform-sdk` before inventing new calls.
3. Choose `useResources` for tenant business data.
4. Choose `useDocuments` for upload, classification, and RAG indexing.
5. Choose `useChat` for AI workflow calls.
6. Use `/api/eai/stream` for browser streaming.
7. Use the `eai` CLI for terminal automation and verification.
8. Use `eai publicapi` only for authorized V4 routes without named support.
9. Never place direct downstream credentials or private platform details in app
   code, public docs, generated instructions, or examples.
10. Record blocked capabilities as `operator_required`, `upgrade_required`,
    `not_ready`, or `unavailable` instead of inventing unsupported code paths.
