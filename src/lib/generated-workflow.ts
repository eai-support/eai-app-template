import type { WorkflowConfig } from '@enterpriseaigroup/core';
import { PlatformError } from '@enterpriseaigroup/platform-sdk';

export interface GeneratedWorkflowField {
  id?: string;
  name?: string;
  label?: string;
  type?: string;
  required?: boolean;
  helpText?: string;
  options?: string[];
  replaces?: string[];
}

export interface GeneratedWorkflowStep {
  id: string;
  title: string;
  description?: string;
  fields?: GeneratedWorkflowField[];
}

export interface GeneratedWorkflowState {
  appKey: string;
  displayName: string;
  prompt?: string;
  submissionObjectType?: string;
  steps: GeneratedWorkflowStep[];
}

export type GeneratedWorkflowValues = Record<string, unknown>;

export const GENERATED_WORKFLOW_FIELDS_COMPONENT = 'GeneratedWorkflowFields';

const OWNER_PROJECTION_RETRY_DELAYS_MS = [100, 250, 500, 1000, 2000];

export async function withOwnerProjectionRetry<T>(
  operation: () => Promise<T>,
  sleep: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
): Promise<T> {
  for (const delay of OWNER_PROJECTION_RETRY_DELAYS_MS) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof PlatformError) || !error.isForbidden) throw error;
      await sleep(delay);
    }
  }
  return operation();
}

export function fieldName(
  field: GeneratedWorkflowField,
  index: number,
): string {
  return field.name || field.id || `field${index + 1}`;
}

export function isEmptyFieldValue(
  field: GeneratedWorkflowField,
  value: unknown,
): boolean {
  if (field.type === 'boolean' || field.type === 'checkbox') {
    return value === undefined || value === null;
  }
  return value === undefined || value === null || value === '';
}

export function isStepComplete(
  step: GeneratedWorkflowStep,
  values: GeneratedWorkflowValues,
): boolean {
  return fillableFields(step.fields ?? []).every((field, index) => {
    if (field.type === 'smart_block' || !field.required) return true;
    return !isEmptyFieldValue(field, values[fieldName(field, index)]);
  });
}

export function fillableFields(
  fields: GeneratedWorkflowField[],
): GeneratedWorkflowField[] {
  const replaced = new Set(
    fields
      .filter((field) => field.type === 'smart_block')
      .flatMap((field) => field.replaces ?? []),
  );
  return fields.filter(
    (field) =>
      field.type === 'smart_block' ||
      !field.id ||
      !replaced.has(field.id),
  );
}

export function buildWorkflowDefinition(
  workflow: GeneratedWorkflowState,
): WorkflowConfig {
  return {
    slug: workflow.appKey,
    label: workflow.displayName,
    stages: [
      {
        code: 'generated-workflow',
        label: workflow.displayName,
        steps: workflow.steps.map((step, stepIndex) => ({
          code: step.id,
          label: step.title,
          page: {
            path: `/${step.id}`,
            components: [
              {
                component: GENERATED_WORKFLOW_FIELDS_COMPONENT,
                props: {
                  stepId: step.id,
                  title: step.title,
                  description: step.description,
                  fields: fillableFields(step.fields ?? []),
                  isLastStep: stepIndex === workflow.steps.length - 1,
                },
              },
            ],
          },
        })),
      },
    ],
  };
}

function serializableValue(value: unknown): unknown {
  if (typeof File !== 'undefined' && value instanceof File) {
    return { name: value.name, size: value.size, type: value.type };
  }
  return value;
}

function slugifyOption(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function selectOption(option: string) {
  return { label: option, value: slugifyOption(option) || option };
}

function resourceFieldValue(
  field: GeneratedWorkflowField | undefined,
  value: unknown,
): unknown {
  if (field?.type === 'smart_block') return undefined;
  if (field?.type === 'select' && typeof value === 'string') {
    const option = field.options
      ?.map(selectOption)
      .find((candidate) => candidate.value === value || candidate.label === value);
    return option?.value ?? (slugifyOption(value) || value);
  }
  return serializableValue(value);
}

export function submissionObjectTypeFor(
  workflow: GeneratedWorkflowState,
): string {
  if (workflow.submissionObjectType) return workflow.submissionObjectType;
  const name = workflow.appKey
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
  return `${name || 'GeneratedApp'}Submission`;
}

export function buildSubmissionData(
  workflow: GeneratedWorkflowState,
  values: GeneratedWorkflowValues,
): Record<string, unknown> {
  const fieldsByName = new Map<string, GeneratedWorkflowField>();
  workflow.steps.forEach((step) =>
    fillableFields(step.fields ?? []).forEach((field, index) =>
      fieldsByName.set(fieldName(field, index), field),
    ),
  );
  const payload = Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [
        key,
        resourceFieldValue(fieldsByName.get(key), value),
      ])
      .filter((entry) => entry[1] !== undefined),
  );
  const data: Record<string, unknown> = {
    status: 'draft',
    currentStep: workflow.steps.at(-1)?.id ?? null,
    payload,
  };

  workflow.steps.forEach((step) => {
    fillableFields(step.fields ?? []).forEach((field, index) => {
      const name = fieldName(field, index);
      const rawValue = values[name];
      const value = resourceFieldValue(field, rawValue);
      if (
        value !== undefined &&
        !(typeof File !== 'undefined' && rawValue instanceof File)
      ) {
        data[name] = value;
      }
    });
  });

  return data;
}
