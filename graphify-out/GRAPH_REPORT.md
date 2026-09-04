# Graph Report - eai-app-template  (2026-08-31)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1206 nodes · 1963 edges · 158 communities (59 shown, 99 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fb0bd6fd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PlatformModule
- scripts
- handler.ts
- resource-routing.ts
- runtime-contract.ts
- deployment-contract.ts
- platformFetch
- src/index.ts
- eai.blocks.tsx
- EAIPlatformClient
- workflow-submissions/route.ts
- dependencies
- generate-object-types-json.mjs
- src/auth.ts
- DocumentsModule
- issue-attachment-moderation.cjs
- paths
- source-unknown-deployment-evidence.mjs
- runtime.ts
- [submissionId]/route.ts
- required
- readiness.ts
- eai/readiness/route.ts
- compilerOptions
- ChatModule
- files/route.ts
- eai.config/object-types.ts
- include
- generated-workflow/platform.ts
- package.json
- platform-sdk/tsconfig.json
- seed-object-types.ts
- submission-session.ts
- eai.runtime.json
- check-route-exports.mjs
- storage-provisioning.ts
- secrets
- endpoints
- platform-sdk/package.json
- PlatformError
- devDependencies
- run.sh
- capabilities
- platform
- .prettierrc.json
- chat.test.ts
- config/route.ts
- health/route.ts
- requestClientFingerprint
- source-unknown-deployment-evidence.test.mjs
- tenantKeyPattern
- schemaProvenance
- eslint.config.mjs
- lib
- run.ps1
- publicapi-url.test.ts
- jest.config.ts
- resources.test.ts
- diagnose-resource-storage.mjs
- signout/page.tsx
- readiness.test.ts
- generate-object-types-json.test.mjs
- autoprefixer
- axios
- clsx
- cookie
- cross-env
- css-loader
- cypress
- dotenv
- dotenv-cli
- @enterpriseaigroup/core
- @enterpriseaigroup/demo
- eslint
- eslint-config-next
- eslint-config-prettier
- @eslint/eslintrc
- @hookform/resolvers
- html-encoding-sniffer
- husky
- immer
- jest
- jest-environment-jsdom
- jsdom
- ldrs
- lint-staged
- lodash
- lucide-react
- marked
- nanoid
- next
- next-auth
- next.config.ts
- next-themes
- npm
- pako
- path
- postcss
- prettier
- @radix-ui/react-accordion
- @radix-ui/react-checkbox
- @radix-ui/react-collapsible
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-label
- @radix-ui/react-radio-group
- @radix-ui/react-select
- @radix-ui/react-slot
- @radix-ui/react-switch
- @radix-ui/react-tabs
- @radix-ui/react-tooltip
- react-dom
- react-haiku
- react-hook-form
- react-icons
- react-textarea-autosize
- reflect-metadata
- remark-gfm
- sonner
- start-server-and-test
- style-loader
- tailwind-merge
- tailwind-scrollbar-hide
- tailwindcss
- @tailwindcss/postcss
- @tanstack/react-query-devtools
- @tanstack/react-table
- @testing-library/react
- tough-cookie
- ts-jest
- ts-node
- tsyringe
- tw-animate-css
- @types/jest
- @types/node
- @types/pako
- @types/react
- @types/react-dom
- @types/uuid
- typescript
- use-sync-external-store
- uuid
- vitest
- @vitest/browser
- @vitest/coverage-v8
- wait-on
- zod
- zustand
- postcss.config.mjs
- ai-workspace-guidance.test.mjs
- cross-platform-lifecycle.test.mjs

