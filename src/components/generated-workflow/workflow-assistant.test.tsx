import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WorkflowAssistant } from './workflow-assistant';

const originalFetch = global.fetch;
const originalTimeout = AbortSignal.timeout;
beforeAll(() => {
  AbortSignal.timeout = () => new AbortController().signal;
});
afterAll(() => {
  AbortSignal.timeout = originalTimeout;
});
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ answer: 'Review the dates.' }),
  });
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

it('renders model content as text without executing HTML', async () => {
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ answer: '<img src=x onerror=alert(1)>' }),
  });
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
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ answer }),
  });
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
