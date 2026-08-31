'use client';

import { useCallback, useMemo } from 'react';
import { EAIPlatformClient } from '@enterpriseaigroup/platform-sdk';
import type { ChatStreamOptions } from '@enterpriseaigroup/platform-sdk';

import { templateCapabilityRequirements } from '@/eai.config/capabilities';
import { capabilityRequestContext } from '@/lib/platform/capability-bindings';

type BoundChatOptions = Omit<ChatStreamOptions, 'workflowId' | 'stage'>;

export interface UseChatResult {
  readonly stream: (
    options: BoundChatOptions,
  ) => Promise<ReadableStream<Uint8Array>>;
  readonly send: (options: BoundChatOptions) => Promise<Response>;
}

/**
 * Chat hook using Platform SDK.
 *
 * @param workflowId - Platform workflow ID
 * @param stage - Workflow stage (e.g., 'chat')
 * @param tenantId - Optional tenant ID override
 *
 * @example
 * ```tsx
 * const { stream, send } = useChat(
 *   'my-workflow',
 *   'chat',
 *   undefined,
 *   'assistant-prompt',
 * );
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
  capabilityAlias?: string,
): UseChatResult {
  const resolvedTenantId =
    tenantId || process.env.NEXT_PUBLIC_EAI_TENANT_ID || '';
  const client = useMemo(
    () => new EAIPlatformClient({ tenantId: resolvedTenantId }),
    [resolvedTenantId],
  );
  const capabilityContext = useMemo(
    () =>
      capabilityAlias
        ? capabilityRequestContext(
            templateCapabilityRequirements,
            capabilityAlias,
          )
        : undefined,
    [capabilityAlias],
  );

  const stream = useCallback(
    (options: BoundChatOptions) =>
      client.chat.stream({
        ...options,
        ...capabilityContext,
        workflowId,
        stage,
      }),
    [capabilityContext, client, workflowId, stage],
  );

  const send = useCallback(
    (options: BoundChatOptions) =>
      client.chat.send({
        ...options,
        ...capabilityContext,
        workflowId,
        stage,
      }),
    [capabilityContext, client, workflowId, stage],
  );

  return { stream, send };
}
