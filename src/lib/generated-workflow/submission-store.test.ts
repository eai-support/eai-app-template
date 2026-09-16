const mockPlatformFetch = jest.fn();
const mockHasSubmissionSession = jest.fn();

jest.mock('./platform', () => {
  class GeneratedWorkflowPlatformUnavailableError extends Error {}
  return {
    generatedWorkflowPlatformFetch: (...args: unknown[]) =>
      mockPlatformFetch(...args),
    GeneratedWorkflowPlatformUnavailableError,
  };
});

jest.mock('./submission-session', () => ({
  hasSubmissionSession: (...args: unknown[]) =>
    mockHasSubmissionSession(...args),
}));

import { GeneratedWorkflowPlatformUnavailableError } from './platform';
import {
  readOwnedSubmission,
  submissionReadFailure,
  SubmissionReadUpstreamError,
} from './submission-store';

const runtime = {
  tenantId: 'tenant-a',
  appKey: 'rates-review',
  binding: { workflowTemplate: { digest: `sha256:${'a'.repeat(64)}` } },
};

describe('submission ownership reads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHasSubmissionSession.mockReturnValue(true);
  });

  it('returns null only for a missing or unowned submission', async () => {
    mockPlatformFetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(
      readOwnedSubmission({
        request: {} as never,
        runtime: runtime as never,
        submissionId: 'submission-1',
      }),
    ).resolves.toBeNull();
  });

  it.each([429, 500, 503])(
    'preserves upstream status %s as a read failure',
    async (status) => {
      mockPlatformFetch.mockResolvedValue({ ok: false, status });

      await expect(
        readOwnedSubmission({
          request: {} as never,
          runtime: runtime as never,
          submissionId: 'submission-1',
        }),
      ).rejects.toMatchObject({ name: 'SubmissionReadUpstreamError', status });
    },
  );

  it('does not classify a malformed successful payload as missing', async () => {
    mockPlatformFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ submission: { id: 'another-submission' } }),
    });

    await expect(
      readOwnedSubmission({
        request: {} as never,
        runtime: runtime as never,
        submissionId: 'submission-1',
      }),
    ).rejects.toMatchObject({ status: 502 });
  });

  it('maps availability and rate-limit failures to retryable responses', () => {
    expect(submissionReadFailure(new SubmissionReadUpstreamError(429))).toEqual(
      {
        error: 'RATE_LIMITED',
        status: 429,
      },
    );
    expect(submissionReadFailure(new SubmissionReadUpstreamError(503))).toEqual(
      {
        error: 'PLATFORM_UNAVAILABLE',
        status: 503,
      },
    );
    expect(
      submissionReadFailure(new GeneratedWorkflowPlatformUnavailableError()),
    ).toEqual({ error: 'PLATFORM_UNAVAILABLE', status: 503 });
  });
});
