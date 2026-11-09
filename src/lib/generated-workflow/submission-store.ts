import type { NextRequest } from 'next/server';

import { generatedWorkflowPlatformFetch } from './platform';
import { GeneratedWorkflowPlatformUnavailableError } from './platform';
import { getSubmissionSessionDigest } from './submission-session';
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

/** Preserves the upstream status so the public route can map throttling and platform failures. */
export class SubmissionReadUpstreamError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Generated workflow submission read failed (${status}).`);
    this.name = 'SubmissionReadUpstreamError';
    this.status = status;
  }
}

/** Maps submission-read failures to the stable public error envelope without exposing upstream detail. */
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
  const workflowDigest = getSubmissionSessionDigest(request, submissionId);
  if (!workflowDigest) return null;
  const response = await generatedWorkflowPlatformFetch({
    tenantId: runtime.tenantId,
    appKey: runtime.appKey,
    path: `/submissions/${encodeURIComponent(submissionId)}`,
    init: { headers: { 'X-EAI-Submission-Workflow-Digest': workflowDigest } },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new SubmissionReadUpstreamError(response.status);
  const payload = (await response.json()) as {
    submission?: Partial<StoredSubmission> & {
      workflowTemplateDigest?: unknown;
    };
  };
  const stored = payload.submission ?? {};
  if (typeof stored.id !== 'string' || stored.id !== submissionId) {
    throw new SubmissionReadUpstreamError(502);
  }
  // SECURITY: A retained response must match the original signed browser capability, not just this app.
  if (stored.workflowTemplateDigest !== workflowDigest) return null;
  if (
    workflowDigest !== runtime.binding.workflowTemplate.digest &&
    stored.status !== 'completed'
  )
    return null;
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
