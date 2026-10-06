'use client';

import {
  TemplateFormFill,
  type TemplateFormFillActionFn,
  type TemplateFormFillProps,
} from '@enterpriseaigroup/core';
import {
  QueryClient,
  QueryClientContext,
  QueryClientProvider,
} from '@tanstack/react-query';
import {
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { apiUrl } from '@/lib/api-helpers';
import {
  boundedDocumentAnswers,
  plainTextToRichTextHtml,
  richTextHtmlToPlainText,
  type DocumentCreationField,
} from '@/lib/generated-workflow/document-creation';

/** A same-origin document-template action served by this app's BFF. */
export type DocumentTemplateAction =
  | 'extract-placeholders'
  | 'ai-field-mapper'
  | 'template-fill';

type TemplateStructure = Omit<
  NonNullable<TemplateFormFillProps['templatePlaceholders']>,
  'loading' | 'error'
>;

type StructureState =
  | { status: 'loading' }
  | { status: 'ready'; value: TemplateStructure }
  | { status: 'error' };

const ANSWER_SETTLE_MS = 750;
const BUSINESS_LOGIC: TemplateFormFillProps['businessLogic'] = {
  chatbotEnabled: false,
  exportFormats: ['docx'],
};
const LOAD_ERROR = 'The document template could not be loaded.';

function postAction(
  action: DocumentTemplateAction,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(apiUrl(`/api/eai/document-template/${action}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Routes TemplateFormFill's platform actions to this app's document-template
 * routes for one bound template. AI-written HTML is shown as plain text in the
 * textarea fallback and turned back into `<p>` HTML for rich-text blanks.
 */
export function documentTemplateActionHandler(
  templateId: string,
): TemplateFormFillActionFn {
  return async (payload) => {
    if (payload.type === 'aiFieldMapper') {
      const response = await postAction('ai-field-mapper', {
        templateId,
        unmatchedPlaceholders: payload.unmatchedPlaceholders,
        placeholderMeta: payload.placeholderMeta.map(
          ({ key, suggestedType, suggestedLabel }) => ({
            key,
            suggestedType,
            suggestedLabel,
          }),
        ),
        brContext: boundedDocumentAnswers(payload.brContext),
      });
      if (!response.ok) return response;
      const data = (await response.json().catch(() => null)) as {
        mappedFields?: unknown;
      } | null;
      const mappedFields: Record<string, string> = {};
      if (data?.mappedFields && typeof data.mappedFields === 'object') {
        for (const [key, value] of Object.entries(data.mappedFields)) {
          if (typeof value === 'string')
            mappedFields[key] = richTextHtmlToPlainText(value);
        }
      }
      return jsonResponse({ mappedFields });
    }
    if (payload.type === 'templateFill') {
      const richTextKeys = new Set(payload.richTextKeys ?? []);
      const placeholders = Object.fromEntries(
        Object.entries(payload.placeholders).map(([key, value]) => [
          key,
          richTextKeys.has(key) && typeof value === 'string'
            ? plainTextToRichTextHtml(value)
            : value,
        ]),
      );
      return postAction('template-fill', {
        templateId,
        placeholders,
        richTextKeys: payload.richTextKeys,
        imageFieldKeys: payload.imageFieldKeys,
        extraTableRows: payload.extraTableRows,
        deletedTableRows: payload.deletedTableRows,
        outputFilename: payload.outputFilename,
      });
    }
    return jsonResponse({ error: 'not-implemented' }, 501);
  };
}

async function loadTemplateStructure(
  templateId: string,
  signal: AbortSignal,
): Promise<TemplateStructure> {
  const response = await postAction(
    'extract-placeholders',
    { templateId },
    signal,
  );
  if (!response.ok) throw new Error(LOAD_ERROR);
  const data = (await response.json()) as Partial<TemplateStructure> | null;
  return {
    placeholders: Array.isArray(data?.placeholders) ? data.placeholders : [],
    sections: Array.isArray(data?.sections) ? data.sections : [],
    conditionalKeys: Array.isArray(data?.conditionalKeys)
      ? data.conditionalKeys
      : [],
  };
}

/** Keeps the latest value only after it stops changing, so typing does not remount the document. */
function useSettledValue<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

/** TemplateFormFill needs react-query; reuse the app's client or supply one. */
function EnsureQueryClient({ children }: { children: ReactNode }) {
  const ambient = useContext(QueryClientContext);
  const [fallback] = useState(() => (ambient ? null : new QueryClient()));
  if (!fallback) return <>{children}</>;
  return (
    <QueryClientProvider client={fallback}>{children}</QueryClientProvider>
  );
}

interface DocumentCreationBlockProps {
  field: DocumentCreationField;
  /** Answers so far, keyed by field id; typed blanks with the same name are pre-filled. */
  answers: Record<string, string>;
  /** Non-empty marker TemplateFormFill requires before it runs AI pre-fill. */
  tenantId: string;
}

/**
 * The AI Document Creation step: the app's own Word template, pre-filled from
 * the answers so far. Typed answers fill blanks with the same name, AI writes
 * the rest, and the respondent can edit before downloading the .docx.
 */
export function DocumentCreationBlock({
  field,
  answers,
  tenantId,
}: DocumentCreationBlockProps) {
  const templateId = field.templateId;
  const title = field.label || 'Document';
  const [structure, setStructure] = useState<StructureState>({
    status: 'loading',
  });

  useEffect(() => {
    const controller = new AbortController();
    setStructure({ status: 'loading' });
    loadTemplateStructure(templateId, controller.signal).then(
      (value) => {
        if (!controller.signal.aborted)
          setStructure({ status: 'ready', value });
      },
      () => {
        if (!controller.signal.aborted) setStructure({ status: 'error' });
      },
    );
    return () => controller.abort();
  }, [templateId]);

  const onTemplateAction = useMemo(
    () => documentTemplateActionHandler(templateId),
    [templateId],
  );
  const answersKey = useSettledValue(
    JSON.stringify(withoutRecordId(answers)),
    ANSWER_SETTLE_MS,
  );
  const businessRequest = useMemo(
    () => JSON.parse(answersKey) as Record<string, string>,
    [answersKey],
  );
  const documentTemplates = useMemo(
    () => [
      {
        id: templateId,
        title,
        filename: `${templateId}.docx`,
        url: `template:${templateId}`,
      },
    ],
    [templateId, title],
  );
  const templatePlaceholders = useMemo(() => {
    const loaded = structure.status === 'ready' ? structure.value : undefined;
    return {
      placeholders: loaded?.placeholders ?? [],
      sections: loaded?.sections ?? [],
      conditionalKeys: loaded?.conditionalKeys ?? [],
      loading: structure.status === 'loading',
      error: structure.status === 'error' ? LOAD_ERROR : null,
    };
  }, [structure]);

  return (
    <section
      aria-label={title}
      data-eai-document-template={templateId}
      className='rounded-md border'
    >
      <EnsureQueryClient>
        <TemplateFormFill
          // The block pre-fills once per mount, so settled new answers remount it.
          key={answersKey}
          tenantId={tenantId}
          businessRequest={businessRequest}
          documentTemplates={documentTemplates}
          templatePlaceholders={templatePlaceholders}
          businessLogic={BUSINESS_LOGIC}
          presentationConfig={{ title, description: '', height: 'auto' }}
          onTemplateAction={onTemplateAction}
        />
      </EnsureQueryClient>
    </section>
  );
}

/** Drops any record `id` so it is never mistaken for a stored business request. */
function withoutRecordId(
  answers: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(answers).filter(([key]) => key !== 'id'),
  );
}
