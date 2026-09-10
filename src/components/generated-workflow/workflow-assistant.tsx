'use client';

import { FormEvent, useRef, useState } from 'react';
import { apiUrl } from '@/lib/api-helpers';
import type { WorkflowAssistantMessage } from '@/lib/generated-workflow/assistant-contract';

export function WorkflowAssistant({
  stepId,
  stepTitle,
}: {
  stepId: string;
  stepTitle: string;
}) {
  const [messages, setMessages] = useState<WorkflowAssistantMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const inFlight = useRef(false);

  async function ask(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/eai/workflow-assistant'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          question: text,
          stepId,
          history: messages.slice(-12),
        }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? 'Please wait a minute before asking another question.'
            : 'The assistant is unavailable. Please try again.',
        );
      const output = (await response.json()) as { answer?: unknown };
      if (
        typeof output.answer !== 'string' ||
        !output.answer.trim() ||
        output.answer.length > 4000
      ) {
        throw new Error('The assistant could not answer. Please try again.');
      }
      setMessages(
        (previous) =>
          [
            ...previous,
            { role: 'user', content: text },
            { role: 'assistant', content: String(output.answer) },
          ].slice(-100) as WorkflowAssistantMessage[],
      );
      setQuestion('');
    } catch (cause) {
      setError(
        cause instanceof Error && cause.name === 'Error'
          ? cause.message
          : 'The assistant is unavailable. Please try again.',
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <aside
      aria-label='Workflow assistant'
      className='max-w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'
    >
      <button
        type='button'
        className='w-full text-left font-semibold @4xl/workflow:hidden'
        aria-expanded={expanded}
        aria-controls='workflow-assistant-content'
        onClick={() => setExpanded((value) => !value)}
      >
        Assistant {expanded ? '−' : '+'}
      </button>
      <h2 className='hidden font-semibold @4xl/workflow:block'>Assistant</h2>
      <div
        id='workflow-assistant-content'
        className={`${expanded ? 'block' : 'hidden'} @4xl/workflow:block`}
      >
        <p className='mt-2 text-sm text-slate-600'>
          Ask about {stepTitle.toLowerCase()} and the steps in this workflow.
        </p>
        <div
          role='log'
          aria-label='Assistant conversation'
          aria-live='polite'
          className='my-4 max-h-80 min-w-0 space-y-3 overflow-y-auto'
        >
          {messages.map((message, index) => (
            <p
              key={index}
              className={`max-w-full rounded-lg p-3 text-sm [overflow-wrap:anywhere] whitespace-pre-wrap ${message.role === 'user' ? 'bg-slate-100' : 'border border-slate-100'}`}
            >
              <span className='sr-only'>
                {message.role === 'user' ? 'You' : 'Assistant'}:{' '}
              </span>
              {message.content}
            </p>
          ))}
          {busy && (
            <p role='status' className='text-sm text-slate-500'>
              Thinking…
            </p>
          )}
        </div>
        <form onSubmit={ask} className='space-y-2'>
          <label htmlFor='workflow-assistant-question' className='sr-only'>
            Ask about this workflow
          </label>
          <textarea
            id='workflow-assistant-question'
            value={question}
            maxLength={2000}
            rows={2}
            disabled={busy}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder='Ask about this step…'
            className='w-full rounded-lg border border-slate-300 p-3 text-sm'
          />
          <button
            type='submit'
            disabled={busy || !question.trim()}
            className='rounded-lg bg-slate-950 px-4 py-2 text-sm text-white disabled:opacity-40'
          >
            Ask
          </button>
        </form>
        {error && (
          <p role='alert' className='mt-2 text-sm text-red-700'>
            {error}
          </p>
        )}
      </div>
    </aside>
  );
}
