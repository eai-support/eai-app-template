/**
 * Chat Module
 *
 * SSE streaming and non-streaming chat via /v3/chat/*.
 *
 * CRITICAL field names (from PublicAPI ChatRequest):
 * - message (NOT chat_input)
 * - conversation_id (REQUIRED)
 * - params (REQUIRED, use {} if none)
 */

import type { ChatStreamOptions } from '../types';
import { platformFetch } from '../client';

export class ChatModule {
  constructor(
    private baseUrl: string,
    private streamBaseUrl: string,
    private tenantId: string,
  ) {}

  /**
   * Stream a chat response via SSE.
   * Uses the stream proxy path (streamBaseUrl) for proper SSE header handling.
   *
   * @returns ReadableStream of SSE events
   */
  async stream(options: ChatStreamOptions): Promise<ReadableStream<Uint8Array>> {
    const { workflowId, stage, message, params, ...rest } = options;
    const conversationId = options.conversationId || crypto.randomUUID();

    const url = `${this.streamBaseUrl}/v3/chat/stream/${this.tenantId}/${workflowId}/${stage}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
        params: params || {},
        ...rest.runtime_context && { runtime_context: rest.runtime_context },
        ...rest.message_history && { message_history: rest.message_history },
        ...rest.ai_config && { ai_config: rest.ai_config },
        ...rest.business_request_id && { business_request_id: rest.business_request_id },
      }),
    });

    if (!response.ok || !response.body) {
      const { PlatformError } = await import('../errors');
      throw await PlatformError.fromResponse(response);
    }

    return response.body;
  }

  /**
   * Send a chat message and get a non-streaming response.
   * Uses the standard proxy path (baseUrl).
   */
  async send(options: ChatStreamOptions): Promise<Response> {
    const { workflowId, stage, message, params, ...rest } = options;
    const conversationId = options.conversationId || crypto.randomUUID();

    const url = `${this.baseUrl}/v3/chat/${this.tenantId}/${workflowId}/${stage}`;

    return platformFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversation_id: conversationId,
        params: params || {},
        ...rest.runtime_context && { runtime_context: rest.runtime_context },
        ...rest.message_history && { message_history: rest.message_history },
        ...rest.ai_config && { ai_config: rest.ai_config },
        ...rest.business_request_id && { business_request_id: rest.business_request_id },
      }),
    });
  }
}
