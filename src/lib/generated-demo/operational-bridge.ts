import type { GeneratedOperationalRows } from './operational-read';
import type { DemoJson } from './contract';

const NONCE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_BYTES = 128_000;
const FORBIDDEN_KEYS = /(?:authorization|token|secret|credential|url|uri|endpoint)$/i;
const PROTOTYPE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).sort().join('|') === [...keys].sort().join('|');
}

function safeValue(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => safeValue(item, depth + 1));
  return record(value) && Object.entries(value).every(([key, item]) =>
    !PROTOTYPE_KEYS.has(key) && !FORBIDDEN_KEYS.test(key) && safeValue(item, depth + 1));
}

export interface OperationalReadyMessage {
  type: 'eai.generated.operational.ready.v1';
  nonce: string;
  acceptedArtifactDigest: string;
}

export interface OperationalAckMessage {
  type: 'eai.generated.operational.ack.v1';
  nonce: string;
  acceptedArtifactDigest: string;
}

export interface OperationalDataMessage {
  type: 'eai.generated.operational.data.v1';
  nonce: string;
  acceptedArtifactDigest: string;
  fixtureCollection: string;
  rows: Array<Record<string, DemoJson>>;
}

export function isOperationalReadyMessage(
  value: unknown, nonce: string, digest: string,
): value is OperationalReadyMessage {
  return record(value) &&
    exactKeys(value, ['type', 'nonce', 'acceptedArtifactDigest']) &&
    value.type === 'eai.generated.operational.ready.v1' &&
    value.nonce === nonce && NONCE.test(nonce) &&
    value.acceptedArtifactDigest === digest;
}

export function isOperationalAckMessage(
  value: unknown, nonce: string, digest: string,
): value is OperationalAckMessage {
  return record(value) &&
    exactKeys(value, ['type', 'nonce', 'acceptedArtifactDigest']) &&
    value.type === 'eai.generated.operational.ack.v1' &&
    value.nonce === nonce && NONCE.test(nonce) &&
    value.acceptedArtifactDigest === digest;
}

export function isOperationalDataMessage(
  value: unknown, nonce: string, digest: string, collection: string, maxRows: number,
): value is OperationalDataMessage {
  if (!record(value) || !exactKeys(value, [
    'type', 'nonce', 'acceptedArtifactDigest', 'fixtureCollection', 'rows',
  ]) || value.type !== 'eai.generated.operational.data.v1' ||
      value.nonce !== nonce || !NONCE.test(nonce) ||
      value.acceptedArtifactDigest !== digest ||
      value.fixtureCollection !== collection ||
      !Array.isArray(value.rows) || value.rows.length > maxRows ||
      !value.rows.every(record) || !safeValue(value.rows)) return false;
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= MAX_MESSAGE_BYTES;
  } catch {
    return false;
  }
}

export function isOperationalRowsResponse(
  value: unknown, digest: string, collection: string, maxRows: number,
): value is GeneratedOperationalRows {
  return record(value) &&
    exactKeys(value, ['schemaVersion', 'acceptedArtifactDigest', 'fixtureCollection', 'rows']) &&
    value.schemaVersion === 'eai.generated_app_operational_rows.v1' &&
    isOperationalDataMessage({
      type: 'eai.generated.operational.data.v1',
      nonce: '11111111-1111-4111-8111-111111111111',
      acceptedArtifactDigest: value.acceptedArtifactDigest,
      fixtureCollection: value.fixtureCollection,
      rows: value.rows,
    }, '11111111-1111-4111-8111-111111111111', digest, collection, maxRows);
}
