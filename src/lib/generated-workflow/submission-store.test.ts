const mockPlatformFetch = jest.fn();
const mockGetSubmissionSessionDigest = jest.fn();

jest.mock('./platform', () => {
  class GeneratedWorkflowPlatformUnavailableError extends Error {}
  return {
    generatedWorkflowPlatformFetch: (...args: unknown[]) =>
      mockPlatformFetch(...args),
    GeneratedWorkflowPlatformUnavailableError,
  };
});

jest.mock('./submission-session', () => ({
  getSubmissionSessionDigest: (...args: unknown[]) =>
    mockGetSubmissionSessionDigest(...args),
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
    mockGetSubmissionSessionDigest.mockReturnValue(
      runtime.binding.workflowTemplate.digest,
    );
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

  it('does not contact the platform without a verified browser capability', async () => {
    mockGetSubmissionSessionDigest.mockReturnValue(null);
    await expect(
      readOwnedSubmission({
        request: {} as never,
        runtime: runtime as never,
        submissionId: 'submission-1',
      }),
    ).resolves.toBeNull();
    expect(mockPlatformFetch).not.toHaveBeenCalled();
  });

  it('reads an archived completed response with its original capability and preserves values and chat history', async () => {
    const originalDigest = `sha256:${'b'.repeat(64)}`;
    mockGetSubmissionSessionDigest.mockReturnValue(originalDigest);
    const submission = {
      id: 'submission-1',
      status: 'completed',
      currentStep: 2,
      formData: {
        name: 'Test respondent',
        incident: 'Test incident',
        optionalNote: 'Synthetic note',
      },
      assistantMessages: [
        { role: 'user', content: 'What happens next?' },
        { role: 'assistant', content: 'Review your incident.' },
        { role: 'user', content: 'Can I add a note?' },
        { role: 'assistant', content: 'Yes, the note is optional.' },
      ],
      workflowTemplateDigest: originalDigest,
    };
    mockPlatformFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ submission }),
    });
    const stored = await readOwnedSubmission({
      request: {} as never,
      runtime: runtime as never,
      submissionId: 'submission-1',
    });
    expect(stored).toMatchObject({
      id: submission.id,
      status: submission.status,
      formData: submission.formData,
      assistantMessages: submission.assistantMessages,
    });
    expect(mockPlatformFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        init: {
          headers: { 'X-EAI-Submission-Workflow-Digest': originalDigest },
        },
      }),
    );
  });

  it.each(['in_progress', 'abandoned', undefined])(
    'does not resume an old %s response for editing',
    async (status) => {
      const originalDigest = `sha256:${'b'.repeat(64)}`;
      mockGetSubmissionSessionDigest.mockReturnValue(originalDigest);
      mockPlatformFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          submission: {
            id: 'submission-1',
            status,
            workflowTemplateDigest: originalDigest,
          },
        }),
      });
      await expect(
        readOwnedSubmission({
          request: {} as never,
          runtime: runtime as never,
          submissionId: 'submission-1',
        }),
      ).resolves.toBeNull();
    },
  );

  it.each([undefined, `sha256:${'c'.repeat(64)}`])(
    'rejects a response that does not match the signed capability digest',
    async (workflowTemplateDigest) => {
      mockPlatformFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          submission: {
            id: 'submission-1',
            status: 'completed',
            workflowTemplateDigest,
          },
        }),
      });
      await expect(
        readOwnedSubmission({
          request: {} as never,
          runtime: runtime as never,
          submissionId: 'submission-1',
        }),
      ).resolves.toBeNull();
    },
  );

  it('preserves a current workflow in-progress response', async () => {
    mockPlatformFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        submission: {
          id: 'submission-1',
          status: 'in_progress',
          workflowTemplateDigest: runtime.binding.workflowTemplate.digest,
        },
      }),
    });
    await expect(
      readOwnedSubmission({
        request: {} as never,
        runtime: runtime as never,
        submissionId: 'submission-1',
      }),
    ).resolves.toMatchObject({ status: 'in_progress' });
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
