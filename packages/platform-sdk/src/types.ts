/**
 * Platform SDK Types
 *
 * Core types derived from PublicAPI Pydantic models and ResourceAPI contracts.
 * Verified against platform submodules by engineering review.
 */

// ---------------------------------------------------------------------------
// Resource types (from ResourceAPI resource.py)
// ---------------------------------------------------------------------------

export interface Resource<T = Record<string, unknown>> {
  id: string;
  tenant_id: string;
  object_type: string;
  data: T;
  version: number;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ResourceUpdate {
  data: Record<string, unknown>;
  /** Required for optimistic locking. ResourceAPI returns 409 on mismatch. */
  version: number;
}

export interface PaginatedResponse<T> {
  docs: T[];
  totalDocs: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  nextCursor?: string | null;
}

export interface FilterExpression {
  equals?: unknown;
  not_equals?: unknown;
  greater_than?: unknown;
  greater_than_equal?: unknown;
  less_than?: unknown;
  less_than_equal?: unknown;
  in?: unknown[];
  not_in?: unknown[];
  exists?: boolean;
}

export interface ListOptions {
  page?: number;
  limit?: number;
  sort?: string;
  where?: Record<string, unknown>;
  cursor?: string;
}

export interface AggregateMetricDefinition {
  function: 'count' | 'sum' | 'avg' | 'count_distinct' | 'min' | 'max';
  field?: string;
}

export interface AggregateRequest {
  groupBy: string[];
  metrics: Record<string, AggregateMetricDefinition>;
  where?: Record<string, unknown>;
  limit?: number;
}

export interface AggregateResponse {
  rows: Array<Record<string, unknown>>;
  totalRows: number;
}

export interface BatchCreateItem<T = Record<string, unknown>> {
  data: T;
}

export interface BatchUpdateItem<T = Record<string, unknown>> {
  id: string;
  data: T;
  version: number;
}

export interface BatchResultItem {
  index: number;
  id?: string | null;
  success: boolean;
  version?: number | null;
  error?: string | null;
}

export interface BatchResponse {
  succeeded: number;
  failed: number;
  results: BatchResultItem[];
}

export interface RetryOptions {
  enabled?: boolean;
  maxRetries?: number;
  baseDelayMs?: number;
}

// ---------------------------------------------------------------------------
// Orchestration types (from PublicAPI orchestration.py)
// ---------------------------------------------------------------------------

export type TargetBackend = 'payload' | 'mid' | 'resources';

export interface OrchestrationMultipart {
  file_field_name?: string;
  filename: string;
  content_base64: string;
  content_type?: string;
  form_data?: Record<string, string>;
}

export interface OrchestrationRequest {
  target_backend: TargetBackend;
  /**
   * Endpoint path on the target backend.
   * CRITICAL: For target_backend "payload", do NOT include /api prefix.
   * The orchestrator_service already prepends /api.
   * Use "/object-types" not "/api/object-types".
   */
  endpoint: string;
  /** HTTP method. Defaults to "POST" on the server. */
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  multipart?: OrchestrationMultipart;
}

// ---------------------------------------------------------------------------
// Chat types (from PublicAPI chat.py ChatRequest)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  /** The user's message text. Maps to ChatRequest.message. */
  message: string;
  /** Conversation ID. Maps to ChatRequest.conversation_id. REQUIRED. */
  conversation_id: string;
  /** Parameters dict. Maps to ChatRequest.params. REQUIRED, use {} if none. */
  params: Record<string, unknown>;
  runtime_context?: Record<string, unknown>;
  message_history?: Array<{ role: string; content: string }>;
  ai_config?: Record<string, unknown>;
  business_request_id?: string;
}

export interface ChatStreamOptions {
  workflowId: string;
  stage: string;
  message: string;
  /** Auto-generated via crypto.randomUUID() if not provided. */
  conversationId?: string;
  /** Use {} if no params needed. */
  params?: Record<string, unknown>;
  runtime_context?: Record<string, unknown>;
  message_history?: Array<{ role: string; content: string }>;
  ai_config?: Record<string, unknown>;
  business_request_id?: string;
}

// ---------------------------------------------------------------------------
// User types (from PublicAPI users.py)
// ---------------------------------------------------------------------------

export interface ProvisionMeRequest {
  tenant_id: string;
}

export interface EntraUser {
  oid: string;
  tid: string;
  email?: string;
  name?: string;
  azp?: string;
}

// ---------------------------------------------------------------------------
// Document types (from PublicAPI documents.py)
// ---------------------------------------------------------------------------

export interface ChecklistRequest {
  tenant_id: string;
  /** REQUIRED - the type of development */
  development_type: string;
  zone?: string;
  lot_size?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Query types (from ResourceAPI query.py)
// ---------------------------------------------------------------------------

export interface JoinConfig {
  type?: string;
  /** Alias for from_type. Use "from" in JSON. */
  from: string;
  link_type: string;
  to: string;
}

export interface QueryRequest {
  /** List of object type names to query across. */
  object_types: string[];
  /** Filters keyed by object type name, e.g. { Case: { status: { equals: 'open' } } } */
  where?: Record<string, Record<string, unknown>>;
  /** Optional join configuration for cross-type link queries. */
  join?: JoinConfig;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Link types
// ---------------------------------------------------------------------------

export interface CreateLinkRequest {
  target_id: string;
  /** Required by ResourceAPI — the object type of the target resource. */
  target_type: string;
}
