import {
  __resetGeneratedWorkflowRateLimit,
  allowRequest,
  validateSubmissionPatch,
} from './public-guards';

describe('generated workflow public request guards', () => {
  beforeEach(() => {
    __resetGeneratedWorkflowRateLimit();
  });

  it('accepts bounded autosave and completion fields', () => {
    expect(
      validateSubmissionPatch({
        status: 'completed',
        currentStep: 2,
        formData: { contact: { name: 'Alex' } },
        userName: 'Alex',
        userEmail: 'alex@example.com',
      }),
    ).toEqual({
      ok: true,
      value: {
        status: 'completed',
        currentStep: 2,
        formData: { contact: { name: 'Alex' } },
        userName: 'Alex',
        userEmail: 'alex@example.com',
      },
    });
  });

  it('rejects invalid status, email, and oversized form data', () => {
    expect(validateSubmissionPatch({ status: 'approved' })).toMatchObject({
      ok: false,
    });
    expect(
      validateSubmissionPatch({ userEmail: 'not-an-email' }),
    ).toMatchObject({ ok: false });
    expect(
      validateSubmissionPatch({ formData: { value: 'x'.repeat(300_000) } }),
    ).toMatchObject({ ok: false });
  });

  it('limits repeated anonymous requests within the configured window', () => {
    expect(allowRequest('client', 2, 60_000, 1_000)).toBe(true);
    expect(allowRequest('client', 2, 60_000, 1_001)).toBe(true);
    expect(allowRequest('client', 2, 60_000, 1_002)).toBe(false);
  });
});
