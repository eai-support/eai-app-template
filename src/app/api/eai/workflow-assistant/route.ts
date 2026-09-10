import { NextRequest, NextResponse } from 'next/server';

import { workflowAssistantQuestionSchema } from '@/lib/generated-workflow/assistant-contract';
import {
  readBoundedJsonBody,
  RequestBodyTooLargeError,
} from '@/lib/generated-workflow/bounded-body';
import { generatedWorkflowPlatformFetch } from '@/lib/generated-workflow/platform';
import { requestClientFingerprint } from '@/lib/generated-workflow/public-guards';
import { getGeneratedWorkflowRuntime } from '@/lib/generated-workflow/runtime';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const failure = (status: number, error: string) =>
  NextResponse.json({ error }, { status, headers: HEADERS });

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (request.headers.get('origin') !== request.nextUrl.origin)
    return failure(403, 'ORIGIN_REQUIRED');
  const resolved = getGeneratedWorkflowRuntime();
  if (resolved.status !== 'ready')
    return failure(503, 'WORKFLOW_RUNTIME_UNAVAILABLE');
  if (resolved.runtime.assistantEnabled !== true)
    return failure(404, 'WORKFLOW_ASSISTANT_DISABLED');
  let input;
  try {
    input = workflowAssistantQuestionSchema.safeParse(
      await readBoundedJsonBody(request, 65_536),
    );
  } catch (error) {
    return failure(
      error instanceof RequestBodyTooLargeError ? 413 : 400,
      'INVALID_QUESTION',
    );
  }
  if (
    !input.success ||
    !resolved.runtime.snapshot.steps.some(
      (step) => step.id === input.data.stepId,
    )
  ) {
    return failure(400, 'INVALID_QUESTION');
  }
  const { runtime: workflow } = resolved;
  try {
    const response = await generatedWorkflowPlatformFetch({
      tenantId: workflow.tenantId,
      appKey: workflow.appKey,
      path: '/assistant',
      anonymousClientId: requestClientFingerprint(request.headers),
      init: {
        method: 'POST',
        signal: AbortSignal.timeout(40_000),
        body: JSON.stringify({
          ...input.data,
          workflowTemplate: {
            id: workflow.binding.workflowTemplate.id,
            version: workflow.binding.workflowTemplate.version,
            digest: workflow.binding.workflowTemplate.digest,
          },
        }),
      },
    });
    if (!response.ok)
      return failure(
        [409, 429, 503].includes(response.status) ? response.status : 502,
        'ASSISTANT_UNAVAILABLE',
      );
    const output = (await readBoundedJsonBody(response, 32_768)) as {
      answer?: unknown;
    } | null;
    if (
      !output ||
      typeof output.answer !== 'string' ||
      !output.answer.trim() ||
      output.answer.length > 4000
    ) {
      return failure(502, 'ASSISTANT_UNAVAILABLE');
    }
    return NextResponse.json({ answer: output.answer }, { headers: HEADERS });
  } catch {
    return failure(502, 'ASSISTANT_UNAVAILABLE');
  }
}
