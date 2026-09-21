# Graph Report - eai-app-template  (2026-09-21)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1334 nodes · 2231 edges · 163 communities (64 shown, 99 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5b560d3c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- PlatformModule
- scripts
- handler.ts
- eai.config/object-types.ts
- platformFetch
- src/index.ts
- deployment-contract.ts
- EAIPlatformClient
- getGeneratedWorkflowRuntime
- eai.blocks.tsx
- generated-workflow/platform.ts
- field-validation.ts
- resource-routing.ts
- dependencies
- DocumentsModule
- workflow-submissions/route.ts
- generate-object-types-json.mjs
- src/auth.ts
- files/route.ts
- issue-attachment-moderation.cjs
- files/route.test.ts
- runtime-contract.ts
- modules/platform.ts
- paths
- source-unknown-deployment-evidence.mjs
- eai/readiness/route.ts
- workflow-assistant/route.ts
- workflow-assistant.tsx
- workflow-form.tsx
- required
- submission-files.ts
- compilerOptions
- include
- package.json
- UsersModule
- platform-sdk/tsconfig.json
- submission-session.ts
- eai.runtime.json
- check-route-exports.mjs
- [submissionId]/route.ts
- smart-block.tsx
- secrets
- endpoints
- platform-sdk/package.json
- PlatformError
- home-client.tsx
- devDependencies
- run.sh
- capabilities
- platform
- .prettierrc.json
- chat.test.ts
- config/route.ts
- health/route.ts
- source-unknown-deployment-evidence.test.mjs
- tenantKeyPattern
- schemaProvenance
- eslint.config.mjs
- next-release-version.mjs
- lib
- run.ps1
- publicapi-url.test.ts
- jest.config.ts
- resources.test.ts
- diagnose-resource-storage.mjs
- signout/page.tsx
- generate-object-types-json.test.mjs
- autoprefixer
- axios
- class-variance-authority
- clsx
- cookie
- cross-env
- css-loader
- cypress
- dotenv
- dotenv-cli
- @enterpriseaigroup/demo
- eslint-config-next
- eslint-config-prettier
- @eslint/eslintrc
- @hookform/resolvers
- html-encoding-sniffer
- husky
- immer
- jest
- jest-environment-jsdom
- ldrs
- lint-staged
- lodash
- lucide-react
- marked
- nanoid
- next
- next-auth
- next.config.ts
- @next/env
- next-themes
- next-transpile-modules
- pako
- path
- postcss
- prettier
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
- react
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
- @tailwindcss/postcss
- @tanstack/react-query-devtools
- @tanstack/react-table
- @testing-library/react
- @testing-library/user-event
- tough-cookie
- ts-jest
- ts-node
- tsyringe
- tw-animate-css
- @types/jest
- @types/jsrsasign
- @types/node
- @types/pako
- @types/react
- @types/react-dom
- @types/uuid
- typescript
- uuid
- vitest
- @vitest/browser
- @vitest/coverage-v8
- zod
- zustand
- zustand-logger-middleware
- postcss.config.mjs
- ai-workspace-guidance.test.mjs
- cross-platform-lifecycle.test.mjs

## God Nodes (most connected - your core abstractions)
1. `PlatformModule` - 61 edges
2. `platformFetch()` - 61 edges
3. `scripts` - 57 edges
4. `ResourcesModule` - 47 edges
5. `EAIPlatformClient` - 22 edges
6. `generatedWorkflowPlatformFetch()` - 22 edges
7. `getGeneratedWorkflowRuntime()` - 22 edges
8. `GeneratedWorkflowForm()` - 18 edges
9. `compilerOptions` - 18 edges
10. `ResourceRouting` - 17 edges

## Surprising Connections (you probably didn't know these)
- `exclude` --extends--> `node_modules`  [EXTRACTED]
  packages/platform-sdk/tsconfig.json → tsconfig.json
- `plugins` --extends--> `prettier-plugin-tailwindcss`  [EXTRACTED]
  .prettierrc.json → package.json
- `EAIPlatformClient` --references--> `PlatformModule`  [EXTRACTED]
  packages/platform-sdk/src/client.ts → packages/platform-sdk/src/modules/platform.ts
