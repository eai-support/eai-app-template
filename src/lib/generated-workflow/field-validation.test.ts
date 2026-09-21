import cases from '../../../tests/fixtures/ncb/field-validation-v1.json';
import {
  validateWorkflowFieldValue,
  type ValidatedWorkflowField,
} from './field-validation';

it.each(cases)('$name', ({ field, value, error }) => {
  expect(
    validateWorkflowFieldValue(field as ValidatedWorkflowField, value, true)
      ?.code ?? null,
  ).toBe(error);
});

it.each([
  ['ada@example.test', null],
  [' ada@example.test, grace@example.test ', null],
  ['ada@example.test, invalid', 'invalid_format'],
  ['ada@example.test, ', 'invalid_format'],
])('validates an explicit email textarea value %s', (value, expected) => {
  expect(
    validateWorkflowFieldValue(
      {
        id: 'guest_emails',
        label: 'Guest emails',
        type: 'textarea',
        validation: { format: 'email' },
      },
      value,
      true,
    )?.code ?? null,
  ).toBe(expected);
});

it('keeps ordinary email text fields single-address', () => {
  expect(
    validateWorkflowFieldValue(
      {
        id: 'email',
        label: 'Email',
        type: 'text',
        validation: { format: 'email' },
      },
      'ada@example.test, grace@example.test',
      true,
    )?.code,
  ).toBe('invalid_format');
});

it('rejects unsafe patterns before evaluating respondent input', () => {
  expect(
    validateWorkflowFieldValue(
      {
        id: 'answer',
        label: 'Answer',
        type: 'text',
        validation: { pattern: '^(a+)+$' },
      },
      'a'.repeat(1000),
      true,
    )?.code,
  ).toBe('invalid_configuration');
});

it.each([
  ['^[A-Z0-9]{2,4}$', 'AB12', null],
  ['^[A-Z0-9]{2,4}$', 'ABCDE', 'invalid_format'],
  ['^[A-Z0-9]{2,4}$', 'A', 'invalid_format'],
  ['^[A-Z]{4,2}$', 'ABC', 'invalid_configuration'],
  ['^[a-z]+$', 'a'.repeat(100_000), null],
  ['^[a-z]+$', `${'a'.repeat(100_000)}!`, 'invalid_format'],
  ['^[0-9]?$', '12', 'invalid_format'],
  ['^[0-9]?$', '1', null],
  ['^[0-9]*$', '1234', null],
  ['^[a-z\\-]+$', 'work-flow', null],
  ['^[\\d]{3}$', '123', null],
  ['^[\\d]{3}$', 'abc', 'invalid_format'],
  ['^[z-a]+$', 'abc', 'invalid_configuration'],
  [`^[${'a'.repeat(129)}]+$`, 'a', 'invalid_configuration'],
])('validates the bounded pattern %s', (pattern, value, expected) => {
  expect(
    validateWorkflowFieldValue(
      {
        id: 'answer',
        label: 'Answer',
        type: 'text',
        validation: { pattern: pattern! },
      },
      value,
      true,
    )?.code ?? null,
  ).toBe(expected);
});
