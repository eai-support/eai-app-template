export const SUBMISSION_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const SUBMISSION_FILE_MAX_COUNT = 5;
export const SUBMISSION_FILE_MAX_TOTAL_BYTES = 25 * 1024 * 1024;

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

interface PendingSubmissionFile {
  stepId: string;
  fieldId: string;
  fileSize: number;
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
/** File suffixes supported by the generated-runtime upload boundary. */
export type SubmissionFileExtension =
  (typeof SUBMISSION_FILE_ACCEPTED_EXTENSIONS)[number];

/** Resolve a file field's explicit allowlist, retaining compatibility with older snapshots. */
export function submissionFileAcceptedExtensions(
  configured: readonly string[] | undefined,
): readonly SubmissionFileExtension[] {
  if (configured === undefined) return SUBMISSION_FILE_ACCEPTED_EXTENSIONS;
  const supported = configured.filter(
    (extension): extension is SubmissionFileExtension =>
      (SUBMISSION_FILE_ACCEPTED_EXTENSIONS as readonly string[]).includes(
        extension,
      ),
  );
  return supported.length === configured.length &&
    new Set(supported).size === supported.length
    ? supported
    : [];
}

/** Build the browser accept hint from the same allowlist enforced by the BFF. */
export function submissionFileAccept(
  configured: readonly string[] | undefined,
): string {
  return submissionFileAcceptedExtensions(configured)
    .map((extension) => `.${extension}`)
    .join(',');
}

const DENIED_MIME_TYPES = new Set(['text/html', 'image/svg+xml']);

/** Converts browser file names to the bounded leaf name accepted by PublicAPI. */
export function sanitizeSubmissionFileName(value: string): string {
  const leaf = value.split(/[\\/]/).pop()?.trim() || 'upload.bin';
  return leaf.replace(/[^\w.\- ()]/g, '_').slice(0, 160) || 'upload.bin';
}

/** Applies the same size, extension, and active-content denylist as the facade. */
export function validateSubmissionFile(
  file: {
    name: string;
    size: number;
    type: string;
  },
  configuredExtensions?: readonly string[],
): string | null {
  if (file.size <= 0) return 'File is empty.';
  if (file.size > SUBMISSION_FILE_MAX_BYTES) {
    return 'File is too large (max 10MB).';
  }
  const lastDot = file.name.lastIndexOf('.');
  const extension =
    lastDot > 0 && lastDot < file.name.length - 1
      ? file.name.slice(lastDot + 1).toLowerCase()
      : '';
  const acceptedExtensions =
    submissionFileAcceptedExtensions(configuredExtensions);
  if (
    !acceptedExtensions.includes(extension as SubmissionFileExtension) ||
    DENIED_MIME_TYPES.has(file.type.toLowerCase())
  ) {
    return 'Unsupported file type.';
  }
  return null;
}

/** Enforce aggregate limits while allowing an existing field upload to be replaced. */
export function validateSubmissionFileCollection(
  files: readonly SubmissionFileRef[],
  pending: PendingSubmissionFile,
): string | null {
  const retainedFiles = files.filter(
    (file) =>
      file.stepId !== pending.stepId || file.fieldId !== pending.fieldId,
  );
  if (retainedFiles.length + 1 > SUBMISSION_FILE_MAX_COUNT) {
    return 'A submission can contain up to 5 files.';
  }
  const totalBytes = retainedFiles.reduce(
    (total, file) => total + file.fileSize,
    pending.fileSize,
  );
  if (totalBytes > SUBMISSION_FILE_MAX_TOTAL_BYTES) {
    return 'Submission files can total up to 25MB.';
  }
  return null;
}
