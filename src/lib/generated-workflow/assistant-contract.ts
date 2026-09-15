import { z } from 'zod';

export const workflowAssistantQuestionSchema = z
  .object({
    question: z.string().trim().min(1).max(2000),
    stepId: z.string().min(1).max(100),
    history: z
      .array(
        z
          .object({
            role: z.enum(['user', 'assistant']),
            content: z.string().min(1).max(4000),
          })
          .strict(),
      )
      .max(12)
      .default([]),
  })
  .strict();

/** One bounded user or assistant turn retained by the public workflow UI. */
export type WorkflowAssistantMessage = {
  role: 'user' | 'assistant';
  content: string;
};

/** Reports whether the bounded SSE stream reached its explicit completion event. */
export interface WorkflowAssistantStreamResult {
  completed: boolean;
  text: string;
}

const TEXT_UPDATE_INTERVAL_MS = 32;

/** Consume the bounded token and completion events exposed by the workflow assistant route. */
export async function readWorkflowAssistantEventStream(
  response: Response,
  onText: (accumulated: string) => void,
  maxTextLength = 4000,
): Promise<WorkflowAssistantStreamResult> {
  if (!response.ok || !response.body) {
    throw new Error('The assistant is unavailable. Please try again.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  let accumulated = '';
  let completed = false;
  let lastTextNotificationAt = Number.NEGATIVE_INFINITY;
  let lastNotifiedText = '';

  function notifyText(force = false): void {
    if (accumulated === lastNotifiedText) return;
    const now = Date.now();
    if (!force && now - lastTextNotificationAt < TEXT_UPDATE_INTERVAL_MS)
      return;
    lastTextNotificationAt = now;
    lastNotifiedText = accumulated;
    onText(accumulated);
  }

  function consumeLine(rawLine: string): void {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (!line.startsWith('data:')) return;
    let event: { type?: string; data?: unknown };
    try {
      event = JSON.parse(line.slice(5).trimStart()) as {
        type?: string;
        data?: unknown;
      };
    } catch {
      throw new Error('The assistant returned an invalid response.');
    }
    if (event.type === 'token' && typeof event.data === 'string') {
      accumulated += event.data;
      if (accumulated.length > maxTextLength) {
        throw new Error('The assistant returned an invalid response.');
      }
    } else if (event.type === 'done') {
      completed = true;
    } else if (event.type === 'error') {
      throw new Error('The assistant is unavailable. Please try again.');
    }
  }

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      const lines = buffered.split('\n');
      buffered = lines.pop() ?? '';
      for (const line of lines) consumeLine(line);
      notifyText();
    }
    buffered += decoder.decode();
    if (buffered) consumeLine(buffered);
    notifyText(true);
  } finally {
    reader.releaseLock();
  }
  return { completed, text: accumulated };
}
