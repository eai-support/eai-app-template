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