- `GeneratedWorkflowField` --references--> `FieldValidation`  [EXTRACTED]
  src/lib/generated-workflow/runtime-contract.ts → src/lib/generated-workflow/field-format.ts
- `ResourcesModule` --references--> `ResourceRouting`  [EXTRACTED]
  packages/platform-sdk/src/modules/resources.ts → packages/platform-sdk/src/resource-routing.ts

## Import Cycles
- None detected.

## Communities (163 total, 99 thin omitted)

### scripts - "scripts"
Cohesion: 0.04
Nodes (57): scripts, build, build:local, build:object-types, build:playwright, check:object-types, check:route-exports, clean:install (+49 more)

### handler.ts - "handler.ts"
Cohesion: 0.07
Nodes (39): applyTraceRequestHeaders(), BINARY_CONTENT_TYPES, deriveTraceHeaderContext(), getProductSlug(), getServerTenantId(), handleEaiProxyRequest(), isBinaryContentType(), jsonTraceHeaders() (+31 more)

### eai.config/object-types.ts - "eai.config/object-types.ts"
Cohesion: 0.06
Nodes (46): dynamic, POST(), ActionDefinition, ActionSideEffect, ActionValidationRules, appSqlStorage(), Cardinality, FieldType (+38 more)

### platformFetch - "platformFetch"
Cohesion: 0.11
Nodes (9): platformFetch(), ResourcesModule, BatchCreateItem, BatchResponse, ListOptions, ObjectTypeManagementRequest, PaginatedResponse, Resource (+1 more)

### src/index.ts - "src/index.ts"
Cohesion: 0.10
Nodes (39): BatchJobStatusResponse, ClassifyByUrlOptions, DocumentWorkflowOptions, RagIndexRequest, RagIndexResponse, createResourceRouting(), AggregateMetricDefinition, AggregateRequest (+31 more)

### deployment-contract.ts - "deployment-contract.ts"
Cohesion: 0.09
Nodes (29): deploymentResult, failures, runtimeContract, runtimeSecretResult, {
  validateSecretRefDeclarations,
  validateTemplateDeploymentContract,
}, TemplateConfig, templateConfigSource, DeploymentContractValidation (+21 more)

### EAIPlatformClient - "EAIPlatformClient"
Cohesion: 0.10
Nodes (10): EAIPlatformClient, PlatformClientConfig, PlatformErrorDetails, AuthModule, ChatModule, ChatStreamOptions, EntraUser, mockFetch (+2 more)

### getGeneratedWorkflowRuntime - "getGeneratedWorkflowRuntime"
Cohesion: 0.10
Nodes (21): dynamic, GET(), NO_STORE_HEADERS, revalidate, runtime, geistSans, generateMetadata(), NEXT_PUBLIC_BASE_PATH (+13 more)

### eai.blocks.tsx - "eai.blocks.tsx"
Cohesion: 0.11
Nodes (28): assertValidClientBlockExtensions(), ClientBlockExtension, clientBlockExtensions, createAppBlockRegistry(), EAIBlockBackendCoupling, eaiBlockBackendCouplings, EAIBlockCatalogEntry, EAIBlockCatalogOptions (+20 more)

### generated-workflow/platform.ts - "generated-workflow/platform.ts"
Cohesion: 0.12
Nodes (22): abortReason(), accessToken(), awaitWithSignal(), CachedAccessToken, containerAppsManagedIdentityToken(), generatedWorkflowPlatformFetch(), GeneratedWorkflowPlatformUnavailableError, GeneratedWorkflowTokenProvider (+14 more)

### field-validation.ts - "field-validation.ts"
Cohesion: 0.16
Nodes (23): FIELD_FORMATS, FieldFormat, fieldInputAttrs(), FieldValidation, FormatSpec, INFERENCE_RULES, inferFieldFormat(), isValidFieldFormat() (+15 more)