## God Nodes (most connected - your core abstractions)
1. `PlatformModule` - 61 edges
2. `platformFetch()` - 61 edges
3. `scripts` - 56 edges
4. `ResourcesModule` - 47 edges
5. `EAIPlatformClient` - 22 edges
6. `compilerOptions` - 18 edges
7. `ResourceRouting` - 17 edges
8. `getGeneratedWorkflowRuntime()` - 17 edges
9. `required` - 17 edges
10. `generatedWorkflowPlatformFetch()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `exclude` --extends--> `node_modules`  [EXTRACTED]
  packages/platform-sdk/tsconfig.json → tsconfig.json
- `plugins` --extends--> `prettier-plugin-tailwindcss`  [EXTRACTED]
  .prettierrc.json → package.json
- `EAIPlatformClient` --references--> `PlatformModule`  [EXTRACTED]
  packages/platform-sdk/src/client.ts → packages/platform-sdk/src/modules/platform.ts
- `EAIPlatformClient` --references--> `DocumentsModule`  [EXTRACTED]
  packages/platform-sdk/src/client.ts → packages/platform-sdk/src/modules/documents.ts
- `RouteContext` --calls--> `requestClientFingerprint()`  [EXTRACTED]
  src/app/api/eai/workflow-submissions/[submissionId]/route.ts → src/lib/generated-workflow/public-guards.ts

## Import Cycles
- None detected.

## Communities (158 total, 99 thin omitted)

### scripts - "scripts"
Cohesion: 0.04
Nodes (56): scripts, build, build:local, build:object-types, build:playwright, check:object-types, check:route-exports, clean:install (+48 more)

### handler.ts - "handler.ts"
Cohesion: 0.07
Nodes (39): applyTraceRequestHeaders(), BINARY_CONTENT_TYPES, deriveTraceHeaderContext(), getProductSlug(), getServerTenantId(), handleEaiProxyRequest(), isBinaryContentType(), jsonTraceHeaders() (+31 more)

### resource-routing.ts - "resource-routing.ts"
Cohesion: 0.05
Nodes (21): assertObjectTypeSlug(), deriveObjectTypeSlugV1(), ESTABLISHED_NAME_SLUGS, isAsciiWhitespace(), OBJECT_TYPE_ROUTING_CONTRACT, ObjectTypeReference, ObjectTypeRoutingError, ObjectTypeRoutingReason (+13 more)

### runtime-contract.ts - "runtime-contract.ts"
Cohesion: 0.08
Nodes (40): HomeClient(), HomeClientProps, GeneratedWorkflowFieldInput(), GeneratedWorkflowFieldInputProps, GeneratedWorkflowSmartBlock(), isSupportedGeneratedWorkflowBlock(), outputKey(), resolveGeneratedWorkflowBlockBinding() (+32 more)

### deployment-contract.ts - "deployment-contract.ts"
Cohesion: 0.06
Nodes (36): deploymentResult, failures, runtimeContract, runtimeSecretResult, {
  validateSecretRefDeclarations,
  validateTemplateDeploymentContract,
}, geistSans, metadata, NEXT_PUBLIC_BASE_PATH (+28 more)

### platformFetch - "platformFetch"
Cohesion: 0.10
Nodes (7): platformFetch(), ResourcesModule, BatchResponse, ListOptions, PaginatedResponse, Resource, RetryOptions

### src/index.ts - "src/index.ts"
Cohesion: 0.11
Nodes (37): PlatformHttpMethod, PlatformRequestOptions, createResourceRouting(), AggregateMetricDefinition, AggregateRequest, AggregateResponse, BatchCreateItem, BatchResultItem (+29 more)

### eai.blocks.tsx - "eai.blocks.tsx"
Cohesion: 0.11
Nodes (28): assertValidClientBlockExtensions(), ClientBlockExtension, clientBlockExtensions, createAppBlockRegistry(), EAIBlockBackendCoupling, eaiBlockBackendCouplings, EAIBlockCatalogEntry, EAIBlockCatalogOptions (+20 more)

### EAIPlatformClient - "EAIPlatformClient"
Cohesion: 0.10
Nodes (7): EAIPlatformClient, PlatformClientConfig, AuthModule, UsersModule, EntraUser, mockFetch, mockFetch

### workflow-submissions/route.ts - "workflow-submissions/route.ts"
Cohesion: 0.11
Nodes (13): dynamic, NO_STORE_HEADERS, POST(), revalidate, runtime, mockGetRuntime, mockPlatformFetch, mockSetSubmissionSession (+5 more)

### dependencies - "dependencies"
Cohesion: 0.10
Nodes (22): class-variance-authority, jsrsasign, @next/env, next-transpile-modules, dependencies, class-variance-authority, jsrsasign, @next/env (+14 more)

### generate-object-types-json.mjs - "generate-object-types-json.mjs"
Cohesion: 0.10
Nodes (18): BACKEND_ORDER, checkOnly, cleaned, deriveObjectTypeSlugV1(), __dirname, ESTABLISHED_NAME_SLUGS, json, lines (+10 more)

### src/auth.ts - "src/auth.ts"
Cohesion: 0.10
Nodes (13): APP_BASE_PATH, GET(), POST(), rewrite(), entraConfig, { handlers, auth, signIn, signOut }, JWT, next-auth (+5 more)

### DocumentsModule - "DocumentsModule"
Cohesion: 0.14
Nodes (8): BatchJobStatusResponse, DocumentsModule, RagIndexRequest, RagIndexResponse, ChecklistRequest, mockFetch, mockFetch, useDocuments()

### issue-attachment-moderation.cjs - "issue-attachment-moderation.cjs"
Cohesion: 0.19
Nodes (17): applyModerationPlan(), buildModerationPlan(), DEFAULT_TRUSTED_ASSOCIATIONS, findUnsafeAttachments(), githubRequest(), issueAlreadyWarned(), isTrustedAssociation(), main() (+9 more)

### paths - "paths"
Cohesion: 0.12
Nodes (18): ./packages/platform-sdk/src/*, ./public/*, ./public/images/*, ./src/app/application/*, ./src/app/domain/*, ./src/app/(infrastructure)/*, ./src/app/(presentation)/*, paths (+10 more)

### source-unknown-deployment-evidence.mjs - "source-unknown-deployment-evidence.mjs"
Cohesion: 0.24
Nodes (16): appendOutputs(), assertExists(), assertHandoffSubmitted(), buildConfigHash(), collectEvidence(), { command, options }, digestFile(), digestFiles() (+8 more)

### runtime.ts - "runtime.ts"
Cohesion: 0.20
Nodes (13): dynamic, GET(), NO_STORE_HEADERS, revalidate, runtime, RouteContext, GeneratedWorkflowRuntimeResolution, validateGeneratedAppRuntimeBinding() (+5 more)

### [submissionId]/route.ts - "[submissionId]/route.ts"
Cohesion: 0.15
Nodes (12): dynamic, GET(), NO_STORE_HEADERS, notFound(), PATCH(), revalidate, runtime, mockGetRuntime (+4 more)

### required - "required"
Cohesion: 0.12
Nodes (17): required, APP_BASE_PATH, AUTH_TRUST_HOST, AUTH_URL, BASE_URL_PUBLIC_API, EAI_CONFIG_HASH, EAI_ENVIRONMENT, EAI_PRODUCT_SLUG (+9 more)

### readiness.ts - "readiness.ts"
Cohesion: 0.23
Nodes (16): checkAuth(), checkObjectTypes(), checkPublicApi(), checkRequiredSecrets(), checkRuntimeEnv(), checkTenantAssignment(), envKeyForTenant(), evaluateRuntimeReadiness() (+8 more)

### eai/readiness/route.ts - "eai/readiness/route.ts"
Cohesion: 0.17
Nodes (13): dynamic, GET(), probeFailure(), ProbeFailureCategory, readinessProbeTokenEnvKey, requireHeader(), revalidate, runtime (+5 more)

### compilerOptions - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowJs, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules, jsx (+8 more)

### ChatModule - "ChatModule"
Cohesion: 0.22
Nodes (5): PlatformErrorDetails, ChatModule, ChatStreamOptions, mockFetch, useChat()

### files/route.ts - "files/route.ts"
Cohesion: 0.19
Nodes (13): dynamic, NO_STORE_HEADERS, notFound(), POST(), revalidate, RouteContext, runtime, DENIED_MIME_TYPES (+5 more)

### eai.config/object-types.ts - "eai.config/object-types.ts"
Cohesion: 0.16
Nodes (13): ActionDefinition, ActionSideEffect, ActionValidationRules, appSqlStorage(), Cardinality, FieldType, LinkTypeDefinition, ObjectTypeStatus (+5 more)

### include - "include"
Cohesion: 0.17
Nodes (11): **/*.d.ts, docs-site, jest.setup.js, next-env.d.ts, .next/types/**/*.ts, server.ts, src/middleware.back, **/*.ts (+3 more)

### generated-workflow/platform.ts - "generated-workflow/platform.ts"
Cohesion: 0.29
Nodes (10): accessToken(), CachedAccessToken, containerAppsManagedIdentityToken(), generatedWorkflowPlatformFetch(), GeneratedWorkflowTokenProvider, managedIdentityEndpoint(), publicApiBaseUrl(), runtimeAudience() (+2 more)

### package.json - "package.json"
Cohesion: 0.18
Nodes (10): engines, node, name, overrides, @azure/abort-controller, @azure/core-util, @azure/logger, @typespec/ts-http-runtime (+2 more)

### platform-sdk/tsconfig.json - "platform-sdk/tsconfig.json"
Cohesion: 0.18
Nodes (10): compilerOptions, baseUrl, rootDir, exclude, extends, include, __tests__, src/**/*.ts (+2 more)

### seed-object-types.ts - "seed-object-types.ts"
Cohesion: 0.33
Nodes (8): dynamic, POST(), objectTypes, failureMessage(), objectTypePayload(), seedObjectTypes(), SeedResult, mockFetch

### submission-session.ts - "submission-session.ts"
Cohesion: 0.38
Nodes (9): decodeSession(), encodeSession(), hasSubmissionSession(), pruneSubmissionCookies(), sessionSecret(), setSubmissionSession(), signature(), submissionCookieName() (+1 more)

### eai.runtime.json - "eai.runtime.json"
Cohesion: 0.20
Nodes (9): auth, callbackPath, provider, name, runtime, framework, minimumNodeVersion, $schema (+1 more)

### check-route-exports.mjs - "check-route-exports.mjs"
Cohesion: 0.31
Nodes (9): ALLOWED_EXPORTS, appRoot, collectBindingNames(), collectInvalidExports(), collectNamedExports(), hasExportModifier(), main(), projectRoot (+1 more)

### storage-provisioning.ts - "storage-provisioning.ts"
Cohesion: 0.31
Nodes (8): ObjectTypeDefinition, StorageBackend, BACKEND_ORDER, emptyObjectTypesByBackend(), StorageProvisionTargets, summarizeStorageProvisioning(), summarizeTenantStorageProvisioning(), TenantStorageProvisioningSummary

### secrets - "secrets"
Cohesion: 0.22
Nodes (9): optional, required, secrets, declarations, optional, required, AUTH_SECRET, EAI_READINESS_PROBE_TOKEN (+1 more)

### endpoints - "endpoints"
Cohesion: 0.25
Nodes (8): endpoints, authProviders, bffBasePath, health, public, readiness, runtimeConfig, smokeTests

### platform-sdk/package.json - "platform-sdk/package.json"
Cohesion: 0.25
Nodes (7): main, name, private, scripts, typecheck, types, version

### devDependencies - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, playwright, @playwright/test, postcss-cli, playwright, @playwright/test, postcss-cli

### run.sh - "run.sh"
Cohesion: 0.48
Nodes (6): find_port_pids(), get_package_hash(), PORT, print_usage(), run.sh script, stop_port_listener()

### capabilities - "capabilities"
Cohesion: 0.33
Nodes (6): capabilities, authjsEntraSignIn, publicAnonymousEndpointsRequireServerPlatformAccess, publicApiBffAccess, serviceIdentity, tenantWorkflowConfiguration

### platform - "platform"
Cohesion: 0.33
Nodes (6): platform, bffBasePath, bootstrapPublicApiUrlEnv, publicApiBaseUrlEnv, runtimeConfigEndpoint, tenantKeysEnv

### .prettierrc.json - ".prettierrc.json"
Cohesion: 0.33
Nodes (5): prettier-plugin-tailwindcss, prettier-plugin-tailwindcss, jsxSingleQuote, plugins, singleQuote

### chat.test.ts - "chat.test.ts"
Cohesion: 0.33
Nodes (3): jest, Matchers, mockFetch

### config/route.ts - "config/route.ts"
Cohesion: 0.40
Nodes (5): dynamic, GET(), getTenantKeys(), revalidate, runtime

### health/route.ts - "health/route.ts"
Cohesion: 0.40
Nodes (4): dynamic, GET(), revalidate, runtime

### requestClientFingerprint - "requestClientFingerprint"
Cohesion: 0.60
Nodes (4): requestClientFingerprint(), requestClientIp(), SubmissionPatch, validateSubmissionPatch()

### source-unknown-deployment-evidence.test.mjs - "source-unknown-deployment-evidence.test.mjs"
Cohesion: 0.33
Nodes (3): evidenceScript, repoRoot, workflowPath

### tenantKeyPattern - "tenantKeyPattern"
Cohesion: 0.40
Nodes (5): environment, tenantKeyPattern, keysEnv, tenantIdEnv, workflowIdEnv

### schemaProvenance - "schemaProvenance"
Cohesion: 0.40
Nodes (5): schemaProvenance, baseTemplateSha, schemaDigest, templateVersion, validatorDigest

### eslint.config.mjs - "eslint.config.mjs"
Cohesion: 0.40
Nodes (4): compat, __dirname, eslintConfig, __filename

### lib - "lib"
Cohesion: 0.50
Nodes (4): dom, dom.iterable, esnext, lib

## Knowledge Gaps
- **449 isolated node(s):** `JWT`, `Session`, `StoredSubmission`, `TraceHeaderContext`, `ResolvePublicApiBaseUrlOptions` (+444 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **99 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `objectTypes` connect `seed-object-types.ts` to `eai.config/object-types.ts`, `readiness.test.ts`, `readiness.ts`, `eai/readiness/route.ts`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `PlatformModule` connect `PlatformModule` to `EAIPlatformClient`, `src/index.ts`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`, `.prettierrc.json`, `autoprefixer`, `axios`, `clsx`, `cookie`, `cross-env`, `css-loader`, `cypress`, `dotenv`, `dotenv-cli`, `@enterpriseaigroup/core`, `@enterpriseaigroup/demo`, `eslint`, `eslint-config-next`, `eslint-config-prettier`, `@eslint/eslintrc`, `@hookform/resolvers`, `html-encoding-sniffer`, `husky`, `immer`, `jest`, `jest-environment-jsdom`, `jsdom`, `ldrs`, `lint-staged`, `lodash`, `lucide-react`, `marked`, `nanoid`, `next`, `next-auth`, `next-themes`, `npm`, `pako`, `path`, `postcss`, `prettier`, `@radix-ui/react-accordion`, `@radix-ui/react-checkbox`, `@radix-ui/react-collapsible`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`, `@radix-ui/react-radio-group`, `@radix-ui/react-select`, `@radix-ui/react-slot`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `react-dom`, `react-haiku`, `react-hook-form`, `react-icons`, `react-textarea-autosize`, `reflect-metadata`, `remark-gfm`, `sonner`, `start-server-and-test`, `style-loader`, `tailwind-merge`, `tailwind-scrollbar-hide`, `tailwindcss`, `@tailwindcss/postcss`, `@tanstack/react-query-devtools`, `@tanstack/react-table`, `@testing-library/react`, `tough-cookie`, `ts-jest`, `ts-node`, `tsyringe`, `tw-animate-css`, `@types/jest`, `@types/node`, `@types/pako`, `@types/react`, `@types/react-dom`, `@types/uuid`, `typescript`, `use-sync-external-store`, `uuid`, `vitest`, `@vitest/browser`, `@vitest/coverage-v8`, `wait-on`, `zod`, `zustand`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **What connects `JWT`, `Session`, `StoredSubmission` to the rest of the system?**
  _449 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PlatformModule` be split into smaller, more focused modules?**
  _Cohesion score 0.09074410163339383 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.03571428571428571 - nodes in this community are weakly interconnected._
- **Should `handler.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06868686868686869 - nodes in this community are weakly interconnected._

## Build Provenance

- Graphify: 0.9.50
- Source commit: fb0bd6fdd4fb7f9741d9568a5b1a3e8d6ab7bb3d
- Built at: 2026-08-31T05:34:14Z
- Nodes: 1206
- Edges: 1963
- graph.json SHA-256: 83a573866b355e3b885cbca4f1c951ad28a0718a97305559d4dfa7380dec35a2
- Scope: code-only canonical full extraction
- Validation: PASS
- Accepted external module identifiers: none
- Deferred semantic scope: docs, media, and semantic-only formats are intentionally excluded.
- Coverage note: no primary coverage is claimed for unsupported Rego or Bicep sources.
- Unsupported tracked extensions: .rego=0; .bicep=0
- Exclusions: none
