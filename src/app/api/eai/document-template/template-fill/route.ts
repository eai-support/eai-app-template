import {
  fillDocumentTemplateBuffer,
  type FillDocumentTemplateInput,
} from '@enterpriseaigroup/core/document-editor';
import { NextRequest, NextResponse } from 'next/server';

import { MAX_ANONYMOUS_JSON_BODY_BYTES } from '@/lib/generated-workflow/bounded-body';
import {
  DOCUMENT_TEMPLATE_NO_STORE_HEADERS,
  documentTemplateErrorResponse,
  documentTemplateFailure,
  fetchBoundDocumentTemplate,
  readDocumentTemplateAction,
  safeDocxFilename,
  stringList,
} from '@/lib/generated-workflow/document-template';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_KEYS = 1000;
const MAX_KEY_LENGTH = 200;
const MAX_TABLE_OPERATIONS = 50;
const MAX_TABLE_ROWS = 200;

type ExtraTableRows = NonNullable<
  FillDocumentTemplateInput['extraTableRows']
>[number];
type DeletedTableRows = NonNullable<
  FillDocumentTemplateInput['deletedTableRows']
>[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function placeholderValues(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) return null;
  const entries = Object.entries(value);
  if (entries.length > MAX_KEYS) return null;
  const placeholders: Record<string, string> = {};
  for (const [key, entry] of entries) {
    if (!key || key.length > MAX_KEY_LENGTH || typeof entry !== 'string')
      continue;
    placeholders[key] = entry;
  }
  return placeholders;
}

function extraTableRows(value: unknown): ExtraTableRows[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_TABLE_OPERATIONS).flatMap((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.tableId !== 'string' ||
      !isIndex(entry.tableIndex) ||
      !Array.isArray(entry.rows)
    )
      return [];
    const rows = entry.rows
      .slice(0, MAX_TABLE_ROWS)
      .filter(isRecord)
      .map((row) =>
        Object.fromEntries(
          Object.entries(row).filter(
            ([column, cell]) =>
              /^\d+$/.test(column) && typeof cell === 'string',
          ),
        ),
      );
    return [
      { tableId: entry.tableId, tableIndex: entry.tableIndex, rows },
    ] as ExtraTableRows[];
  });
}

function deletedTableRows(value: unknown): DeletedTableRows[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_TABLE_OPERATIONS).flatMap((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.tableId !== 'string' ||
      !isIndex(entry.tableIndex) ||
      !isIndex(entry.headerRowCount) ||
      !Array.isArray(entry.rowIndices) ||
      !entry.rowIndices.every(isIndex)
    )
      return [];
    return [
      {
        tableId: entry.tableId,
        tableIndex: entry.tableIndex,
        headerRowCount: entry.headerRowCount,
        rowIndices: entry.rowIndices.slice(0, MAX_TABLE_ROWS),
      },
    ];
  });
}

/** Fills the app's bound document template with the respondent's values and returns the .docx. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const admitted = await readDocumentTemplateAction(
    request,
    MAX_ANONYMOUS_JSON_BODY_BYTES,
  );
  if (!admitted.ok) return admitted.response;
  const { body } = admitted.value;
  const placeholders = placeholderValues(body.placeholders);
  if (!placeholders) return documentTemplateFailure(400, 'INVALID_BODY');

  let template;
  try {
    template = await fetchBoundDocumentTemplate(admitted.value);
  } catch (error) {
    return documentTemplateErrorResponse(error, 'template read');
  }
  let document: Buffer;
  try {
    document = await fillDocumentTemplateBuffer({
      templateBuffer: template.buffer,
      placeholders,
      richTextKeys: stringList(body.richTextKeys, MAX_KEYS, MAX_KEY_LENGTH),
      imageFieldKeys: stringList(body.imageFieldKeys, MAX_KEYS, MAX_KEY_LENGTH),
      extraTableRows: extraTableRows(body.extraTableRows),
      deletedTableRows: deletedTableRows(body.deletedTableRows),
    });
  } catch (error) {
    console.error(
      '[generated-workflow] document fill error:',
      error instanceof Error ? error.name : 'unknown',
    );
    return documentTemplateFailure(422, 'DOCUMENT_FILL_FAILED');
  }
  const filename = safeDocxFilename(
    body.outputFilename,
    template.filename,
    template.title,
  );
  return new NextResponse(new Uint8Array(document), {
    status: 200,
    headers: {
      ...DOCUMENT_TEMPLATE_NO_STORE_HEADERS,
      'Content-Type': DOCX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(document.byteLength),
    },
  });
}