### resource-routing.ts - "resource-routing.ts"
Cohesion: 0.05
Nodes (21): assertObjectTypeSlug(), deriveObjectTypeSlugV1(), ESTABLISHED_NAME_SLUGS, isAsciiWhitespace(), OBJECT_TYPE_ROUTING_CONTRACT, ObjectTypeReference, ObjectTypeRoutingError, ObjectTypeRoutingReason (+13 more)

### dependencies - "dependencies"
Cohesion: 0.09
Nodes (24): @enterpriseaigroup/core, eslint, jsdom, jsrsasign, npm, dependencies, @enterpriseaigroup/core, eslint (+16 more)

### workflow-submissions/route.ts - "workflow-submissions/route.ts"
Cohesion: 0.14
Nodes (9): dynamic, NO_STORE_HEADERS, POST(), revalidate, runtime, mockGetRuntime, mockPlatformFetch, mockSetSubmissionSession (+1 more)

### generate-object-types-json.mjs - "generate-object-types-json.mjs"
Cohesion: 0.10
Nodes (18): BACKEND_ORDER, checkOnly, cleaned, deriveObjectTypeSlugV1(), __dirname, ESTABLISHED_NAME_SLUGS, json, lines (+10 more)

### src/auth.ts - "src/auth.ts"
Cohesion: 0.10
Nodes (13): APP_BASE_PATH, GET(), POST(), rewrite(), entraConfig, { handlers, auth, signIn, signOut }, JWT, next-auth (+5 more)

### files/route.ts - "files/route.ts"
Cohesion: 0.18
Nodes (12): dynamic, NO_STORE_HEADERS, notFound(), POST(), revalidate, RouteContext, runtime, MAX_ANONYMOUS_JSON_BODY_BYTES (+4 more)

### issue-attachment-moderation.cjs - "issue-attachment-moderation.cjs"
Cohesion: 0.19
Nodes (17): applyModerationPlan(), buildModerationPlan(), DEFAULT_TRUSTED_ASSOCIATIONS, findUnsafeAttachments(), githubRequest(), issueAlreadyWarned(), isTrustedAssociation(), main() (+9 more)

### files/route.test.ts - "files/route.test.ts"
Cohesion: 0.20
Nodes (5): mockGetRuntime, mockHasSubmissionSession, mockPlatformFetch, MockRequest, RequestBodyTooLargeError

### runtime-contract.ts - "runtime-contract.ts"
Cohesion: 0.18
Nodes (16): GeneratedWorkflowFormProps, binding, GeneratedAppRuntimeBinding, GeneratedWorkflowBranding, GeneratedWorkflowSmartBlockValueType, GeneratedWorkflowSnapshot, generatedWorkflowSnapshotDigest(), GeneratedWorkflowSourceBinding (+8 more)

### modules/platform.ts - "modules/platform.ts"
Cohesion: 0.27
Nodes (4): PlatformHttpMethod, PlatformRequestOptions, mockFetch, useDocuments()

