import type { GeneratedWorkflowField as SharedWorkflowField } from './runtime-contract';

export type FieldFormat = 'email' | 'phone' | 'url' | 'number' | 'currency';

export interface FieldValidation {
  format?: FieldFormat | 'none';
  pattern?: string;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  message?: string;
  recommended?: boolean;
}

export type ValidatedWorkflowField = SharedWorkflowField & {
  validation?: FieldValidation;
  options?: string[];
};

interface FormatSpec {
  inputType: 'text' | 'email' | 'tel' | 'url' | 'number';
  inputMode?: 'text' | 'email' | 'tel' | 'url' | 'numeric' | 'decimal';
  placeholder?: string;
  message: string;
  test: (value: string) => boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i;
const NUMBER_RE = /^-?\d+(\.\d+)?$/;
const CURRENCY_RE = /^\d+(\.\d{1,2})?$/;

function isPhone(value: string): boolean {
  if (!/^[+]?[\d\s().-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export const FIELD_FORMATS: Record<FieldFormat, FormatSpec> = {
  email: {
    inputMode: 'email',
    inputType: 'email',
    message: 'Enter a valid email address',
    placeholder: 'name@example.com',
    test: (value) => EMAIL_RE.test(value),
  },
  phone: {
    inputMode: 'tel',
    inputType: 'tel',
    message: 'Enter a valid phone number',
    placeholder: '+1 555 123 4567',
    test: isPhone,
  },
  url: {
    inputMode: 'url',
    inputType: 'url',
    message: 'Enter a valid URL',
    placeholder: 'https://example.com',
    test: (value) => URL_RE.test(value),
  },
  number: {
    inputMode: 'numeric',
    inputType: 'number',
    message: 'Enter a number',
    test: (value) => NUMBER_RE.test(value),
  },
  currency: {
    inputMode: 'decimal',
    inputType: 'number',
    message: 'Enter an amount, e.g. 49.99',
    placeholder: '0.00',
    test: (value) => CURRENCY_RE.test(value),
  },
};

const VALID_FORMATS = new Set<string>(Object.keys(FIELD_FORMATS));

export function isValidFieldFormat(value: unknown): value is FieldFormat {
  return typeof value === 'string' && VALID_FORMATS.has(value);
}

const INFERENCE_RULES: ReadonlyArray<{
  format: FieldFormat;
  pattern: RegExp;
}> = [
  { format: 'email', pattern: /\be-?mail\b/i },
  { format: 'phone', pattern: /\b(phone|mobile|telephone|cell|fax)\b/i },
  {
    format: 'url',
    pattern: /\b(url|website|web ?site|homepage|web address|linkedin)\b/i,
  },
];

export function inferFieldFormat(
  field: SharedWorkflowField,
): FieldFormat | null {
  if (field.type !== 'text') return null;
  const content = `${field.label ?? ''} ${field.helpText ?? ''}`;
  return (
    INFERENCE_RULES.find(({ pattern }) => pattern.test(content))?.format ?? null
  );
}

export function resolveFieldValidation(
  field: ValidatedWorkflowField,
  enabled: boolean,
): FieldValidation | null {
  if (!enabled || field.validation?.format === 'none') return null;

  if (
    isValidFieldFormat(field.validation?.format) ||
    field.validation?.pattern
  ) {
    return field.validation;
  }

  const inferred = inferFieldFormat(field);
  if (inferred) {
    return { ...field.validation, format: inferred, recommended: true };
  }
  return field.validation ?? null;
}

export function fieldInputAttrs(
  field: ValidatedWorkflowField,
  enabled: boolean,
): { inputMode?: string; placeholder?: string; type: string } {
  const validation = resolveFieldValidation(field, enabled);
  if (isValidFieldFormat(validation?.format)) {
    const format = FIELD_FORMATS[validation.format];
    return {
      inputMode: format.inputMode,
      placeholder: format.placeholder,
      type: format.inputType,
    };
  }
  return { type: 'text' };
}
