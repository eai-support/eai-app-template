import { NextRequest, NextResponse } from 'next/server';

import { readBoundedJsonBody, RequestBodyTooLargeError } from './bounded-body';
import { findDocumentCreationField } from './document-creation';
import {
  GeneratedWorkflowPlatformUnavailableError,
  generatedWorkflowPlatformFetch,
} from './platform';
import {
  requestClientFingerprint,
  requestHasSameOrigin,
} from './public-guards';
import { getGeneratedWorkflowRuntime } from './runtime';
import type { GeneratedWorkflowRuntime } from './runtime-contract';

/** Headers on every document-template BFF response. */
export const DOCUMENT_TEMPLATE_NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache',
  'X-Content-Type-Options': 'nosniff',
};

const MAX_TEMPLATE_RESPONSE_BYTES = 16 * 1024 * 1024;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/** A JSON error with the shared no-store headers. */
export function documentTemplateFailure(
  status: number,
  error: string,
): NextResponse {
  return NextResponse.json(
    { error },
    { status, headers: DOCUMENT_TEMPLATE_NO_STORE_HEADERS },
  );
}

/** A same-origin request for a template bound to this app's immutable workflow. */
export interface DocumentTemplateActionRequest {
  runtime: GeneratedWorkflowRuntime;
  templateId: string;
  body: Record<string, unknown>;
  anonymousClientId: string;
}

/**
 * Admits one document-template action. The browser names the template, but it
 * must be the template of a document-creation field in the deployed snapshot;
 * anything else is reported as not found before PublicAPI is called.
 */
export async function readDocumentTemplateAction(
  request: NextRequest,
  maxBodyBytes: number,
): Promise<
  | { ok: true; value: DocumentTemplateActionRequest }
  | { ok: false; response: NextResponse }
> {
  if (!requestHasSameOrigin(request)) {
    return {
      ok: false,
      response: documentTemplateFailure(403, 'ORIGIN_REQUIRED'),
    };
  }
  const resolved = getGeneratedWorkflowRuntime();
  if (resolved.status !== 'ready') {
    return {
      ok: false,
      response: documentTemplateFailure(503, 'WORKFLOW_RUNTIME_UNAVAILABLE'),
    };
  }
  let body: unknown;
  try {
    body = await readBoundedJsonBody(request, maxBodyBytes);
  } catch (error) {
    return {
      ok: false,
      response:
        error instanceof RequestBodyTooLargeError
          ? documentTemplateFailure(413, 'PAYLOAD_TOO_LARGE')
          : documentTemplateFailure(400, 'INVALID_BODY'),
    };
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      ok: false,
      response: documentTemplateFailure(400, 'INVALID_BODY'),
    };
  }
  const record = body as Record<string, unknown>;
  const field = findDocumentCreationField(
    resolved.runtime.snapshot,
    record.templateId,
  );
  if (!field) {
    return {
      ok: false,
      response: documentTemplateFailure(404, 'DOCUMENT_TEMPLATE_NOT_FOUND'),
    };
  }
  return {
    ok: true,
    value: {
      runtime: resolved.runtime,
      templateId: field.templateId,
      body: record,
      anonymousClientId: requestClientFingerprint(request.headers),
    },
  };
}

/** A PublicAPI failure translated to the status the browser should see. */
export class DocumentTemplateUpstreamError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`Document template request failed (${code}).`);
    this.name = 'DocumentTemplateUpstreamError';
  }
}

/** Maps a non-OK generated-app-runtime response to a browser-safe failure. */
export function documentTemplateUpstreamError(
  status: number,
): DocumentTemplateUpstreamError {
  if (status === 404)
    return new DocumentTemplateUpstreamError(
      404,
      'DOCUMENT_TEMPLATE_NOT_FOUND',
    );
  if (status === 429)
    return new DocumentTemplateUpstreamError(429, 'RATE_LIMITED');
  return new DocumentTemplateUpstreamError(
    502,
    'DOCUMENT_TEMPLATE_UNAVAILABLE',
  );
}

/** Converts thrown route errors to the shared failure envelope. */
export function documentTemplateErrorResponse(
  error: unknown,
  operation: string,
): NextResponse {
  if (error instanceof DocumentTemplateUpstreamError) {
    return documentTemplateFailure(error.status, error.code);
  }
  console.error(
    `[generated-workflow] document ${operation} error:`,
    error instanceof Error ? error.name : 'unknown',
  );
  return error instanceof GeneratedWorkflowPlatformUnavailableError
    ? documentTemplateFailure(503, 'PLATFORM_UNAVAILABLE')
    : documentTemplateFailure(502, 'DOCUMENT_TEMPLATE_UNAVAILABLE');
}

/** The bound template's .docx bytes as served by PublicAPI. */
export interface BoundDocumentTemplate {
  templateId: string;
  title?: string;
  filename?: string;
  buffer: Buffer;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Reads the app's bound template through the generated-app runtime facade. */
export async function fetchBoundDocumentTemplate(
  action: Pick<
    DocumentTemplateActionRequest,
    'runtime' | 'templateId' | 'anonymousClientId'
  >,
): Promise<BoundDocumentTemplate> {
  const response = await generatedWorkflowPlatformFetch({
    tenantId: action.runtime.tenantId,
    appKey: action.runtime.appKey,
    path: `/document-template?templateId=${encodeURIComponent(action.templateId)}`,
    anonymousClientId: action.anonymousClientId,
    init: { method: 'GET', headers: { Accept: 'application/json' } },
  });
  if (!response.ok) throw documentTemplateUpstreamError(response.status);
  const payload = (await readBoundedJsonBody(
    response,
    MAX_TEMPLATE_RESPONSE_BYTES,
  )) as {
    templateId?: unknown;
    title?: unknown;
    filename?: unknown;
    file?: { base64?: unknown } | null;
  } | null;
  if (
    payload?.templateId !== undefined &&
    payload.templateId !== action.templateId
  ) {
    throw new DocumentTemplateUpstreamError(404, 'DOCUMENT_TEMPLATE_NOT_FOUND');
  }
  const base64 =
    typeof payload?.file?.base64 === 'string'
      ? payload.file.base64.replace(/\s+/g, '')
      : '';
  if (!base64 || !BASE64_PATTERN.test(base64)) {
    throw new DocumentTemplateUpstreamError(
      502,
      'DOCUMENT_TEMPLATE_UNAVAILABLE',
    );
  }
  const buffer = Buffer.from(base64, 'base64');
  // A .docx is a ZIP container; anything else cannot be parsed or filled.
  if (buffer.byteLength < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new DocumentTemplateUpstreamError(
      502,
      'DOCUMENT_TEMPLATE_UNAVAILABLE',
    );
  }
  return {
    templateId: action.templateId,
    title: optionalText(payload?.title),
    filename: optionalText(payload?.filename),
    buffer,
  };
}

/** Bounded list of non-empty strings from untrusted JSON. */
export function stringList(
  value: unknown,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  for (const item of value) {
    if (items.length >= maxItems) break;
    if (typeof item === 'string' && item.trim() && item.length <= maxLength)
      items.push(item.trim());
  }
  return items;
}

/** A Content-Disposition filename limited to safe ASCII and a .docx suffix. */
export function safeDocxFilename(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const stem = candidate
      .replace(/\.docx$/i, '')
      .replace(/[^A-Za-z0-9 ._()-]+/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/^[\s._-]+|[\s._-]+$/g, '')
      .slice(0, 120);
    if (stem) return `${stem}.docx`;
  }
  return 'document.docx';
}
