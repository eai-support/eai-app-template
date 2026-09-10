import { isSubmissionFileRef } from '@/lib/generated-workflow/submission-files';
import {
  FIELD_FORMATS,
  type FieldValidation,
  isValidFieldFormat,
  resolveFieldValidation,
  type ValidatedWorkflowField,
} from '@/lib/generated-workflow/field-format';

export {
  FIELD_FORMATS,
  type FieldFormat,
  type FieldValidation,
  fieldInputAttrs,
  inferFieldFormat,
  isValidFieldFormat,
  resolveFieldValidation,
  type ValidatedWorkflowField,
} from '@/lib/generated-workflow/field-format';

export type WorkflowFieldErrorCode =
  | 'invalid_configuration'
  | 'invalid_date'
  | 'invalid_file'
  | 'invalid_format'
  | 'invalid_option'
  | 'invalid_type'
  | 'required'
  | 'unknown_field'
  | 'unknown_step';

export interface WorkflowFieldValidationError {
  code: WorkflowFieldErrorCode;
  message: string;
}

export interface WorkflowFormFieldError extends WorkflowFieldValidationError {
  fieldId: string;
  stepId: string;
}

const RUNTIME_FIELD_TYPES = new Set([
  'boolean',
  'checkbox',
  'date',
  'file',
  'select',
  'text',
  'textarea',
]);

export function validateFieldValue(
  field: ValidatedWorkflowField,
  value: unknown,
  enabled: boolean,
): string | null {
  return validateWorkflowFieldValue(field, value, enabled)?.message ?? null;
}

export function validateWorkflowFieldValue(
  field: ValidatedWorkflowField,
  value: unknown,
  enabled: boolean,
): WorkflowFieldValidationError | null {
  const configurationError = validateFieldConfiguration(field, enabled);
  if (configurationError) return configurationError;

  const empty =
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim().length === 0);
  if (empty) {
    return field.required
      ? validationError('required', 'This field is required.')
      : null;
  }

  switch (field.type) {
    case 'boolean':
    case 'checkbox':
      if (typeof value !== 'boolean') {
        return validationError(
          'invalid_type',
          'Enter a valid yes or no value.',
        );
      }
      return null;
    case 'date':
      if (typeof value !== 'string') {
        return validationError('invalid_type', 'Enter a valid date.');
      }
      if (!isCalendarDate(value)) {
        return validationError('invalid_date', 'Enter a valid date.');
      }
      return null;
    case 'file':
      return isValidSubmissionFileValue(value)
        ? null
        : validationError('invalid_file', 'Upload a valid file.');
    case 'select':
      if (typeof value !== 'string') {
        return validationError('invalid_type', 'Select a valid option.');
      }
      return field.options?.includes(value)
        ? null
        : validationError('invalid_option', 'Select a valid option.');
    case 'text':
    case 'textarea':
      if (typeof value !== 'string') {
        return validationError('invalid_type', 'Enter a valid text value.');
      }
      break;
    default:
      return validationError(
        'invalid_configuration',
        'This field has invalid validation configuration.',
      );
  }

  const validation = resolveFieldValidation(field, enabled);
  if (!validation) return null;

  const normalizedValue = value.trim();

  if (isValidFieldFormat(validation.format)) {
    const format = FIELD_FORMATS[validation.format];
    if (!format.test(normalizedValue)) {
      return validationError(
        'invalid_format',
        validation.message ?? format.message,
      );
    }

    if (validation.format === 'number' || validation.format === 'currency') {
      const numericValue = Number(normalizedValue);
      if (typeof validation.min === 'number' && numericValue < validation.min) {
        return validationError(
          'invalid_format',
          validation.message ?? `Must be at least ${validation.min}`,
        );
      }
      if (typeof validation.max === 'number' && numericValue > validation.max) {
        return validationError(
          'invalid_format',
          validation.message ?? `Must be at most ${validation.max}`,
        );
      }
    }
  }

  if (
    typeof validation.minLength === 'number' &&
    normalizedValue.length < validation.minLength
  ) {
    return validationError(
      'invalid_format',
      validation.message ??
        `Must be at least ${validation.minLength} characters`,
    );
  }
  if (
    typeof validation.maxLength === 'number' &&
    normalizedValue.length > validation.maxLength
  ) {
    return validationError(
      'invalid_format',
      validation.message ??
        `Must be at most ${validation.maxLength} characters`,
    );
  }

  if (validation.pattern) {
    if (!new RegExp(validation.pattern).test(normalizedValue)) {
      return validationError(
        'invalid_format',
        validation.message ?? 'Invalid format',
      );
    }
  }

  return null;
}

function validateFieldConfiguration(
  field: ValidatedWorkflowField,
  enabled: boolean,
): WorkflowFieldValidationError | null {
  if (typeof field.type !== 'string' || !RUNTIME_FIELD_TYPES.has(field.type)) {
    return validationError(
      'invalid_configuration',
      'This field has invalid validation configuration.',
    );
  }
  if (
    field.type === 'select' &&
    (!Array.isArray(field.options) ||
      field.options.length === 0 ||
      field.options.some(
        (option) => typeof option !== 'string' || option.trim().length === 0,
      ))
  ) {
    return validationError(
      'invalid_configuration',
      'This field has invalid validation configuration.',
    );
  }
  if (!enabled || !field.validation) return null;

  const validation = field.validation as FieldValidation &
    Record<string, unknown>;
  if (
    validation.format !== undefined &&
    validation.format !== 'none' &&
    !isValidFieldFormat(validation.format)
  ) {
    return invalidConfiguration();
  }
  for (const key of ['min', 'max', 'minLength', 'maxLength'] as const) {
    if (
      validation[key] !== undefined &&
      (typeof validation[key] !== 'number' || !Number.isFinite(validation[key]))
    ) {
      return invalidConfiguration();
    }
  }
  if (
    (validation.minLength !== undefined &&
      (!Number.isInteger(validation.minLength) || validation.minLength < 0)) ||
    (validation.maxLength !== undefined &&
      (!Number.isInteger(validation.maxLength) || validation.maxLength < 0)) ||
    (validation.min !== undefined &&
      validation.max !== undefined &&
      validation.min > validation.max) ||
    (validation.minLength !== undefined &&
      validation.maxLength !== undefined &&
      validation.minLength > validation.maxLength)
  ) {
    return invalidConfiguration();
  }
  if (validation.pattern !== undefined) {
    if (typeof validation.pattern !== 'string') return invalidConfiguration();
    try {
      if (
        !/^\^\[[A-Za-z0-9 .@_+\\-]+\](?:[+*?]|\{\d{1,3}(?:,\d{1,3})?\})\$$/.test(
          validation.pattern,
        )
      )
        return invalidConfiguration();
      new RegExp(validation.pattern);
    } catch {
      return invalidConfiguration();
    }
  }
  return null;
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidSubmissionFileValue(value: unknown): boolean {
  if (!isSubmissionFileRef(value)) return false;
  return (
    Number.isFinite(value.fileSize) &&
    value.fileSize > 0 &&
    value.contentType.trim().length > 0 &&
    value.stepId.trim().length > 0 &&
    value.fieldId.trim().length > 0 &&
    Number.isFinite(Date.parse(value.uploadedAt))
  );
}

function invalidConfiguration(): WorkflowFieldValidationError {
  return validationError(
    'invalid_configuration',
    'This field has invalid validation configuration.',
  );
}

function validationError(
  code: WorkflowFieldErrorCode,
  message: string,
): WorkflowFieldValidationError {
  return { code, message };
}
