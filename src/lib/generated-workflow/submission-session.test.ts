import {
  hasSubmissionSession,
  setSubmissionSession,
} from './submission-session';

describe('anonymous generated workflow submission session', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      EAI_GENERATED_WORKFLOW_SESSION_SECRET: 's'.repeat(48),
      NODE_ENV: 'test',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('binds an HttpOnly cookie to one submission and workflow digest', () => {
    const set = jest.fn();
    setSubmissionSession(
      { cookies: { set } } as never,
      'submission-1',
      `sha256:${'a'.repeat(64)}`,
    );
    const cookie = set.mock.calls[0][0] as {
      value: string;
      httpOnly: boolean;
      sameSite: string;
    };
    const request = {
      cookies: {
        get: () => ({ value: cookie.value }),
      },
    } as never;

    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'lax' });
    expect(
      hasSubmissionSession(request, 'submission-1', `sha256:${'a'.repeat(64)}`),
    ).toBe(true);
    expect(
      hasSubmissionSession(request, 'submission-2', `sha256:${'a'.repeat(64)}`),
    ).toBe(false);
    expect(
      hasSubmissionSession(request, 'submission-1', `sha256:${'b'.repeat(64)}`),
    ).toBe(false);
  });
});
