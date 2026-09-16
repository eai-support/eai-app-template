import type { NextRequest } from 'next/server';

import { generatedWorkflowPlatformFetch } from './platform';
import { GeneratedWorkflowPlatformUnavailableError } from './platform';
import { hasSubmissionSession } from './submission-session';
import type { GeneratedWorkflowRuntime } from './runtime-contract';

/** Minimal facade response exposed to the anonymous resume UI. */
export interface StoredSubmission {
  id: string;
  status?: unknown;
  currentStep?: unknown;
  formData?: unknown;
  userName?: unknown;
  userEmail?: unknown;
  assistantMessages?: unknown;
}

export class SubmissionReadUpstreamError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Generated workflow submission read failed (${status}).`);
    this.name = 'SubmissionReadUpstreamError';
    this.status = status;
  }
}

export function submissionReadFailure(error: unknown): {
  error: 'PLATFORM_UNAVAILABLE' | 'RATE_LIMITED' | 'SUBMISSION_READ_FAILED';
  status: 429 | 502 | 503;
} {
  if (error instanceof SubmissionReadUpstreamError) {
    if (error.status === 429) return { error: 'RATE_LIMITED', status: 429 };
    if (error.status >= 500) {
      return { error: 'PLATFORM_UNAVAILABLE', status: 503 };
    }
  }
  if (error instanceof GeneratedWorkflowPlatformUnavailableError) {
    return { error: 'PLATFORM_UNAVAILABLE', status: 503 };
  }
  return { error: 'SUBMISSION_READ_FAILED', status: 502 };
}

/** Reads a submission only after its HttpOnly ownership capability is verified. */
export async function readOwnedSubmission(args: {
  request: NextRequest;
  runtime: GeneratedWorkflowRuntime;
  submissionId: string;
}): Promise<StoredSubmission | null> {
  const { request, runtime, submissionId } = args;
  if (
    !hasSubmissionSession(
      request,
      submissionId,
      runtime.binding.workflowTemplate.digest,
    )
  ) {
    return null;
  }
  const response = await generatedWorkflowPlatformFetch({
    tenantId: runtime.tenantId,
    appKey: runtime.appKey,
    path: `/submissions/${encodeURIComponent(submissionId)}`,
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new SubmissionReadUpstreamError(response.status);
  const payload = (await response.json()) as {
    submission?: Partial<StoredSubmission>;
  };
  const stored = payload.submission ?? {};
  if (typeof stored.id !== 'string' || stored.id !== submissionId) {
    throw new SubmissionReadUpstreamError(502);
  }
  return {
    id: submissionId,
    status: stored.status,
    currentStep: stored.currentStep,
    formData: stored.formData,
    userName: stored.userName,
    userEmail: stored.userEmail,
    assistantMessages: stored.assistantMessages,
  };
}
