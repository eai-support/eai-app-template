'use client';

import type { GeneratedWorkflowField } from '@/lib/generated-workflow/runtime-contract';
import { submissionFileAccept } from '@/lib/generated-workflow/submission-files';
import { fieldInputAttrs } from '@/lib/generated-workflow/field-format';

interface GeneratedWorkflowFieldInputProps {
  disabled: boolean;
  field: GeneratedWorkflowField;
  id: string;
  value: unknown;
  onChange: (value: unknown) => void;
  onFileSelect: (file: File | null) => void;
}

const INPUT_CLASS =
  'bg-background border-input text-foreground mt-2 w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted';

export function GeneratedWorkflowFieldInput({
  disabled,
  field,
  id,
  value,
  onChange,
  onFileSelect,
}: GeneratedWorkflowFieldInputProps) {
  if (field.type === 'textarea') {
    return (
      <textarea
        id={id}
        className={`${INPUT_CLASS} min-h-32 resize-y`}
        disabled={disabled}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  if (field.type === 'select') {
    return (
      <select
        id={id}
        className={INPUT_CLASS}
        disabled={disabled}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value=''>Select an option</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === 'boolean' || field.type === 'checkbox') {
    return (
      <input
        id={id}
        type='checkbox'
        className='border-input text-primary mt-2 h-5 w-5 rounded'
        checked={value === true}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    );
  }
  if (field.type === 'file') {
    return (
      <input
        id={id}
        type='file'
        accept={submissionFileAccept(field.acceptedFileExtensions)}
        className={`${INPUT_CLASS} file:bg-muted file:text-foreground file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium`}
        disabled={disabled}
        onChange={(event) => onFileSelect(event.target.files?.[0] ?? null)}
      />
    );
  }
  return (
    <input
      id={id}
      type={field.type === 'date' ? 'date' : fieldInputAttrs(field, true).type}
      placeholder={fieldInputAttrs(field, true).placeholder}
      className={INPUT_CLASS}
      disabled={disabled}
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
