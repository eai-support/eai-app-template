'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';

import { apiUrl } from '@/lib/api-helpers';
import type { WorkflowAssistantMessage } from '@/lib/generated-workflow/assistant-contract';
import type {
  GeneratedAppRuntimeBinding,
  GeneratedWorkflowBranding,
  GeneratedWorkflowSnapshot,
  GeneratedWorkflowStep,
} from '@/lib/generated-workflow/runtime-contract';
import {
  isSubmissionFileRef,
  validateSubmissionFile,
} from '@/lib/generated-workflow/submission-files';
import { validateFieldValue } from '@/lib/generated-workflow/field-validation';
import { GeneratedWorkflowFieldInput } from './field-input';
import {
  GeneratedWorkflowSmartBlock,
  isSupportedGeneratedWorkflowBlock,
} from './smart-block';

const WorkflowAssistant = dynamic(() =>
  import('./workflow-assistant').then((module) => module.WorkflowAssistant),
);

interface GeneratedWorkflowFormProps {
  appKey: string;
  binding: GeneratedAppRuntimeBinding;
  snapshot: GeneratedWorkflowSnapshot;
  branding?: GeneratedWorkflowBranding;
  assistantEnabled?: boolean;
}

type SubmitState = 'starting' | 'idle' | 'submitting' | 'submitted' | 'error';

function detectDevice(): 'Desktop' | 'Mobile' | 'Tablet' {
  if (window.innerWidth < 640) return 'Mobile';
  if (window.innerWidth < 1024) return 'Tablet';
  return 'Desktop';
}

function useCompactViewport(): boolean {
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 767px)').matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setCompact(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return compact;
}

function readableTextColor(background: string): string {
  const red = Number.parseInt(background.slice(1, 3), 16);
  const green = Number.parseInt(background.slice(3, 5), 16);
  const blue = Number.parseInt(background.slice(5, 7), 16);
  return (red * 299 + green * 587 + blue * 114) / 1000 > 160
    ? '#0f172a'
    : '#ffffff';
}

function normalizeSteps(
  snapshot: GeneratedWorkflowSnapshot,
): GeneratedWorkflowStep[] {
  return snapshot.steps.map((step, stepIndex) => ({
    ...step,
    id: step.id || `step-${stepIndex + 1}`,
    title: step.title || step.name || `Step ${stepIndex + 1}`,
    fields: (step.fields ?? []).map((field, fieldIndex) => ({
      ...field,
      id: field.id || `step-${stepIndex + 1}-field-${fieldIndex + 1}`,
      label: field.label || field.name || `Field ${fieldIndex + 1}`,
      type: field.type || 'text',
    })),
    blocks: [...(step.blocks ?? [])].sort(
      (left, right) =>
        left.order - right.order || left.id.localeCompare(right.id),
    ),
  }));
}

function fieldKey(stepId: string, fieldId: string): string {
  return `${stepId}.${fieldId}`;
}

function blockKey(stepId: string, blockId: string): string {
  return `${stepId}.__blocks.${blockId}`;
}

function blockOutputValues(
  data: Record<string, Record<string, unknown>>,
  stepId: string,
  blockId: string,
): Record<string, unknown> {
  const blockValues = data[stepId]?.__blocks;
  if (!blockValues || typeof blockValues !== 'object') return {};
  const prefix = `${blockId}.`;
  return Object.fromEntries(
    Object.entries(blockValues as Record<string, unknown>)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value]),
  );
}

function submissionEndpoint(submissionId?: string, files = false): string {
  const base = '/api/eai/workflow-submissions';
  if (!submissionId) return apiUrl(base);
  return apiUrl(
    `${base}/${encodeURIComponent(submissionId)}${files ? '/files' : ''}`,
  );
}

function replaceSubmissionInAddressBar(submissionId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('submission', submissionId);
  // INVARIANT: The resumable URL must not notify Next's router, which remounts the form and repeats runtime authority checks.
  History.prototype.replaceState.call(
    window.history,
    window.history.state,
    '',
    url.toString(),
  );
}

