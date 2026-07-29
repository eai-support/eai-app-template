const hits = new Map<string, number[]>();
const MAX_FORM_DATA_CHARS = 256 * 1024;
const MAX_TEXT_LENGTH = 200;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SWEEP_EVERY = 1000;
let requestsSinceSweep = 0;

/** Anonymous autosave fields accepted by the same-origin BFF. */
export interface SubmissionPatch {
  status?: 'completed';
  currentStep?: number;
  formData?: Record<string, unknown>;
  userName?: string;
  userEmail?: string;
}

/** Resolves the proxy-provided client address used only for local rate buckets. */
export function requestClientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}

/** Applies a bounded per-instance abuse guard ahead of the PublicAPI facade. */
export function allowRequest(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): boolean {
  const cutoff = now - windowMs;
  requestsSinceSweep += 1;
  if (requestsSinceSweep >= SWEEP_EVERY) {
    requestsSinceSweep = 0;
    for (const [bucketKey, times] of hits) {
      if (times.length === 0 || times[times.length - 1]! <= cutoff) {
        hits.delete(bucketKey);
      }
    }
  }
  const recent = (hits.get(key) ?? []).filter((time) => time > cutoff);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

/** Removes unknown fields and bounds anonymous autosave/completion payloads. */
export function validateSubmissionPatch(
  value: unknown,
): { ok: true; value: SubmissionPatch } | { ok: false; message: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, message: 'Invalid request body.' };
  }
  const input = value as Record<string, unknown>;
  const patch: SubmissionPatch = {};
  if (input.status !== undefined) {
    if (input.status !== 'completed') {
      return { ok: false, message: 'Invalid submission status.' };
    }
    patch.status = 'completed';
  }
  if (input.currentStep !== undefined) {
    if (
      typeof input.currentStep !== 'number' ||
      !Number.isInteger(input.currentStep) ||
      input.currentStep < 0 ||
      input.currentStep > 100
    ) {
      return { ok: false, message: 'Invalid current step.' };
    }
    patch.currentStep = input.currentStep;
  }
  if (input.formData !== undefined) {
    if (
      !input.formData ||
      typeof input.formData !== 'object' ||
      Array.isArray(input.formData)
    ) {
      return { ok: false, message: 'Invalid form data.' };
    }
    let serialized: string;
    try {
      serialized = JSON.stringify(input.formData);
    } catch {
      return { ok: false, message: 'Invalid form data.' };
    }
    if (serialized.length > MAX_FORM_DATA_CHARS) {
      return { ok: false, message: 'Form data is too large.' };
    }
    patch.formData = input.formData as Record<string, unknown>;
  }
  if (input.userName !== undefined) {
    if (
      typeof input.userName !== 'string' ||
      input.userName.length > MAX_TEXT_LENGTH
    ) {
      return { ok: false, message: 'Invalid respondent name.' };
    }
    patch.userName = input.userName;
  }
  if (input.userEmail !== undefined) {
    if (
      typeof input.userEmail !== 'string' ||
      input.userEmail.length > MAX_TEXT_LENGTH ||
      (input.userEmail !== '' && !EMAIL_PATTERN.test(input.userEmail))
    ) {
      return { ok: false, message: 'Invalid respondent email.' };
    }
    patch.userEmail = input.userEmail;
  }
  return { ok: true, value: patch };
}

export function __resetGeneratedWorkflowRateLimit(): void {
  hits.clear();
  requestsSinceSweep = 0;
}
