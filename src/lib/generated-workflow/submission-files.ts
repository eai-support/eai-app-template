export const SUBMISSION_FILE_MAX_BYTES = 10 * 1024 * 1024;

/** Opaque uploaded-file reference accepted in a workflow submission payload. */
export interface SubmissionFileRef {
  submissionFileId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  uploadedAt: string;
  stepId: string;
  fieldId: string;
}

/** Validate the bounded file-reference shape before it enters a submission. */
export function isSubmissionFileRef(
  value: unknown,
): value is SubmissionFileRef {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const file = value as Partial<SubmissionFileRef>;
  return (
    typeof file.submissionFileId === 'string' &&
    /^[A-Za-z0-9_-]{1,160}$/.test(file.submissionFileId) &&
    typeof file.fileName === 'string' &&
    file.fileName.length > 0 &&
    file.fileName.length <= 160 &&
    typeof file.fileSize === 'number' &&
    Number.isInteger(file.fileSize) &&
    file.fileSize > 0 &&
    file.fileSize <= SUBMISSION_FILE_MAX_BYTES &&
    typeof file.contentType === 'string' &&
    typeof file.uploadedAt === 'string' &&
    typeof file.stepId === 'string' &&
    typeof file.fieldId === 'string'
  );
}
export const SUBMISSION_FILE_ACCEPTED_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'txt',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'heic',
  'csv',
  'xlsx',
  'xls',
  'json',
  'geojson',
] as const;
export const SUBMISSION_FILE_ACCEPT = SUBMISSION_FILE_ACCEPTED_EXTENSIONS.map(
  (extension) => `.${extension}`,
).join(',');

const DENIED_MIME_TYPES = new Set(['text/html', 'image/svg+xml']);

/** Converts browser file names to the bounded leaf name accepted by PublicAPI. */
export function sanitizeSubmissionFileName(value: string): string {
  const leaf = value.split(/[\\/]/).pop()?.trim() || 'upload.bin';
  return leaf.replace(/[^\w.\- ()]/g, '_').slice(0, 160) || 'upload.bin';
}

/** Applies the same size, extension, and active-content denylist as the facade. */
export function validateSubmissionFile(file: {
  name: string;
  size: number;
  type: string;
}): string | null {
  if (file.size <= 0) return 'File is empty.';
  if (file.size > SUBMISSION_FILE_MAX_BYTES) {
    return 'File is too large (max 10MB).';
  }
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (
    !(SUBMISSION_FILE_ACCEPTED_EXTENSIONS as readonly string[]).includes(
      extension,
    ) ||
    DENIED_MIME_TYPES.has(file.type.toLowerCase())
  ) {
    return 'Unsupported file type.';
  }
  return null;
}
