import { NextRequest, NextResponse } from 'next/server';

import {
  MAX_ANONYMOUS_JSON_BODY_BYTES,
  readBoundedJsonBody,
} from '@/lib/generated-workflow/bounded-body';
import { boundedDocumentAnswers } from '@/lib/generated-workflow/document-creation';
import {
  DOCUMENT_TEMPLATE_NO_STORE_HEADERS,
  documentTemplateErrorResponse,
  documentTemplateUpstreamError,
  readDocumentTemplateAction,
  stringList,
} from '@/lib/generated-workflow/document-template';
import { generatedWorkflowPlatformFetch } from '@/lib/generated-workflow/platform';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

const MAX_PLACEHOLDERS = 200;
const MAX_PLACEHOLDER_KEY_LENGTH = 200;
const MAX_LABEL_LENGTH = 300;
const MAX_MAPPED_VALUE_LENGTH = 20_000;
const MAX_RESPONSE_BYTES = 1024 * 1024;

function mapped(fields: Record<string, string>): NextResponse {
  return NextResponse.json(
    { mappedFields: fields },
    { headers: DOCUMENT_TEMPLATE_NO_STORE_HEADERS },
  );
}

function placeholderMeta(value: unknown, requested: Set<string>) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const { key, suggestedType, suggestedLabel } = item as Record<
      string,
      unknown
    >;
    if (typeof key !== 'string' || !requested.has(key)) return [];
    const text = (candidate: unknown) =>
      typeof candidate === 'string'
        ? candidate.slice(0, MAX_LABEL_LENGTH)
        : undefined;
    return [
      {
        key,
        suggestedType: text(suggestedType),
        suggestedLabel: text(suggestedLabel),
      },
    ];
  });
}

/**
 * Lets AI fill the bound template's remaining blanks from the respondent's
 * answers. Only answers and blank names come from the browser; PublicAPI owns
 * the template, its fill guide and the model call.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const admitted = await readDocumentTemplateAction(
    request,
    MAX_ANONYMOUS_JSON_BODY_BYTES,
  );
  if (!admitted.ok) return admitted.response;
  const {
    body,
    runtime: workflow,
    templateId,
    anonymousClientId,
  } = admitted.value;
  const unmatchedPlaceholders = stringList(
    body.unmatchedPlaceholders,
    MAX_PLACEHOLDERS,
    MAX_PLACEHOLDER_KEY_LENGTH,
  );
  const answers = boundedDocumentAnswers(body.brContext);
  // Nothing to fill, or nothing to fill it from: skip the rate-limited AI call.
  if (unmatchedPlaceholders.length === 0 || Object.keys(answers).length === 0) {
    return mapped({});
  }
  const requested = new Set(unmatchedPlaceholders);

  try {
    const response = await generatedWorkflowPlatformFetch({
      tenantId: workflow.tenantId,
      appKey: workflow.appKey,
      path: '/document-template/ai-field-mapping',
      anonymousClientId,
      init: {
        method: 'POST',
        body: JSON.stringify({
          templateId,
          unmatchedPlaceholders,
          placeholderMeta: placeholderMeta(body.placeholderMeta, requested),
          answers,
        }),
      },
    });
    if (!response.ok) throw documentTemplateUpstreamError(response.status);
    const payload = (await readBoundedJsonBody(
      response,
      MAX_RESPONSE_BYTES,
    )) as { values?: unknown } | null;
    const values =
      payload?.values &&
      typeof payload.values === 'object' &&
      !Array.isArray(payload.values)
        ? (payload.values as Record<string, unknown>)
        : {};
    const mappedFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      // Only blanks the browser asked for, as text; never echo extra keys.
      if (!requested.has(key) || typeof value !== 'string' || !value.trim())
        continue;
      mappedFields[key] = value.slice(0, MAX_MAPPED_VALUE_LENGTH);
    }
    return mapped(mappedFields);
  } catch (error) {
    return documentTemplateErrorResponse(error, 'field mapping');
  }
}
