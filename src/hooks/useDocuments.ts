'use client';

import { useCallback, useMemo } from 'react';
import { EAIPlatformClient } from '@enterpriseaigroup/platform-sdk';

/**
 * Document processing hook using Platform SDK.
 *
 * @param tenantId - Optional tenant ID override
 *
 * @example
 * ```tsx
 * const { upload, classify, classifyByUrl } = useDocuments();
 *
 * await upload(file, { category: 'permit' });
 * const results = await classify(files);
 * ```
 */
export function useDocuments(tenantId?: string) {
  const client = useMemo(
    () => new EAIPlatformClient({ tenantId: tenantId || '' }),
    [tenantId],
  );

  const upload = useCallback(
    (file: File, metadata?: Record<string, string>) =>
      client.documents.upload(file, metadata),
    [client],
  );

  const classify = useCallback(
    (files: File[]) => client.documents.classify(files),
    [client],
  );

  const classifyByUrl = useCallback(
    (url: string) => client.documents.classifyByUrl(url),
    [client],
  );

  const ragIndex = useCallback(
    (documentId: string) => client.documents.ragIndex(documentId),
    [client],
  );

  return { upload, classify, classifyByUrl, ragIndex };
}
