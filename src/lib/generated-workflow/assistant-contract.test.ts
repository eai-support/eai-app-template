import { TextDecoder, TextEncoder } from 'node:util';

import { readWorkflowAssistantEventStream } from './assistant-contract';

const originalTextDecoder = global.TextDecoder;

beforeAll(() => {
  global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder;
});

afterAll(() => {
  global.TextDecoder = originalTextDecoder;
});

function streamingResponse(events: string[]): Response {
  const encoder = new TextEncoder();
  return {
    ok: true,
    body: new globalThis.ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(event));
        }
        controller.close();
      },
    }),
  } as unknown as Response;
}

it('coalesces bursty assistant tokens while preserving the exact final answer', async () => {
  const tokens = Array.from({ length: 100 }, (_, index) => `${index},`);
  const response = streamingResponse([
    tokens
      .map(
        (token) =>
          `data: ${JSON.stringify({ type: 'token', data: token })}\n\n`,
      )
      .join(''),
    `data: ${JSON.stringify({ type: 'done', data: null })}\n\n`,
  ]);
  const onText = jest.fn();

  const result = await readWorkflowAssistantEventStream(response, onText);

  expect(result).toEqual({ completed: true, text: tokens.join('') });
  expect(onText).toHaveBeenCalledTimes(1);
  expect(onText).toHaveBeenLastCalledWith(tokens.join(''));
});