### paths - "paths"
Cohesion: 0.12
Nodes (18): ./packages/platform-sdk/src/*, ./public/*, ./public/images/*, ./src/app/application/*, ./src/app/domain/*, ./src/app/(infrastructure)/*, ./src/app/(presentation)/*, paths (+10 more)

### source-unknown-deployment-evidence.mjs - "source-unknown-deployment-evidence.mjs"
Cohesion: 0.24
Nodes (16): appendOutputs(), assertExists(), assertHandoffSubmitted(), buildConfigHash(), collectEvidence(), { command, options }, digestFile(), digestFiles() (+8 more)

### eai/readiness/route.ts - "eai/readiness/route.ts"
Cohesion: 0.16
Nodes (15): dynamic, generatedWorkflowPlatformCheck(), GET(), probeFailure(), ProbeFailureCategory, readinessProbeTokenEnvKey, requireHeader(), revalidate (+7 more)

### workflow-assistant/route.ts - "workflow-assistant/route.ts"
Cohesion: 0.10
Nodes (21): dynamic, failure(), HEADERS, POST(), runtime, STREAM_HEADERS, mockGetRuntime, mockPlatformFetch (+13 more)

### workflow-assistant.tsx - "workflow-assistant.tsx"
Cohesion: 0.16
Nodes (7): EMPTY_ASSISTANT_MESSAGES, WorkflowAssistant, WorkflowAssistant, apiUrl(), readWorkflowAssistantEventStream(), WorkflowAssistantMessage, WorkflowAssistantStreamResult

### workflow-form.tsx - "workflow-form.tsx"
Cohesion: 0.22
Nodes (17): asSubmissionFile(), blockKey(), blockOutputValues(), detectDevice(), fieldKey(), GeneratedWorkflowForm(), normalizeSteps(), readableTextColor() (+9 more)

### required - "required"
Cohesion: 0.12
Nodes (17): required, APP_BASE_PATH, AUTH_TRUST_HOST, AUTH_URL, BASE_URL_PUBLIC_API, EAI_CONFIG_HASH, EAI_ENVIRONMENT, EAI_PRODUCT_SLUG (+9 more)

### submission-files.ts - "submission-files.ts"
Cohesion: 0.17
Nodes (13): GeneratedWorkflowFieldInput(), GeneratedWorkflowFieldInputProps, GeneratedWorkflowField, DENIED_MIME_TYPES, PendingSubmissionFile, SUBMISSION_FILE_ACCEPTED_EXTENSIONS, SUBMISSION_FILE_MAX_BYTES, SUBMISSION_FILE_MAX_COUNT (+5 more)

### compilerOptions - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowJs, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental, isolatedModules, jsx (+8 more)

### include - "include"
Cohesion: 0.17
Nodes (11): **/*.d.ts, docs-site, jest.setup.js, next-env.d.ts, .next/types/**/*.ts, server.ts, src/middleware.back, **/*.ts (+3 more)

### package.json - "package.json"
Cohesion: 0.18
Nodes (10): engines, node, name, overrides, @azure/abort-controller, @azure/core-util, @azure/logger, @typespec/ts-http-runtime (+2 more)

### platform-sdk/tsconfig.json - "platform-sdk/tsconfig.json"
Cohesion: 0.18
Nodes (10): compilerOptions, baseUrl, rootDir, exclude, extends, include, __tests__, src/**/*.ts (+2 more)

### submission-session.ts - "submission-session.ts"
Cohesion: 0.38
Nodes (9): decodeSession(), encodeSession(), hasSubmissionSession(), pruneSubmissionCookies(), sessionSecret(), setSubmissionSession(), signature(), submissionCookieName() (+1 more)

### eai.runtime.json - "eai.runtime.json"
Cohesion: 0.20
Nodes (9): auth, callbackPath, provider, name, runtime, framework, minimumNodeVersion, $schema (+1 more)

### check-route-exports.mjs - "check-route-exports.mjs"
Cohesion: 0.31
Nodes (9): ALLOWED_EXPORTS, appRoot, collectBindingNames(), collectInvalidExports(), collectNamedExports(), hasExportModifier(), main(), projectRoot (+1 more)

### [submissionId]/route.ts - "[submissionId]/route.ts"
Cohesion: 0.13
Nodes (15): dynamic, GET(), NO_STORE_HEADERS, notFound(), PATCH(), revalidate, runtime, mockGetRuntime (+7 more)

### smart-block.tsx - "smart-block.tsx"
Cohesion: 0.29
Nodes (8): GeneratedWorkflowSmartBlock(), isSupportedGeneratedWorkflowBlock(), outputKey(), resolveGeneratedWorkflowBlockBinding(), SUPPORTED_BLOCKS, textConfig(), GeneratedWorkflowSmartBlockInstance, GeneratedWorkflowSmartBlockOutput

### secrets - "secrets"
Cohesion: 0.22
Nodes (9): optional, required, secrets, declarations, optional, required, AUTH_SECRET, EAI_READINESS_PROBE_TOKEN (+1 more)

### endpoints - "endpoints"
Cohesion: 0.25
Nodes (8): endpoints, authProviders, bffBasePath, health, public, readiness, runtimeConfig, smokeTests

### platform-sdk/package.json - "platform-sdk/package.json"
Cohesion: 0.25
Nodes (7): main, name, private, scripts, typecheck, types, version

