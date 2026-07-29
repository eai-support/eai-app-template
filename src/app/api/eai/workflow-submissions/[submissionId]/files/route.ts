import { NextRequest, NextResponse } from 'next/server';

import {
  allowRequest,
  requestClientIp,
} from '@/lib/generated-workflow/public-guards';
import { generatedWorkflowPlatformFetch } from '@/lib/generated-workflow/platform';
import { getGeneratedWorkflowRuntime } from '@/lib/generated-workflow/runtime';
import {
  sanitizeSubmissionFileName,
  SUBMISSION_FILE_MAX_BYTES,
  validateSubmissionFile,
} from '@/lib/generated-workflow/submission-files';
import { readOwnedSubmission } from '@/lib/generated-workflow/submission-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

interface RouteContext {
  params: Promise<{ submissionId: string }>;
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache',
  'X-Content-Type-Options': 'nosniff',
};
const SUBMISSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;
const MAX_REQUEST_BYTES = SUBMISSION_FILE_MAX_BYTES + 64 * 1024;

function notFound(): NextResponse {
  return NextResponse.json(
    { error: 'SUBMISSION_NOT_FOUND' },
    { status: 404, headers: NO_STORE_HEADERS },
  );
}

/** Uploads a validated snapshot field through the managed-identity facade. */
export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const resolved = getGeneratedWorkflowRuntime();
  if (resolved.status !== 'ready') return notFound();
  const { submissionId } = await context.params;
  if (!SUBMISSION_ID_PATTERN.test(submissionId)) return notFound();
  if (
    !allowRequest(
      `file:${resolved.runtime.appKey}:${requestClientIp(request.headers)}`,
      40,
      60_000,
    )
  ) {
    return NextResponse.json(
      { error: 'RATE_LIMITED' },
      { status: 429, headers: NO_STORE_HEADERS },
    );
  }
  const contentLength = request.headers.get('content-length');
  if (contentLength !== null && Number(contentLength) > MAX_REQUEST_BYTES) {
    return NextResponse.json(
      { error: 'INVALID_UPLOAD', message: 'File is too large (max 10MB).' },
      { status: 413, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const stepId = formData.get('stepId');
    const fieldId = formData.get('fieldId');
    if (
      !(file instanceof File) ||
      typeof stepId !== 'string' ||
      typeof fieldId !== 'string'
    ) {
      return NextResponse.json(
        {
          error: 'INVALID_UPLOAD',
          message: 'file, stepId, and fieldId are required.',
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    const validationError = validateSubmissionFile(file);
    if (validationError) {
      return NextResponse.json(
        { error: 'INVALID_UPLOAD', message: validationError },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    const fileFieldExists = resolved.runtime.snapshot.steps.some(
      (step) =>
        step.id === stepId &&
        step.fields?.some(
          (field) => field.id === fieldId && field.type === 'file',
        ),
    );
    if (!fileFieldExists) return notFound();

    const stored = await readOwnedSubmission({
      request,
      runtime: resolved.runtime,
      submissionId,
    });
    if (!stored || stored.status !== 'in_progress') return notFound();

    const fileName = sanitizeSubmissionFileName(file.name);
    const upstreamForm = new FormData();
    upstreamForm.set('file', file, fileName);
    upstreamForm.set('stepId', stepId);
    upstreamForm.set('fieldId', fieldId);
    upstreamForm.set(
      'workflowTemplateDigest',
      resolved.runtime.binding.workflowTemplate.digest,
    );
    const uploadResponse = await generatedWorkflowPlatformFetch({
      tenantId: resolved.runtime.tenantId,
      appKey: resolved.runtime.appKey,
      path: `/submissions/${encodeURIComponent(submissionId)}/files`,
      init: {
        method: 'POST',
        body: upstreamForm,
      },
    });
    if (!uploadResponse.ok) {
      console.error(
        '[generated-workflow] submission file upload failed:',
        uploadResponse.status,
      );
      return NextResponse.json(
        { error: 'UPLOAD_FAILED' },
        { status: 502, headers: NO_STORE_HEADERS },
      );
    }

    const payload = (await uploadResponse.json().catch(() => null)) as {
      file?: unknown;
    } | null;
    if (!payload?.file) {
      return NextResponse.json(
        { error: 'UPLOAD_FAILED' },
        { status: 502, headers: NO_STORE_HEADERS },
      );
    }
    return NextResponse.json(
      { file: payload.file },
      { status: 201, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error(
      '[generated-workflow] submission file error:',
      error instanceof Error ? error.name : 'unknown',
    );
    return NextResponse.json(
      { error: 'UPLOAD_FAILED' },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
