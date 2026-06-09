/**
 * Resources Module
 *
 * CRUD operations on domain resources via /v3/resources/{tenant}/{type}[/{id}].
 * ResourceAPI routes tenant-scoped data to the configured backend while
 * preserving a consistent external REST contract.
 */

import type {
  AggregateRequest,
  AggregateResponse,
  BatchCreateItem,
  BatchResponse,
  BatchUpdateItem,
  RetryOptions,
  Resource,
  PaginatedResponse,
  ListOptions,
  QueryRequest,
  CreateLinkRequest,
} from '../types';
import { PlatformError } from '../errors';
import { platformFetch } from '../client';

export class ResourcesModule {
  constructor(
    private baseUrl: string,
    private tenantId: string,
  ) {}

  private resourceUrl(objectType: string, id?: string): string {
    const slug = objectType
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
      .toLowerCase();
    const base = `${this.baseUrl}/v3/resources/${this.tenantId}/${slug}`;
    return id ? `${base}/${id}` : base;
  }

  private async retryingUpdate<T = Record<string, unknown>>(
    objectType: string,
    id: string,
    data: T,
    version: number,
    retry?: RetryOptions,
  ): Promise<Resource<T>> {
    const enabled = retry?.enabled ?? true;
    const maxRetries = retry?.maxRetries ?? 3;
    const baseDelayMs = retry?.baseDelayMs ?? 100;

    let nextVersion = version;
    let attempt = 0;
    while (true) {
      try {
        const response = await platformFetch(this.resourceUrl(objectType, id), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, version: nextVersion }),
        });
        return response.json();
      } catch (error) {
        if (!(error instanceof PlatformError) || !error.isConflict || !enabled || attempt >= maxRetries) {
          throw error;
        }

        // A 409 means another writer won the optimistic-lock race. Refresh the
        // latest version and retry so callers can opt into safe write retries
        // without reimplementing conflict handling at every call site.
        const latest = await this.get(objectType, id);
        nextVersion = latest.version;
        const delayMs = baseDelayMs * (2 ** attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        attempt += 1;
      }
    }
  }

  /** Create a new resource. */
  async create<T = Record<string, unknown>>(
    objectType: string,
    data: T,
  ): Promise<Resource<T>> {
    const response = await platformFetch(this.resourceUrl(objectType), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
    });
    return response.json();
  }

  /** Get a single resource by ID. */
  async get<T = Record<string, unknown>>(
    objectType: string,
    id: string,
  ): Promise<Resource<T>> {
    const response = await platformFetch(this.resourceUrl(objectType, id));
    return response.json();
  }

  /** List resources with optional pagination, sorting, and filtering. */
  async list<T = Record<string, unknown>>(
    objectType: string,
    options?: ListOptions,
  ): Promise<PaginatedResponse<Resource<T>>> {
    const url = new URL(this.resourceUrl(objectType), globalThis.location?.origin || 'http://localhost');
    if (options?.page) url.searchParams.set('page', String(options.page));
    if (options?.limit) url.searchParams.set('limit', String(options.limit));
    if (options?.sort) url.searchParams.set('sort', options.sort);
    if (options?.where) url.searchParams.set('where', JSON.stringify(options.where));
    if (options?.cursor) url.searchParams.set('cursor', options.cursor);

    const response = await platformFetch(url.pathname + url.search);
    return response.json();
  }

  async stream(
    objectType: string,
    options?: Pick<ListOptions, 'limit' | 'sort' | 'where' | 'cursor'>,
  ): Promise<Response> {
    const url = new URL(`${this.resourceUrl(objectType)}/stream`, globalThis.location?.origin || 'http://localhost');
    if (options?.limit) url.searchParams.set('limit', String(options.limit));
    if (options?.sort) url.searchParams.set('sort', options.sort);
    if (options?.where) url.searchParams.set('where', JSON.stringify(options.where));
    if (options?.cursor) url.searchParams.set('cursor', options.cursor);
    return platformFetch(url.pathname + url.search);
  }

  /**
   * Update a resource. Version is REQUIRED for optimistic locking.
   * ResourceAPI returns 409 on version mismatch.
   */
  async update<T = Record<string, unknown>>(
    objectType: string,
    id: string,
    data: T,
    version: number,
    retry?: RetryOptions,
  ): Promise<Resource<T>> {
    return this.retryingUpdate(objectType, id, data, version, retry);
  }

  /** Delete a resource by ID. */
  async delete(objectType: string, id: string): Promise<void> {
    await platformFetch(this.resourceUrl(objectType, id), {
      method: 'DELETE',
    });
  }

  async batchCreate<T = Record<string, unknown>>(
    objectType: string,
    items: Array<BatchCreateItem<T>>,
  ): Promise<BatchResponse> {
    const response = await platformFetch(`${this.resourceUrl(objectType)}/batch/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    return response.json();
  }

  async batchUpdate<T = Record<string, unknown>>(
    objectType: string,
    items: Array<BatchUpdateItem<T>>,
  ): Promise<BatchResponse> {
    const response = await platformFetch(`${this.resourceUrl(objectType)}/batch/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    return response.json();
  }

  async batchDelete(objectType: string, ids: string[]): Promise<BatchResponse> {
    const response = await platformFetch(`${this.resourceUrl(objectType)}/batch/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    return response.json();
  }

  async aggregate(objectType: string, request: AggregateRequest): Promise<AggregateResponse> {
    const response = await platformFetch(`${this.resourceUrl(objectType)}/aggregate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return response.json();
  }

  /** Execute a named action on a resource. */
  async executeAction(
    objectType: string,
    id: string,
    action: string,
    params?: Record<string, unknown>,
  ): Promise<Response> {
    return platformFetch(
      `${this.resourceUrl(objectType, id)}/actions/${action}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params: params ?? {} }),
      },
    );
  }

  /** Get linked resources. */
  async getLinks<T = Record<string, unknown>>(
    objectType: string,
    id: string,
    linkType: string,
  ): Promise<Resource<T>[]> {
    const response = await platformFetch(
      `${this.resourceUrl(objectType, id)}/links/${linkType}`,
    );
    return response.json();
  }

  /** Create a link between two resources. */
  async createLink(
    objectType: string,
    id: string,
    linkType: string,
    targetId: string,
    targetType: string,
  ): Promise<Response> {
    const body: CreateLinkRequest = { target_id: targetId, target_type: targetType };
    return platformFetch(
      `${this.resourceUrl(objectType, id)}/links/${linkType}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
  }

  /** Delete a link between two resources. */
  async deleteLink(
    objectType: string,
    id: string,
    linkType: string,
    targetId: string,
  ): Promise<void> {
    await platformFetch(
      `${this.resourceUrl(objectType, id)}/links/${linkType}/${targetId}`,
      { method: 'DELETE' },
    );
  }

  /** Execute a query against resources. */
  async query<T = Record<string, unknown>>(
    request: QueryRequest,
  ): Promise<PaginatedResponse<Resource<T>>> {
    const response = await platformFetch(
      `${this.baseUrl}/v3/resources/${this.tenantId}/query`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      },
    );
    return response.json();
  }

  /** Get the schema for all object types in this tenant. */
  async getSchema(): Promise<Record<string, unknown>> {
    const response = await platformFetch(
      `${this.baseUrl}/v3/resources/schema/${this.tenantId}`,
    );
    return response.json();
  }

  /** Get the change history for a resource. */
  async getHistory(
    objectType: string,
    id: string,
  ): Promise<Record<string, unknown>[]> {
    const response = await platformFetch(
      `${this.resourceUrl(objectType, id)}/history`,
    );
    return response.json();
  }
}
