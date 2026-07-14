/**
 * @enterpriseaigroup/platform-sdk
 *
 * Typed TypeScript SDK for the Enterprise AI platform API.
 * All calls go through the BFF proxy — tokens are injected server-side.
 */

// Client
export { EAIPlatformClient, platformFetch } from './client';
export type { PlatformClientConfig } from './client';

// Errors
export { PlatformError } from './errors';
export type { PlatformErrorDetails } from './errors';

// Shared object-type helpers
export { toObjectTypeSlug } from './object-types';

// Types
export type {
  Resource,
  ResourceUpdate,
  PaginatedResponse,
  ListOptions,
  AggregateRequest,
  AggregateResponse,
  BatchCreateItem,
  BatchResponse,
  BatchUpdateItem,
  ObjectTypeManagementRequest,
  ResourceFileCompleteRequest,
  ResourceFileDeleteResponse,
  ResourceFileIndexStatusResponse,
  ResourceFileResponse,
  ResourceFileRetryResponse,
  ResourceFileSasOptions,
  ResourceFileSasResponse,
  ResourceFileUploadOptions,
  ResourceFileUploadSessionOptions,
  ResourceFileUploadSessionRequest,
  ResourceFileUploadSessionResponse,
  ResourceSearchHit,
  ResourceSearchMode,
  ResourceSearchRequest,
  ResourceSearchResponse,
  ChatMessage,
  ChatStreamOptions,
  ProvisionMeRequest,
  EntraUser,
  ChecklistRequest,
  QueryRequest,
  RetryOptions,
  CreateLinkRequest,
} from './types';

// Module types (for consumers who need to type module references)
export type { ResourcesModule } from './modules/resources';
export type { ChatModule } from './modules/chat';
export type {
  BatchJobStatusResponse,
  DocumentsModule,
  RagIndexRequest,
  RagIndexResponse,
} from './modules/documents';
export type { UsersModule } from './modules/users';
export type { AuthModule } from './modules/auth';
export type {
  PlatformHttpMethod,
  PlatformModule,
  PlatformRequestOptions,
} from './modules/platform';
