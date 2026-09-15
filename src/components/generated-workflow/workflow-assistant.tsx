'use client';

import { FormEvent, useId, useRef, useState } from 'react';
import { ArrowUp, Sparkles } from 'lucide-react';

import { apiUrl } from '@/lib/api-helpers';
import {
  readWorkflowAssistantEventStream,
  type WorkflowAssistantMessage,
} from '@/lib/generated-workflow/assistant-contract';

export function WorkflowAssistant({
  stepId,
  stepTitle,
  variant = 'rail',
}: {
  stepId: string;
  stepTitle: string;
  variant?: 'rail' | 'bubble';
}) {
  const [messages, setMessages] = useState<WorkflowAssistantMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState('');
  const [streamingAnswer, setStreamingAnswer] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const inFlight = useRef(false);
  const id = useId();

  async function ask(event: FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (!text || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setActiveQuestion(text);
    setQuestion('');
    setStreamingAnswer('');
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
      const output = await readWorkflowAssistantEventStream(
        response,
        setStreamingAnswer,
      );
      if (!output.completed || !output.text.trim()) {
        throw new Error('The assistant could not answer. Please try again.');
      }
      setMessages(
        (previous) =>
          [
            ...previous,
            { role: 'user', content: text },
            { role: 'assistant', content: output.text.trim() },
          ].slice(-100) as WorkflowAssistantMessage[],
      );
    } catch (cause) {
      setQuestion(text);
      setError(
        cause instanceof Error && cause.name === 'Error'
          ? cause.message
          : 'The assistant is unavailable. Please try again.',
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
      setActiveQuestion('');
      setStreamingAnswer('');
    }
  }

  const conversation = (
    <>
      {messages.map((message, index) => (
        <p
          key={index}
          className={`max-w-full rounded-lg p-3 text-sm [overflow-wrap:anywhere] whitespace-pre-wrap ${message.role === 'user' ? 'bg-muted' : 'border'}`}
        >
          <span className='sr-only'>
            {message.role === 'user' ? 'You' : 'Assistant'}:{' '}
          </span>
          {message.content}
        </p>
      ))}
      {activeQuestion ? (
        <p className='bg-muted max-w-full rounded-lg p-3 text-sm [overflow-wrap:anywhere] whitespace-pre-wrap'>
          <span className='sr-only'>You: </span>
          {activeQuestion}
        </p>
      ) : null}
      {streamingAnswer ? (
        <p className='max-w-full rounded-lg border p-3 text-sm [overflow-wrap:anywhere] whitespace-pre-wrap'>
          <span className='sr-only'>Assistant: </span>
          {streamingAnswer}
        </p>
      ) : null}
      {busy ? (
        <p role='status' className='text-muted-foreground text-sm'>
          {streamingAnswer ? 'Answering…' : 'Thinking…'}
        </p>
      ) : null}
    </>
  );

  const input = (
    <form
      onSubmit={ask}
      className={
        variant === 'rail'
          ? 'flex h-16 shrink-0 items-center gap-2 border-t px-3'
          : 'flex items-end gap-2 border-t p-3'
      }
    >
      <label htmlFor={`${id}-question`} className='sr-only'>
        Ask about this workflow
      </label>
      <textarea
        id={`${id}-question`}
        value={question}
        maxLength={2000}
        rows={1}
        disabled={busy}
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder={
          variant === 'rail'
            ? 'Ask about your results…'
            : 'Ask about this step…'
        }
        className='bg-background min-h-10 w-full resize-none rounded-lg border p-3 text-sm'
      />
      <button
        type='submit'
        disabled={busy || !question.trim()}
        aria-label='Ask assistant'
        className='bg-foreground text-background flex size-10 shrink-0 items-center justify-center rounded-lg disabled:opacity-40'
      >
        <ArrowUp className='size-4' aria-hidden='true' />
      </button>
    </form>
  );

  if (variant === 'bubble') {
    return (
      <aside
        aria-label='Workflow assistant'
        className='absolute right-4 bottom-20 z-20 flex max-h-[calc(100%-6rem)] max-w-[calc(100%-2rem)] flex-col items-end'
      >
        {expanded ? (
          <div
            id={id}
            className='bg-background mb-3 flex min-h-0 w-80 max-w-full flex-col overflow-hidden rounded-2xl border shadow-xl'
          >
            <div className='flex items-center justify-between border-b px-4 py-3'>
              <h2 className='font-semibold'>Assistant</h2>
              <button
                type='button'
                aria-label='Close assistant'
                className='text-muted-foreground hover:text-foreground flex size-7 items-center justify-center rounded-full'
                onClick={() => setExpanded(false)}
              >
                <span aria-hidden='true'>×</span>
              </button>
            </div>
            <p className='text-muted-foreground px-4 pt-4 text-sm'>
              Ask about {stepTitle.toLowerCase()} or what happens next.
            </p>
            <div
              role='log'
              aria-label='Assistant conversation'
              aria-live='polite'
              className='my-3 max-h-72 min-w-0 space-y-3 overflow-y-auto px-4'
            >
              {conversation}
            </div>
            {input}
            {error ? (
              <p role='alert' className='text-destructive px-4 pb-3 text-sm'>
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
        <button
          type='button'
          aria-label='Open assistant'
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded(true)}
          className='bg-foreground text-background flex size-12 items-center justify-center rounded-full shadow-lg'
        >
          <Sparkles className='size-5' aria-hidden='true' />
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label='Workflow assistant'
      className='bg-background flex min-h-0 w-[min(20rem,32%)] max-w-full min-w-64 shrink-0 flex-col border-l'
    >
      <h2 className='flex items-center justify-between border-b px-4 py-4 font-semibold'>
        Assistant
        <Sparkles className='text-muted-foreground size-4' aria-hidden='true' />
      </h2>
      <div className='flex min-h-0 flex-1 flex-col'>
        <p className='text-muted-foreground px-4 pt-4 text-sm'>
          Ask about this process — routing, approvals, or what happens next.
        </p>
        <div
          role='log'
          aria-label='Assistant conversation'
          aria-live='polite'
          className='my-3 min-w-0 flex-1 space-y-3 overflow-y-auto px-4'
        >
          {conversation}
        </div>
        {input}
        {error ? (
          <p role='alert' className='text-destructive px-4 pb-3 text-sm'>
            {error}
          </p>
        ) : null}
      </div>
    </aside>
  );
}
