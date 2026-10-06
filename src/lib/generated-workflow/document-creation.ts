import type {
  GeneratedWorkflowField,
  GeneratedWorkflowSnapshot,
} from './runtime-contract';

/** `blockType` of the AI Document Creation smart_block field. */
export const DOCUMENT_CREATION_BLOCK_TYPE = 'document-creation';

/** Answer limits forwarded to PublicAPI as AI field-mapping context. */
export const MAX_DOCUMENT_ANSWER_KEYS = 64;
export const MAX_DOCUMENT_ANSWER_LENGTH = 4000;
const MAX_DOCUMENT_ANSWER_KEY_LENGTH = 160;
const MAX_TEMPLATE_ID_LENGTH = 200;

/** A smart_block field bound to one document template. */
export type DocumentCreationField = GeneratedWorkflowField & {
  type: 'smart_block';
  blockType: typeof DOCUMENT_CREATION_BLOCK_TYPE;
  templateId: string;
};

/** True for the AI Document Creation field shape exported by the no-code builder. */
export function isDocumentCreationField(
  field: GeneratedWorkflowField | undefined,
): field is DocumentCreationField {
  return Boolean(
    field &&
    field.type === 'smart_block' &&
    field.blockType === DOCUMENT_CREATION_BLOCK_TYPE &&
    typeof field.templateId === 'string' &&
    field.templateId.trim() &&
    field.templateId.length <= MAX_TEMPLATE_ID_LENGTH,
  );
}

/** Returns the snapshot's document field bound to `templateId`, if any. */
export function findDocumentCreationField(
  snapshot: GeneratedWorkflowSnapshot,
  templateId: unknown,
): DocumentCreationField | undefined {
  if (typeof templateId !== 'string' || !templateId) return undefined;
  for (const step of snapshot.steps) {
    const field = (step.fields ?? []).find(
      (candidate) =>
        isDocumentCreationField(candidate) &&
        candidate.templateId === templateId,
    );
    if (field) return field as DocumentCreationField;
  }
  return undefined;
}

/** Answers keyed by field id, as the template's typed blanks name them; files, block outputs and empty answers are left out. */
export function documentCreationAnswers(
  formData: Record<string, Record<string, unknown>>,
): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const stepValues of Object.values(formData)) {
    if (!stepValues || typeof stepValues !== 'object') continue;
    for (const [fieldId, value] of Object.entries(stepValues)) {
      if (fieldId === 'id') continue;
      if (typeof value === 'string' && value.trim()) answers[fieldId] = value;
      else if (typeof value === 'number' || typeof value === 'boolean')
        answers[fieldId] = String(value);
    }
  }
  return answers;
}

/** Bounds untrusted answers to string values PublicAPI accepts as AI mapping context. */
export function boundedDocumentAnswers(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const answers: Record<string, string> = {};
  for (const [key, answer] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (Object.keys(answers).length >= MAX_DOCUMENT_ANSWER_KEYS) break;
    if (
      key === 'id' ||
      !key.trim() ||
      key.length > MAX_DOCUMENT_ANSWER_KEY_LENGTH ||
      typeof answer !== 'string' ||
      !answer.trim()
    ) {
      continue;
    }
    answers[key] = answer.slice(0, MAX_DOCUMENT_ANSWER_LENGTH);
  }
  return answers;
}

const RICH_TEXT_TAG =
  /<\/?(?:p|div|span|br|strong|b|em|i|u|s|strike|del|sub|sup|code|h[1-6]|a|blockquote|ul|ol|li|table|thead|tbody|tfoot|tr|td|th|font|mark)(?:\s[^>]*)?\/?>/i;
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

function decodeEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (entity, body: string) => {
      const lower = body.toLowerCase();
      if (lower.startsWith('#')) {
        const codePoint = lower.startsWith('#x')
          ? Number.parseInt(lower.slice(2), 16)
          : Number.parseInt(lower.slice(1), 10);
        return Number.isFinite(codePoint) &&
          codePoint > 0 &&
          codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : entity;
      }
      return NAMED_ENTITIES[lower] ?? entity;
    },
  );
}

/**
 * Shows AI-written HTML as plain-text paragraphs in the template's textarea
 * fallback; values that are not HTML are returned unchanged.
 */
export function richTextHtmlToPlainText(value: string): string {
  if (!RICH_TEXT_TAG.test(value)) return value;
  const text = value
    .replace(/\r\n?/g, '\n')
    .replace(/\n/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li(?:\s[^>]*)?>/gi, '• ')
    .replace(/<\/li\s*>/gi, '\n')
    .replace(/<\/(?:p|div|h[1-6]|blockquote|tr|ul|ol)\s*>/gi, '\n\n')
    .replace(/<[^>]*>/g, '');
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Turns textarea paragraphs back into the `<p>` HTML the template fill expects for rich-text blanks. */
export function plainTextToRichTextHtml(value: string): string {
  const text = value.replace(/\r\n?/g, '\n').trim();
  if (!text) return '';
  return text
    .split(/\n[ \t]*\n+/)
    .map(
      (paragraph) =>
        `<p>${paragraph
          .split('\n')
          .map((line) => escapeHtml(line.trim()))
          .join('<br>')}</p>`,
    )
    .join('');
}
