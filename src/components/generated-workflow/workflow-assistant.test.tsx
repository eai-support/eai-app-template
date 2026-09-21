import { TextDecoder, TextEncoder } from 'node:util';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WorkflowAssistant } from './workflow-assistant';

const originalFetch = global.fetch;
const originalTimeout = AbortSignal.timeout;
const originalTextDecoder = global.TextDecoder;

function streamingResponse(answer: string): Response {
  const encoder = new TextEncoder();
  return {
    ok: true,
    status: 200,
    body: new globalThis.ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'token', data: answer })}\n\n`,
          ),
        );
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'done', data: null })}\n\n`,
          ),
        );
        controller.close();
      },
    }),
  } as unknown as Response;
}

beforeAll(() => {
  AbortSignal.timeout = () => new AbortController().signal;
  global.TextDecoder = TextDecoder as unknown as typeof global.TextDecoder;
});
afterAll(() => {
  AbortSignal.timeout = originalTimeout;
  global.TextDecoder = originalTextDecoder;
});
beforeEach(() => {
  global.fetch = jest
    .fn()
    .mockResolvedValue(streamingResponse('Review the dates.'));
});
afterEach(() => {
  global.fetch = originalFetch;
});

it('keeps one bubble conversation when closed and when the workflow step changes', async () => {
  const view = render(
    <WorkflowAssistant stepId='submit' stepTitle='Submit' variant='bubble' />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open assistant' }));
  fireEvent.change(screen.getByLabelText('Ask about this workflow'), {
    target: { value: 'What happens next?' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Ask assistant' }));
  await screen.findByText('Review the dates.');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual(
    { question: 'What happens next?', stepId: 'submit', history: [] },
  );
  fireEvent.click(screen.getByRole('button', { name: 'Close assistant' }));
  view.rerender(
    <WorkflowAssistant stepId='review' stepTitle='Review' variant='bubble' />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Open assistant' }));
  expect(screen.getByText('Review the dates.')).toBeVisible();
  expect(screen.getAllByRole('log')).toHaveLength(1);
  fireEvent.change(screen.getByLabelText('Ask about this workflow'), {
    target: { value: 'Why review?' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Ask assistant' }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)).toEqual(
    {
      question: 'Why review?',
      stepId: 'review',
      history: [
        { role: 'user', content: 'What happens next?' },
        { role: 'assistant', content: 'Review the dates.' },
      ],
    },
  );
});

it('does not auto-call the model and retains a failed question for deliberate retry', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 429 });
  render(<WorkflowAssistant stepId='submit' stepTitle='Submit' />);
  expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Ask about this workflow'), {
    target: { value: 'Why?' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Ask assistant' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Ask about this workflow')).toHaveValue('Why?');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('log')).toBeEmptyDOMElement();
});

it('explains a bounded timeout and exposes an explicit retry action', async () => {
  const timeout = new Error('The operation timed out');
  timeout.name = 'TimeoutError';
  (global.fetch as jest.Mock).mockRejectedValue(timeout);
  render(<WorkflowAssistant stepId='submit' stepTitle='Submit' />);
  fireEvent.change(screen.getByLabelText('Ask about this workflow'), {
    target: { value: 'What happens next?' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Ask assistant' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The assistant took too long. Retry your question.',
  );
  expect(screen.getByLabelText('Ask about this workflow')).toHaveValue(
    'What happens next?',
  );
  expect(screen.getByRole('button', { name: 'Retry assistant' })).toBeEnabled();
});

it('renders model content as text without executing HTML', async () => {
  (global.fetch as jest.Mock).mockResolvedValue(
    streamingResponse('<img src=x onerror=alert(1)>'),
  );
  render(<WorkflowAssistant stepId='submit' stepTitle='Submit' />);
  fireEvent.change(screen.getByLabelText('Ask about this workflow'), {
    target: { value: 'Why?' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Ask assistant' }));
  await screen.findByText('<img src=x onerror=alert(1)>');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
});

it('allows long unbroken answers to wrap inside the assistant column', async () => {
  const answer = `https://example.com/${'a'.repeat(500)}`;
  (global.fetch as jest.Mock).mockResolvedValue(streamingResponse(answer));
  render(<WorkflowAssistant stepId='submit' stepTitle='Submit' />);
  fireEvent.change(screen.getByLabelText('Ask about this workflow'), {
    target: { value: 'Where is it?' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Ask assistant' }));
  const message = await screen.findByText(answer);
  expect(message).toHaveClass('max-w-full', '[overflow-wrap:anywhere]');
  expect(screen.getByLabelText('Workflow assistant')).toHaveClass(
    'border-l',
    'max-w-full',
  );
});

it('renders partial assistant tokens before the stream completes', async () => {
  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  const body = new globalThis.ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
    },
  });
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    body: body as unknown as globalThis.ReadableStream<Uint8Array>,
  } as Response);
  render(<WorkflowAssistant stepId='submit' stepTitle='Submit' />);
  fireEvent.change(screen.getByLabelText('Ask about this workflow'), {
    target: { value: 'Why?' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Ask assistant' }));
  await waitFor(() => expect(streamController).toBeDefined());

  streamController?.enqueue(
    encoder.encode('data: {"type":"token","data":"Review"}\n\n'),
  );

  expect(await screen.findByText('Review')).toBeVisible();
  expect(screen.getByRole('status')).toHaveTextContent('Answering…');

  streamController?.enqueue(
    encoder.encode(
      'data: {"type":"token","data":" the dates."}\n\n' +
        'data: {"type":"done","data":null}\n\n',
    ),
  );
  streamController?.close();

  expect(await screen.findByText('Review the dates.')).toBeVisible();
  await waitFor(() =>
    expect(screen.queryByRole('status')).not.toBeInTheDocument(),
  );
});

it('renders the same persistent assistant rail as the signed preview', () => {
  render(<WorkflowAssistant stepId='submit' stepTitle='Submit' />);

  expect(screen.getByRole('heading', { name: 'Assistant' })).toBeVisible();
  expect(
    screen.getByText(
      'Ask about this process — routing, approvals, or what happens next.',
    ),
  ).toBeVisible();
  expect(screen.getByPlaceholderText('Ask about your results…')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Open assistant' }),
  ).not.toBeInTheDocument();
});
