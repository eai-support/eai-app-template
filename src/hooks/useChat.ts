'use client';

import { useCallback, useMemo } from 'react';
import { EAIPlatformClient } from '@enterpriseaigroup/platform-sdk';
import type { ChatStreamOptions } from '@enterpriseaigroup/platform-sdk';

/**
 * Chat hook using Platform SDK.
 *
 * @param workflowId - Configurator workflow ID
 * @param stage - Workflow stage (e.g., 'chat')
 * @param tenantId - Optional tenant ID override
 *
 * @example
 * ```tsx
 * const { stream, send } = useChat('my-workflow', 'chat');
 *
 * const readable = await stream({
 *   message: 'Hello',
 *   conversationId: crypto.randomUUID(),
 *   params: { context: 'permits' },
 * });
 * ```
 */
export function useChat(
  workflowId: string,
  stage: string,
  tenantId?: string,
) {
  const client = useMemo(
    () => new EAIPlatformClient({ tenantId: tenantId || '' }),
    [tenantId],
  );

  const stream = useCallback(
    (options: Omit<ChatStreamOptions, 'workflowId' | 'stage'>) =>
      client.chat.stream({ ...options, workflowId, stage }),
    [client, workflowId, stage],
  );

  const send = useCallback(
    (options: Omit<ChatStreamOptions, 'workflowId' | 'stage'>) =>
      client.chat.send({ ...options, workflowId, stage }),
    [client, workflowId, stage],
  );

  return { stream, send };
}
