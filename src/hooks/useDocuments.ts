'use client';

import { useCallback, useMemo } from 'react';
import {
  type ClassifyByUrlOptions,
  EAIPlatformClient,
  type DocumentWorkflowOptions,
  type RagIndexRequest,
} from '@enterpriseaigroup/platform-sdk';

/**
 * Document processing hook using Platform SDK.
 *
 * The BFF sets the workspace header server-side, so upload, classify, job
 * status and record reads need no tenant ID in the browser. `classifyByUrl`
 * does: pass the override or set NEXT_PUBLIC_EAI_TENANT_ID.
 *
 * @param tenantId - Optional tenant ID override
 *
 * @example
 * ```tsx
 * const { upload, classify, classifyByUrl, getRecord } = useDocuments();
 *
 * await upload(file, { verticalKey: 'permits', workflowKey: 'document-intake' });
 * const results = await classify(files, { verticalKey: 'permits', workflowKey: 'document-intake' });
 * // After getJobStatus(jobId) reports a finished job:
 * const record = await getRecord(documentId, jobId);
 * ```
 */
export function useDocuments(tenantId?: string) {
  const resolvedTenantId =
    tenantId || process.env.NEXT_PUBLIC_EAI_TENANT_ID || '';
  const client = useMemo(
    () => new EAIPlatformClient({ tenantId: resolvedTenantId }),
    [resolvedTenantId],
  );

  const upload = useCallback(
    (file: File, options?: DocumentWorkflowOptions) =>
      client.documents.upload(file, options),
    [client],
  );

  const classify = useCallback(
    (files: File[], options?: DocumentWorkflowOptions) =>
      client.documents.classify(files, options),
    [client],
  );

  const classifyByUrl = useCallback(
    (url: string, options?: ClassifyByUrlOptions) =>
      client.documents.classifyByUrl(url, options),
    [client],
  );

  const ragIndex = useCallback(
    (request: string | RagIndexRequest) => client.documents.ragIndex(request),
    [client],
  );

  const getJobStatus = useCallback(
    (jobId: string) => client.documents.getJobStatus(jobId),
    [client],
  );

  const getRecord = useCallback(
    (documentId: string, jobId?: string) =>
      client.documents.getRecord(documentId, jobId),
    [client],
  );

  return { upload, classify, classifyByUrl, ragIndex, getJobStatus, getRecord };
}
