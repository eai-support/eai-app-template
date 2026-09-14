'use client';

import { useCallback, useMemo } from 'react';
import {
  EAIPlatformClient,
  type DocumentWorkflowOptions,
  type RagIndexRequest,
} from '@enterpriseaigroup/platform-sdk';

/**
 * Document processing hook using Platform SDK.
 *
 * @param tenantId - Optional tenant ID override
 *
 * @example
 * ```tsx
 * const { upload, classify, classifyByUrl } = useDocuments();
 *
 * await upload(file, { verticalKey: 'permits', workflowKey: 'document-intake' });
 * const results = await classify(files, { verticalKey: 'permits', workflowKey: 'document-intake' });
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
    (url: string) => client.documents.classifyByUrl(url),
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

  return { upload, classify, classifyByUrl, ragIndex, getJobStatus };
}
