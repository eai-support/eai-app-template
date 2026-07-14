import type { WorkflowConfig } from '@enterpriseaigroup/core';

export interface GeneratedWorkflowField {
  id?: string;
  name?: string;
  label?: string;
  type?: string;
  required?: boolean;
  helpText?: string;
  options?: string[];
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
  return (step.fields ?? []).every((field, index) => {
    if (!field.required) return true;
    return !isEmptyFieldValue(field, values[fieldName(field, index)]);
  });
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
                  fields: step.fields ?? [],
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
    (step.fields ?? []).forEach((field, index) =>
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
    (step.fields ?? []).forEach((field, index) => {
      const name = fieldName(field, index);
      const value = resourceFieldValue(field, values[name]);
      if (
        value !== undefined &&
        !(typeof File !== 'undefined' && value instanceof File)
      ) {
        data[name] = value;
      }
    });
  });

  return data;
}