### home-client.tsx - "home-client.tsx"
Cohesion: 0.38
Nodes (4): DemoPage, HomeClient(), HomeClientProps, GeneratedWorkflowRuntime

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

### next-release-version.mjs - "next-release-version.mjs"
Cohesion: 0.60
Nodes (3): BUMPS, FIRST_RELEASE, nextReleaseVersion()

### lib - "lib"
Cohesion: 0.50
Nodes (4): dom, dom.iterable, esnext, lib

## Knowledge Gaps
- **485 isolated node(s):** `CachedAccessToken`, `GeneratedWorkflowTokenProvider`, `PendingAccessToken`, `StoredSubmission`, `GeneratedWorkflowPlatformUnavailableError` (+480 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **99 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `objectTypes` connect `eai.config/object-types.ts` to `eai/readiness/route.ts`?**
  _High betweenness centrality (0.077) - this node is a cross-community bridge._
- **Why does `PlatformModule` connect `PlatformModule` to `src/index.ts`, `modules/platform.ts`, `EAIPlatformClient`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`, `.prettierrc.json`, `autoprefixer`, `axios`, `class-variance-authority`, `clsx`, `cookie`, `cross-env`, `css-loader`, `cypress`, `dotenv`, `dotenv-cli`, `@enterpriseaigroup/demo`, `eslint-config-next`, `eslint-config-prettier`, `@eslint/eslintrc`, `@hookform/resolvers`, `html-encoding-sniffer`, `husky`, `immer`, `jest`, `jest-environment-jsdom`, `ldrs`, `lint-staged`, `lodash`, `lucide-react`, `marked`, `nanoid`, `next`, `next-auth`, `@next/env`, `next-themes`, `next-transpile-modules`, `pako`, `path`, `postcss`, `prettier`, `@radix-ui/react-checkbox`, `@radix-ui/react-collapsible`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-label`, `@radix-ui/react-radio-group`, `@radix-ui/react-select`, `@radix-ui/react-slot`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `react`, `react-dom`, `react-haiku`, `react-hook-form`, `react-icons`, `react-textarea-autosize`, `reflect-metadata`, `remark-gfm`, `sonner`, `start-server-and-test`, `style-loader`, `tailwind-merge`, `tailwind-scrollbar-hide`, `@tailwindcss/postcss`, `@tanstack/react-query-devtools`, `@tanstack/react-table`, `@testing-library/react`, `@testing-library/user-event`, `tough-cookie`, `ts-jest`, `ts-node`, `tsyringe`, `tw-animate-css`, `@types/jest`, `@types/jsrsasign`, `@types/node`, `@types/pako`, `@types/react`, `@types/react-dom`, `@types/uuid`, `typescript`, `uuid`, `vitest`, `@vitest/browser`, `@vitest/coverage-v8`, `zod`, `zustand`, `zustand-logger-middleware`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **What connects `CachedAccessToken`, `GeneratedWorkflowTokenProvider`, `PendingAccessToken` to the rest of the system?**
  _485 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `PlatformModule` be split into smaller, more focused modules?**
  _Cohesion score 0.09074410163339383 - nodes in this community are weakly interconnected._
- **Should `scripts` be split into smaller, more focused modules?**
  _Cohesion score 0.03508771929824561 - nodes in this community are weakly interconnected._
- **Should `handler.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06868686868686869 - nodes in this community are weakly interconnected._

## Build Provenance

- Graphify: 0.9.50
- Source commit: 5b560d3caa75e22ff14e23d39c6ab7b3247b8c22
- Built at: 2026-09-21T08:45:22Z
- Nodes: 1334
- Edges: 2231
- graph.json SHA-256: 26a90025bea3990caf07a60bc9c4ffff38e2d733f229d9fea23a850b8bd33ddc
- Scope: code-only canonical full extraction
- Validation: PASS
- Accepted external module identifiers: @enterpriseaigroup/demo
- Deferred semantic scope: docs, media, and semantic-only formats are intentionally excluded.
- Coverage note: no primary coverage is claimed for unsupported Rego or Bicep sources.
- Unsupported tracked extensions: .rego=0; .bicep=0
- Exclusions: none
