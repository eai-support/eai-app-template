'use client';

import { useCallback, useMemo } from 'react';
import { EAIPlatformClient } from '@enterpriseaigroup/platform-sdk';
import type {
  AggregateRequest,
  BatchCreateItem,
  BatchUpdateItem,
  ListOptions,
  RetryOptions,
} from '@enterpriseaigroup/platform-sdk';

/**
 * Generic CRUD hook for platform resources.
 * Uses Platform SDK → BFF Proxy → PublicAPI → ResourceAPI.
 *
 * @param objectType - PascalCase object type name (e.g., 'Application')
 * @param tenantId - Optional tenant ID override (defaults to client default)
 *
 * @example
 * ```tsx
 * const { list, get, create, update, delete: remove } = useResources<ApplicationData>('Application');
 *
 * // List with pagination
 * const response = await list({ page: 1, limit: 20, sort: '-created_at' });
 *
 * // Update (version REQUIRED for optimistic locking)
 * await update('resource-id', { status: 'submitted' }, currentVersion);
 * ```
 */
export function useResources<T = Record<string, unknown>>(
  objectType: string,
  tenantId?: string,
) {
  const client = useMemo(
    () => new EAIPlatformClient({ tenantId: tenantId || '' }),
    [tenantId],
  );

  const list = useCallback(
    (options?: ListOptions) => client.resources.list(objectType, options),
    [client, objectType],
  );

  const get = useCallback(
    (id: string) => client.resources.get(objectType, id),
    [client, objectType],
  );

  const create = useCallback(
    (data: T) => client.resources.create(objectType, data),
    [client, objectType],
  );

  const update = useCallback(
    (id: string, data: Partial<T>, version: number, retry?: RetryOptions) =>
      client.resources.update(objectType, id, data, version, retry),
    [client, objectType],
  );

  const batchCreate = useCallback(
    (items: Array<BatchCreateItem<T>>) => client.resources.batchCreate(objectType, items),
    [client, objectType],
  );

  const batchUpdate = useCallback(
    (items: Array<BatchUpdateItem<T>>) => client.resources.batchUpdate(objectType, items),
    [client, objectType],
  );

  const batchDelete = useCallback(
    (ids: string[]) => client.resources.batchDelete(objectType, ids),
    [client, objectType],
  );

  const aggregate = useCallback(
    (request: AggregateRequest) => client.resources.aggregate(objectType, request),
    [client, objectType],
  );

  const del = useCallback(
    (id: string) => client.resources.delete(objectType, id),
    [client, objectType],
  );

  const executeAction = useCallback(
    (id: string, action: string, params?: Record<string, unknown>) =>
      client.resources.executeAction(objectType, id, action, params),
    [client, objectType],
  );

  return {
    list,
    get,
    create,
    update,
    batchCreate,
    batchUpdate,
    batchDelete,
    aggregate,
    delete: del,
    executeAction,
  };
}