export function GeneratedWorkflowForm({
  appKey,
  binding,
  snapshot,
  branding,
  assistantEnabled = false,
}: GeneratedWorkflowFormProps) {
  const steps = useMemo(() => normalizeSteps(snapshot), [snapshot]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [formData, setFormData] = useState<
    Record<string, Record<string, unknown>>
  >({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('starting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [assistantMessages, setAssistantMessages] = useState<
    WorkflowAssistantMessage[]
  >([]);
  const initialized = useRef(false);
  const formDataRef = useRef(formData);
  const compactViewport = useCompactViewport();

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  const startSubmission = useCallback(async () => {
    const response = await fetch(submissionEndpoint(), {
      method: 'POST',
      signal: AbortSignal.timeout(90_000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device: detectDevice() }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      submissionId?: string;
    };
    if (!response.ok || !payload.submissionId) {
      throw new Error(
        response.status === 429
          ? 'Too many attempts. Please wait and reload.'
          : 'Could not start this form. Please reload and try again.',
      );
    }
    setSubmissionId(payload.submissionId);
    setSubmitState('idle');
    replaceSubmissionInAddressBar(payload.submissionId);
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const resumeId = new URLSearchParams(window.location.search).get(
      'submission',
    );
    const initialize = resumeId
      ? fetch(submissionEndpoint(resumeId), {
          signal: AbortSignal.timeout(90_000),
        }).then(async (response) => {
          if (response.status === 404) return startSubmission();
          if (!response.ok)
            throw new Error(
              'Could not resume this form. Please reload and try again.',
            );
          const payload = (await response.json()) as {
            submission?: {
              status?: string;
              currentStep?: number;
              formData?: Record<string, Record<string, unknown>>;
              userName?: string;
              userEmail?: string;
              assistantMessages?: WorkflowAssistantMessage[];
            };
          };
          if (
            !payload.submission ||
            payload.submission.status !== 'in_progress'
          ) {
            throw new Error(
              'Could not resume this form. Please reload and try again.',
            );
          }
          setSubmissionId(resumeId);
          setFormData(payload.submission.formData ?? {});
          setCurrentStepIndex(
            Math.min(
              Math.max(payload.submission.currentStep ?? 0, 0),
              Math.max(steps.length - 1, 0),
            ),
          );
          setUserName(payload.submission.userName ?? '');
          setUserEmail(payload.submission.userEmail ?? '');
          setAssistantMessages(payload.submission.assistantMessages ?? []);
          setSubmitState('idle');
        })
      : startSubmission();

    void initialize.catch((error) => {
      setSubmitState('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not start this form.',
      );
    });
  }, [startSubmission, steps.length]);

  const currentStep = steps[currentStepIndex];
  const persistAssistantMessages = useCallback(
    async (messages: WorkflowAssistantMessage[]) => {
      if (!submissionId)
        throw new Error('The assistant is unavailable. Please try again.');
      const response = await fetch(submissionEndpoint(submissionId), {
        method: 'PATCH',
        signal: AbortSignal.timeout(90_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantMessages: messages }),
      });
      if (!response.ok)
        throw new Error('The assistant is unavailable. Please try again.');
      setAssistantMessages(messages);
    },
    [submissionId],
  );
  const setFieldValue = useCallback(
    (stepId: string, fieldId: string, value: unknown) => {
      setFormData((current) => ({
        ...current,
        [stepId]: { ...current[stepId], [fieldId]: value },
      }));
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[fieldKey(stepId, fieldId)];
        return next;
      });
    },
    [],
  );

  const setBlockOutputValue = useCallback(
    (stepId: string, blockId: string, outputName: string, value: unknown) => {
      setFormData((current) => {
        const step = current[stepId] ?? {};
        const existing =
          step.__blocks && typeof step.__blocks === 'object'
            ? (step.__blocks as Record<string, unknown>)
            : {};
        return {
          ...current,
          [stepId]: {
            ...step,
            __blocks: {
              ...existing,
              [`${blockId}.${outputName}`]: value,
            },
          },
        };
      });
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[blockKey(stepId, blockId)];
        return next;
      });
    },
    [],
  );

  const stepErrors = useCallback(
    (step: GeneratedWorkflowStep): Record<string, string> => {
      const errors: Record<string, string> = {};
      for (const field of step.fields ?? []) {
        if (field.type === 'smart_block') continue;
        const stepId = step.id ?? '';
        const fieldId = field.id ?? '';
        const value = formData[stepId]?.[fieldId];
        const error = validateFieldValue(field, value, true);
        if (error) errors[fieldKey(stepId, fieldId)] = error;
      }
      for (const block of step.blocks ?? []) {
        const stepId = step.id ?? '';
        const key = blockKey(stepId, block.id);
        if (!isSupportedGeneratedWorkflowBlock(block.blockId)) {
          errors[key] = `Unsupported workflow block: ${block.blockId}`;
          continue;
        }
        const values = blockOutputValues(formData, stepId, block.id);
        const missingRequiredOutput = (block.outputs ?? []).some((output) => {
          if (!output.required) return false;
          if (
            output.valueType === 'file' ||
            output.valueType === 'object' ||
            output.valueType === 'unknown' ||
            output.collection
          ) {
            return true;
          }
          const value = values[output.name];
          return value === undefined || value === null || value === '';
        });
        if (missingRequiredOutput) {
          errors[key] = 'Complete the required guided activity outputs.';
        }
      }
      return errors;
    },
    [formData],
  );

  const validateStep = (step: GeneratedWorkflowStep): boolean => {
    const errors = stepErrors(step);
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveProgress = useCallback(
    async (nextStep: number, data = formDataRef.current) => {
      if (!submissionId) return;
      await fetch(submissionEndpoint(submissionId), {
        method: 'PATCH',
        signal: AbortSignal.timeout(90_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStep: nextStep,
          formData: data,
          ...(userName ? { userName } : {}),
          ...(userEmail ? { userEmail } : {}),
        }),
      }).catch(() => undefined);
    },
    [submissionId, userEmail, userName],
  );

  const uploadFile = useCallback(
    async (stepId: string, fieldId: string, file: File | null) => {
      if (!file) {
        setFieldValue(stepId, fieldId, '');
        return;
      }
      const key = fieldKey(stepId, fieldId);
      setFieldValue(stepId, fieldId, '');
      const validationError = validateSubmissionFile(file);
      if (validationError) {
        setFieldErrors((current) => ({
          ...current,
          [key]: validationError,
        }));
        return;
      }
      if (!submissionId) {
        setFieldErrors((current) => ({
          ...current,
          [key]: 'This form is still starting. Please try again.',
        }));
        return;
      }
      setUploadingField(key);
      try {
        const body = new FormData();
        body.set('file', file);
        body.set('stepId', stepId);
        body.set('fieldId', fieldId);
        const response = await fetch(submissionEndpoint(submissionId, true), {
          method: 'POST',
          signal: AbortSignal.timeout(90_000),
          body,
        });
        const payload = (await response.json().catch(() => ({}))) as {
          file?: unknown;
          message?: string;
        };
        if (
          !response.ok ||
          !isSubmissionFileRef(payload.file) ||
          payload.file.stepId !== stepId ||
          payload.file.fieldId !== fieldId
        ) {
          throw new Error(payload.message || 'File upload failed.');
        }
        setFieldValue(stepId, fieldId, payload.file);
        const merged = {
          ...formDataRef.current,
          [stepId]: { ...formDataRef.current[stepId], [fieldId]: payload.file },
        };
        await saveProgress(currentStepIndex, merged);
      } catch (error) {
        setFieldErrors((current) => ({
          ...current,
          [key]: error instanceof Error ? error.message : 'File upload failed.',
        }));
      } finally {
        setUploadingField(null);
      }
    },
    [currentStepIndex, saveProgress, setFieldValue, submissionId],
  );

  const submit = useCallback(async () => {
    if (!currentStep || !submissionId) return;
    const errorsByStep = steps.map(stepErrors);
    const firstInvalid = errorsByStep.findIndex(
      (errors) => Object.keys(errors).length > 0,
    );
    if (firstInvalid >= 0) {
      setFieldErrors(Object.assign({}, ...errorsByStep));
      setCurrentStepIndex(firstInvalid);
      return;
    }
    setSubmitState('submitting');
    setErrorMessage(null);
    try {
      const response = await fetch(submissionEndpoint(submissionId), {
        method: 'PATCH',
        signal: AbortSignal.timeout(90_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          currentStep: currentStepIndex,
          formData,
          ...(userName ? { userName } : {}),
          ...(userEmail ? { userEmail } : {}),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(payload.message || 'Submission failed.');
      }
      setSubmitState('submitted');
    } catch (error) {
      setSubmitState('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Submission failed.',
      );
    }
  }, [
    currentStep,
    currentStepIndex,
    formData,
    submissionId,
    userEmail,
    userName,
    stepErrors,
    steps,
  ]);

  if (steps.length === 0) {
    return <p className='p-8 text-center'>This workflow has no steps.</p>;
  }
  if (submitState === 'submitted') {
    return (
      <main className='flex min-h-svh items-center justify-center px-6 py-12 text-center'>
        <div className='max-w-xl'>
          <div className='mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700'>
            ✓
          </div>
          <h1 className='text-2xl font-semibold text-slate-950'>Submitted</h1>
          <p className='mt-2 text-slate-600'>
            Thank you. Your response has been received.
          </p>
        </div>
      </main>
    );
  }

  const isLastStep = currentStepIndex === steps.length - 1;
  const currentStepHasUnsupportedBlocks =
    currentStep?.blocks?.some(
      (block) => !isSupportedGeneratedWorkflowBlock(block.blockId),
    ) ?? false;
  const primaryColor = branding?.primaryColor ?? '#1d4ed8';
  const secondaryColor = branding?.secondaryColor ?? '#f8fafc';
  const brandName = branding?.displayName ?? appKey.replace(/-/g, ' ');
  const themeStyle = {
    '--primary': primaryColor,
    '--primary-foreground': readableTextColor(primaryColor),
    '--secondary': secondaryColor,
    '--secondary-foreground': readableTextColor(secondaryColor),
  } as CSSProperties;
  return (
    <main className='bg-muted/30 flex h-svh min-h-0 flex-col p-4'>
      <section
        aria-label='Published workflow'
        className='bg-background @container/workflow mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border shadow-sm'
        style={themeStyle}
      >
        <header
          aria-label={`${brandName} branding`}
          className='flex shrink-0 items-center gap-3 px-5 py-4'
          style={{
            background: secondaryColor,
            color: readableTextColor(secondaryColor),
          }}
        >
          {branding?.logoDataUrl ? (
            <Image
              alt={`${brandName} logo`}
              className='size-9 object-contain'
              height={36}
              src={branding.logoDataUrl}
              unoptimized
              width={36}
            />
          ) : (
            <span className='flex size-9 items-center justify-center rounded-lg border text-sm font-bold'>
              {brandName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className='truncate font-semibold'>{brandName}</span>
        </header>

        <div className='relative flex min-h-0 flex-1 flex-row'>
          <div className='flex min-h-0 min-w-0 flex-1 flex-col'>
            <div className='min-h-0 flex-1 overflow-y-auto px-5 py-5'>
              <h1 className='text-xl font-semibold tracking-tight'>
                {binding.workflowTemplate.title}
              </h1>
              <nav
                aria-label='Workflow steps'
                className='mt-4 grid gap-2'
                style={{
                  gridTemplateColumns: `repeat(${Math.min(steps.length, 4)}, minmax(0, 1fr))`,
                }}
              >
                {steps.map((step, index) => {
                  const active = index === currentStepIndex;
                  const selectable = index <= currentStepIndex;
                  return (
                    <button
                      key={step.id ?? index}
                      type='button'
                      aria-current={active ? 'step' : undefined}
                      disabled={!selectable}
                      onClick={() => {
                        if (!selectable) return;
                        setFieldErrors({});
                        setCurrentStepIndex(index);
                      }}
                      className={`flex min-w-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      } ${selectable && !active ? 'hover:text-foreground' : 'cursor-default'}`}
                    >
                      <span
                        className={`flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                          active
                            ? 'border-primary-foreground bg-primary-foreground text-primary'
                            : 'border-current'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className='truncate'>{step.title}</span>
                    </button>
                  );
                })}
              </nav>

              <div className='mt-5'>
                <h2 className='text-base font-semibold'>
                  {currentStep?.title}
                </h2>
                {currentStep?.description ? (
                  <p className='text-muted-foreground mt-1 text-sm'>
                    {currentStep.description}
                  </p>
                ) : null}
              </div>

              <div className='mt-5 space-y-4'>
                {currentStep?.fields?.map((field) => {
                  const stepId = currentStep.id ?? '';
                  const fieldId = field.id ?? '';
                  const key = fieldKey(stepId, fieldId);
                  if (field.type === 'smart_block') {
                    return (
                      <div
                        key={key}
                        className='bg-muted rounded-md border p-4 text-sm'
                      >
                        {field.label || 'Guided workflow activity'}
                      </div>
                    );
                  }
                  return (
                    <label
                      key={key}
                      htmlFor={key}
                      className='block text-sm font-medium'
                    >
                      {field.label}
                      {field.required ? (
                        <span className='text-destructive ml-1'>*</span>
                      ) : null}
                      {field.helpText ? (
                        <span className='text-muted-foreground mt-1 block text-xs font-normal'>
                          {field.helpText}
                        </span>
                      ) : null}
                      <GeneratedWorkflowFieldInput
                        id={key}
                        disabled={
                          submitState === 'submitting' ||
                          uploadingField === key ||
                          (submitState === 'starting' && field.type === 'file')
                        }
                        field={field}
                        value={formData[stepId]?.[fieldId]}
                        onChange={(value) =>
                          setFieldValue(stepId, fieldId, value)
                        }
                        onFileSelect={(file) =>
                          void uploadFile(stepId, fieldId, file)
                        }
                      />
                      {uploadingField === key ? (
                        <span className='text-muted-foreground mt-1 block text-xs'>
                          Uploading…
                        </span>
                      ) : null}
                      {fieldErrors[key] ? (
                        <span className='text-destructive mt-1 block text-xs'>
                          {fieldErrors[key]}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
                {currentStep?.blocks?.map((block) => {
                  const stepId = currentStep.id ?? '';
                  const key = blockKey(stepId, block.id);
                  return (
                    <div key={key}>
                      <GeneratedWorkflowSmartBlock
                        block={block}
                        disabled={submitState === 'submitting'}
                        formData={formData}
                        stepId={stepId}
                        values={blockOutputValues(formData, stepId, block.id)}
                        onOutputChange={(outputName, value) =>
                          setBlockOutputValue(
                            stepId,
                            block.id,
                            outputName,
                            value,
                          )
                        }
                      />
                      {fieldErrors[key] ? (
                        <span className='text-destructive mt-1 block text-xs'>
                          {fieldErrors[key]}
                        </span>
                      ) : null}
                    </div>
                  );
                })}

                {isLastStep ? (
                  <div className='@container/contact grid gap-5 border-t pt-7 @xl/contact:grid-cols-2'>
                    <label className='text-sm font-medium'>
                      Name
                      <input
                        className='bg-background mt-2 w-full rounded-md border px-3 py-2'
                        value={userName}
                        maxLength={200}
                        onChange={(event) => setUserName(event.target.value)}
                      />
                    </label>
                    <label className='text-sm font-medium'>
                      Email
                      <input
                        type='email'
                        className='bg-background mt-2 w-full rounded-md border px-3 py-2'
                        value={userEmail}
                        maxLength={200}
                        onChange={(event) => setUserEmail(event.target.value)}
                      />
                    </label>
                  </div>
                ) : null}

                {errorMessage ? (
                  <div
                    role='alert'
                    className='border-destructive/40 bg-destructive/5 rounded-md border px-4 py-3'
                  >
                    <p className='text-destructive text-sm'>{errorMessage}</p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className='bg-background flex h-16 shrink-0 items-center justify-between gap-3 border-t px-5'>
              <button
                type='button'
                className='hover:bg-muted rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-40'
                disabled={
                  currentStepIndex === 0 || submitState === 'submitting'
                }
                onClick={() => {
                  setFieldErrors({});
                  setCurrentStepIndex((current) => Math.max(0, current - 1));
                }}
              >
                Back
              </button>
              <button
                type='button'
                className='bg-primary text-primary-foreground rounded-md px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50'
                disabled={
                  submitState === 'starting' ||
                  submitState === 'submitting' ||
                  Boolean(uploadingField) ||
                  currentStepHasUnsupportedBlocks ||
                  Boolean(
                    currentStep?.fields?.some(
                      (field) =>
                        field.type === 'file' &&
                        field.required &&
                        !isSubmissionFileRef(
                          formData[currentStep.id ?? '']?.[field.id ?? ''],
                        ),
                    ),
                  )
                }
                onClick={() => {
                  if (!currentStep || !validateStep(currentStep)) return;
                  if (isLastStep) {
                    void submit();
                    return;
                  }
                  const next = currentStepIndex + 1;
                  setCurrentStepIndex(next);
                  void saveProgress(next);
                }}
              >
                {submitState === 'starting'
                  ? 'Starting…'
                  : submitState === 'submitting'
                    ? 'Submitting…'
                    : isLastStep
                      ? 'Submit'
                      : 'Continue'}
              </button>
            </div>
          </div>

          {assistantEnabled ? (
            <WorkflowAssistant
              variant={compactViewport ? 'bubble' : 'rail'}
              stepId={currentStep?.id ?? ''}
              stepTitle={currentStep?.title ?? 'this step'}
              initialMessages={assistantMessages}
              onMessagesChange={persistAssistantMessages}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
