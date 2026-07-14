'use client';

import { type ComponentType, useMemo, useRef, useState } from 'react';
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  WorkflowShell,
  useConfig,
  useEAIConfig,
} from '@enterpriseaigroup/core';

import { useResources } from '@/hooks/useResources';
import {
  GENERATED_WORKFLOW_FIELDS_COMPONENT,
  buildSubmissionData,
  buildWorkflowDefinition,
  fieldName,
  isStepComplete,
  selectOption,
  submissionObjectTypeFor,
  withOwnerProjectionRetry,
  type GeneratedWorkflowField,
  type GeneratedWorkflowState,
  type GeneratedWorkflowValues,
} from '@/lib/generated-workflow';

interface GeneratedWorkflowFieldsProps {
  title?: string;
  description?: string;
  fields?: GeneratedWorkflowField[];
  isLastStep?: boolean;
  values?: GeneratedWorkflowValues;
  onChange?: (name: string, value: unknown) => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  submitError?: string | null;
  submitted?: boolean;
}

function GeneratedWorkflowFields({
  title,
  description,
  fields = [],
  isLastStep = false,
  values = {},
  onChange = () => undefined,
  onSubmit = () => undefined,
  isSubmitting = false,
  submitError,
  submitted = false,
}: GeneratedWorkflowFieldsProps) {
  return (
    <section className='space-y-6'>
      <header className='space-y-1'>
        <h1 className='text-foreground text-2xl font-semibold'>{title}</h1>
        {description ? (
          <p className='text-muted-foreground text-sm'>{description}</p>
        ) : null}
      </header>

      <div className='space-y-5'>
        {fields.map((field, index) => {
          const name = fieldName(field, index);
          const id = `generated-field-${name}`;
          const value = values[name];
          const label = field.label || field.name || `Field ${index + 1}`;

          if (field.type === 'select') {
            return (
              <div key={name} className='space-y-2'>
                <Label htmlFor={id}>{label}</Label>
                <Select
                  value={typeof value === 'string' ? value : ''}
                  onValueChange={(next) => onChange(name, next)}
                >
                  <SelectTrigger id={id} className='w-full'>
                    <SelectValue
                      placeholder={`Select ${label.toLowerCase()}`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(field.options ?? []).map(selectOption).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {field.helpText ? (
                  <p className='text-muted-foreground text-xs'>
                    {field.helpText}
                  </p>
                ) : null}
              </div>
            );
          }

          if (field.type === 'smart_block') {
            return (
              <div key={name} className='border-border space-y-1 border-l-2 pl-4'>
                <p className='text-sm font-medium'>{label}</p>
                <p className='text-muted-foreground text-sm'>
                  {field.helpText || 'This step is completed automatically.'}
                </p>
              </div>
            );
          }

          if (field.type === 'textarea') {
            return (
              <div key={name} className='space-y-2'>
                <Label htmlFor={id}>{label}</Label>
                <Textarea
                  id={id}
                  required={field.required}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(event) => onChange(name, event.target.value)}
                />
                {field.helpText ? (
                  <p className='text-muted-foreground text-xs'>
                    {field.helpText}
                  </p>
                ) : null}
              </div>
            );
          }

          if (field.type === 'boolean' || field.type === 'checkbox') {
            return (
              <div key={name} className='flex items-start gap-3'>
                <Checkbox
                  id={id}
                  checked={value === true}
                  onCheckedChange={(checked) =>
                    onChange(name, checked === true)
                  }
                />
                <div className='space-y-1'>
                  <Label htmlFor={id}>{label}</Label>
                  {field.helpText ? (
                    <p className='text-muted-foreground text-xs'>
                      {field.helpText}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          }

          return (
            <div key={name} className='space-y-2'>
              <Label htmlFor={id}>{label}</Label>
              <Input
                id={id}
                type={
                  field.type === 'date' || field.type === 'file'
                    ? field.type
                    : 'text'
                }
                required={field.required}
                value={
                  field.type === 'file'
                    ? undefined
                    : typeof value === 'string'
                      ? value
                      : ''
                }
                onChange={(event) =>
                  onChange(
                    name,
                    field.type === 'file'
                      ? event.target.files?.[0]
                      : event.target.value,
                  )
                }
              />
              {field.helpText ? (
                <p className='text-muted-foreground text-xs'>
                  {field.helpText}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {isLastStep ? (
        <div className='border-border space-y-3 border-t pt-5'>
          <Button
            type='button'
            onClick={onSubmit}
            disabled={isSubmitting || submitted}
          >
            {submitted
              ? 'Submitted'
              : isSubmitting
                ? 'Submitting...'
                : 'Submit'}
          </Button>
          {submitError ? (
            <p role='alert' className='text-destructive text-sm'>
              {submitError}
            </p>
          ) : null}
          {submitted ? (
            <p role='status' className='text-muted-foreground text-sm'>
              Your response has been submitted.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function GeneratedWorkflowPage({
  workflow,
}: {
  workflow: GeneratedWorkflowState;
}) {
  const { registry } = useEAIConfig();
  const config = useConfig();
  const definition = useMemo(
    () => buildWorkflowDefinition(workflow),
    [workflow],
  );
  const [activeStepId, setActiveStepId] = useState(workflow.steps[0]?.id ?? '');
  const [values, setValues] = useState<GeneratedWorkflowValues>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const draftId = useRef<string | null>(null);
  const submissionObjectType = submissionObjectTypeFor(workflow);
  const resources = useResources<Record<string, unknown>>(
    submissionObjectType,
    config.tenantId,
  );
  const activeStep =
    workflow.steps.find((step) => step.id === activeStepId) ??
    workflow.steps[0];
  const activeStepIndex = workflow.steps.findIndex(
    (step) => step.id === activeStep?.id,
  );

  registry.set(
    GENERATED_WORKFLOW_FIELDS_COMPONENT,
    GeneratedWorkflowFields as ComponentType<unknown>,
  );

  const onChange = (name: string, value: unknown) => {
    setValues((current) => ({ ...current, [name]: value }));
  };

  const onSubmit = async () => {
    if (!workflow.steps.every((step) => isStepComplete(step, values))) {
      setSubmitError('Complete all required fields before submitting.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (!draftId.current) {
        const created = await resources.create(
          buildSubmissionData(workflow, values),
        );
        draftId.current = created.id;
      } else {
        const existing = await resources.get(draftId.current);
        await resources.update(
          draftId.current,
          buildSubmissionData(workflow, values),
          existing.version,
        );
      }
      for (const step of workflow.steps) {
        for (const [index, field] of (step.fields ?? []).entries()) {
          const name = fieldName(field, index);
          const value = values[name];
          if (field.type === 'file' && value instanceof File) {
            await withOwnerProjectionRetry(() =>
              resources.uploadFile(draftId.current!, name, value, {
                filename: value.name,
                contentType: value.type || undefined,
              }),
            );
          }
        }
      }
      await withOwnerProjectionRetry(() =>
        resources.executeAction(draftId.current!, 'submit'),
      );
      setSubmitted(true);
    } catch {
      if (draftId.current) {
        try {
          const existing = await resources.get(draftId.current);
          if (existing.data?.status === 'submitted') {
            setSubmitted(true);
            return;
          }
        } catch {
          // Keep the original generic error and retry the same draft next time.
        }
      }
      setSubmitError('Submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeStep) return null;

  return (
    <main className='bg-background flex min-h-screen flex-col'>
      <WorkflowShell
        workflow={definition}
        activeStageCode='generated-workflow'
        activeStepCode={activeStep.id}
        onStepChange={(_stageCode, stepCode) => setActiveStepId(stepCode)}
        nextDisabled={!isStepComplete(activeStep, values)}
        nextDisabledMessage='Complete the required fields to continue.'
        nextHidden={activeStepIndex === workflow.steps.length - 1}
        componentOverrides={{
          [GENERATED_WORKFLOW_FIELDS_COMPONENT]: {
            values,
            onChange,
            onSubmit,
            isSubmitting,
            submitError,
            submitted,
          },
        }}
      />
    </main>
  );
}
