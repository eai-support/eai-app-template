import { parseDocumentTemplateStructure } from '@enterpriseaigroup/core/document-editor';
import { NextRequest, NextResponse } from 'next/server';

import {
  DOCUMENT_TEMPLATE_NO_STORE_HEADERS,
  documentTemplateErrorResponse,
  documentTemplateFailure,
  fetchBoundDocumentTemplate,
  readDocumentTemplateAction,
} from '@/lib/generated-workflow/document-template';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

const MAX_BODY_BYTES = 4 * 1024;

/** Returns the blanks, sections and conditional keys of the app's bound document template. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const admitted = await readDocumentTemplateAction(request, MAX_BODY_BYTES);
  if (!admitted.ok) return admitted.response;
  let template;
  try {
    template = await fetchBoundDocumentTemplate(admitted.value);
  } catch (error) {
    return documentTemplateErrorResponse(error, 'template read');
  }
  try {
    const { placeholders, sections, conditionalKeys } =
      await parseDocumentTemplateStructure(template.buffer);
    return NextResponse.json(
      { placeholders, sections, conditionalKeys },
      { headers: DOCUMENT_TEMPLATE_NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error(
      '[generated-workflow] document template parse error:',
      error instanceof Error ? error.name : 'unknown',
    );
    return documentTemplateFailure(422, 'DOCUMENT_TEMPLATE_INVALID');
  }
}
