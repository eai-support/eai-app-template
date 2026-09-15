import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

const MAX_FORM_DATA_CHARS = 256 * 1024;
const MAX_TEXT_LENGTH = 200;
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MAX_ASSISTANT_MESSAGES = 100;
const MAX_ASSISTANT_HISTORY_CHARS = 256 * 1024;

export interface PersistedAssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface OriginAwareRequest {
  headers: Headers;
  nextUrl: { origin: string };
}

function lastForwardedValue(value: string | null): string | null {
  const values = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return values.at(-1) ?? null;
}

function canonicalHttpOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function forwardedOrigin(headers: Headers): string | null {
  const protocol = lastForwardedValue(headers.get('x-forwarded-proto'));
  const host =
    lastForwardedValue(headers.get('x-forwarded-host')) ??
    headers.get('host')?.trim() ??
    null;
  if (!protocol || !host || host.includes(',')) return null;
  return canonicalHttpOrigin(`${protocol.toLowerCase()}://${host}`);
}

/** Accepts the browser origin or the rightmost origin appended by the ingress proxy. */
export function requestHasSameOrigin(request: OriginAwareRequest): boolean {
  const browserOrigin = canonicalHttpOrigin(request.headers.get('origin'));
  if (!browserOrigin) return false;
  return (
    browserOrigin === canonicalHttpOrigin(request.nextUrl.origin) ||
    browserOrigin === forwardedOrigin(request.headers)
  );
}

/** Anonymous autosave fields accepted by the same-origin BFF. */
export interface SubmissionPatch {
  status?: 'completed';
  currentStep?: number;
  formData?: Record<string, unknown>;
  userName?: string;
  userEmail?: string;
  assistantMessages?: PersistedAssistantMessage[];
}

export function readPersistedAssistantMessages(
  value: unknown,
): PersistedAssistantMessage[] {
  if (!Array.isArray(value) || value.length > MAX_ASSISTANT_MESSAGES) return [];
  const messages: PersistedAssistantMessage[] = [];
  let total = 0;
  for (const entry of value) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const { role, content } = entry as Record<string, unknown>;
    const limit = role === 'user' ? 2000 : role === 'assistant' ? 4000 : 0;
    if (
      !limit ||
      typeof content !== 'string' ||
      !content.trim() ||
      content.length > limit
    )
      return [];
    total += content.length;
    if (total > MAX_ASSISTANT_HISTORY_CHARS) return [];
    messages.push({ role, content } as PersistedAssistantMessage);
  }
  return messages;
}

/** Resolves the ACA-appended client address without trusting caller prefixes. */
export function requestClientIp(headers: Headers): string {
  const forwarded = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => isIP(value) !== 0);
  const realIp = headers.get('x-real-ip')?.trim() ?? '';
  return forwarded.at(-1) || (isIP(realIp) ? realIp : 'unknown');
}

/** Produces the pseudonymous key enforced in PublicAPI's shared rate-limit store. */
export function requestClientFingerprint(headers: Headers): string {
  return `sha256:${createHash('sha256')
    .update(requestClientIp(headers), 'utf8')
    .digest('hex')}`;
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
  if (input.assistantMessages !== undefined) {
    const messages = readPersistedAssistantMessages(input.assistantMessages);
    if (
      !Array.isArray(input.assistantMessages) ||
      messages.length !== input.assistantMessages.length
    ) {
      return { ok: false, message: 'Invalid assistant history.' };
    }
    patch.assistantMessages = messages;
  }
  return { ok: true, value: patch };
}
