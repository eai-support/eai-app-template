import { NextRequest, NextResponse } from 'next/server';

import { requestClientFingerprint } from '@/lib/generated-workflow/public-guards';
import { generatedWorkflowPlatformFetch } from '@/lib/generated-workflow/platform';
import { getGeneratedWorkflowRuntime } from '@/lib/generated-workflow/runtime';
import { setSubmissionSession } from '@/lib/generated-workflow/submission-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache',
  'X-Content-Type-Options': 'nosniff',
};
const VALID_DEVICES = new Set(['Desktop', 'Mobile', 'Tablet']);

/** Starts an anonymous submission through the server-only managed-identity facade. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const resolved = getGeneratedWorkflowRuntime();
  if (resolved.status !== 'ready') {
    return NextResponse.json(
      { error: 'WORKFLOW_RUNTIME_UNAVAILABLE' },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
  const { runtime: workflowRuntime } = resolved;

  const input = (await request.json().catch(() => null)) as {
    device?: unknown;
  } | null;
  if (
    !input ||
    typeof input.device !== 'string' ||
    !VALID_DEVICES.has(input.device)
  ) {
    return NextResponse.json(
      {
        error: 'INVALID_DEVICE',
        message: 'device must be Desktop, Mobile, or Tablet.',
      },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const createResponse = await generatedWorkflowPlatformFetch({
      tenantId: workflowRuntime.tenantId,
      appKey: workflowRuntime.appKey,
      path: '/submissions',
      anonymousClientId: requestClientFingerprint(request.headers),
      init: {
        method: 'POST',
        body: JSON.stringify({
          workflowTemplate: {
            id: workflowRuntime.binding.workflowTemplate.id,
            version: workflowRuntime.binding.workflowTemplate.version,
            digest: workflowRuntime.binding.workflowTemplate.digest,
          },
          device: input.device,
        }),
      },
    });
    if (!createResponse.ok) {
      if (createResponse.status === 429) {
        return NextResponse.json(
          { error: 'RATE_LIMITED' },
          { status: 429, headers: NO_STORE_HEADERS },
        );
      }
      console.error(
        '[generated-workflow] submission create failed:',
        createResponse.status,
      );
      return NextResponse.json(
        { error: 'SUBMISSION_CREATE_FAILED' },
        { status: 502, headers: NO_STORE_HEADERS },
      );
    }
    const created = (await createResponse.json().catch(() => null)) as {
      submissionId?: unknown;
    } | null;
    if (
      !created ||
      typeof created.submissionId !== 'string' ||
      !created.submissionId
    ) {
      return NextResponse.json(
        { error: 'SUBMISSION_CREATE_FAILED' },
        { status: 502, headers: NO_STORE_HEADERS },
      );
    }

    const response = NextResponse.json(
      { submissionId: created.submissionId },
      { status: 201, headers: NO_STORE_HEADERS },
    );
    setSubmissionSession(
      response,
      created.submissionId,
      workflowRuntime.binding.workflowTemplate.digest,
    );
    return response;
  } catch (error) {
    console.error(
      '[generated-workflow] submission create error:',
      error instanceof Error ? error.name : 'unknown',
    );
    return NextResponse.json(
      { error: 'SUBMISSION_CREATE_FAILED' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
