import { createHash } from 'node:crypto';

/** JSON-safe field definition emitted by the no-code builder snapshot. */
export interface GeneratedWorkflowField {
  id?: string;
  label?: string;
  name?: string;
  type?: string;
  required?: boolean;
  helpText?: string;
  options?: string[];
  replaces?: string[];
}

/** JSON-safe output kinds declared by a canonical guided block. */
export type GeneratedWorkflowSmartBlockValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'file'
  | 'object'
  | 'unknown';

/** Source references resolved without executing platform-only builder adapters. */
export type GeneratedWorkflowSourceBinding =
  | { kind: 'workflow-field'; fieldId: string; stepId?: string }
  | {
      kind: 'block-output';
      blockInstanceId: string;
      outputName: string;
    }
  | { kind: 'step-output'; stepId: string; outputName: string }
  | { kind: 'workflow-output'; workflowId: string; outputName: string }
  | { kind: 'object-type'; objectType: string; field?: string }
  | { kind: 'literal'; value: unknown };

/** Named output persisted by a canonical guided block. */
export interface GeneratedWorkflowSmartBlockOutput {
  name: string;
  valueType: GeneratedWorkflowSmartBlockValueType;
  collection?: boolean;
  required?: boolean;
}

/** Canonical reusable block embedded in an immutable respondent step. */
export interface GeneratedWorkflowSmartBlockInstance {
  id: string;
  blockId: string;
  order: number;
  config: {
    presentationConfig: Record<string, unknown>;
    dataConfig: Record<string, unknown>;
    businessLogic: Record<string, unknown>;
    accessControl: Record<string, unknown>;
    actionsConfig: Record<string, unknown>;
  };
  bindings: Record<string, GeneratedWorkflowSourceBinding>;
  outputs?: GeneratedWorkflowSmartBlockOutput[];
}

/** Ordered respondent step stored in the immutable workflow snapshot. */
export interface GeneratedWorkflowStep {
  id?: string;
  title?: string;
  name?: string;
  description?: string;
  fields?: GeneratedWorkflowField[];
  blocks?: GeneratedWorkflowSmartBlockInstance[];
}

/** Canonical workflow bytes rendered by a generated deployment. */
export interface GeneratedWorkflowSnapshot {
  steps: GeneratedWorkflowStep[];
  reasoning?: string;
  originalStepCount?: number;
}

/** Source-controlled binding that authorizes one immutable template version. */
export interface GeneratedAppRuntimeBinding {
  schemaVersion: 'eai.generated_app_runtime_binding.v1';
  workflowTemplate: {
    id: string;
    version: number;
    digest: `sha256:${string}`;
    title: string;
  };
  respondentAccess: {
    mode: 'anonymous';
    submissionObjectType: 'workflow-submission';
    fileObjectType: 'submission-file';
  };
}

/** Validated server runtime passed to the anonymous renderer and BFF. */
export interface GeneratedWorkflowRuntime {
  appKey: string;
  tenantId: string;
  binding: GeneratedAppRuntimeBinding;
  snapshot: GeneratedWorkflowSnapshot;
}

/** Fail-closed resolution state while preserving an unbound generic template. */
export type GeneratedWorkflowRuntimeResolution =
  | { status: 'unconfigured' }
  | { status: 'invalid'; errors: string[] }
  | { status: 'ready'; runtime: GeneratedWorkflowRuntime };

const APP_KEY_PATTERN = /^[a-z][a-z0-9-]{1,62}$/;
const SHA256_DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${stableStringify(entryValue)}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Recomputes the canonical source digest used by export and readiness. */
export function generatedWorkflowSnapshotDigest(
  snapshot: GeneratedWorkflowSnapshot,
): `sha256:${string}` {
  return `sha256:${createHash('sha256')
    .update(`${stableStringify(snapshot)}\n`, 'utf8')
    .digest('hex')}`;
}

/** Narrows imported JSON to a non-empty respondent workflow snapshot. */
export function validateGeneratedWorkflowSnapshot(
  value: unknown,
): value is GeneratedWorkflowSnapshot {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !Array.isArray((value as GeneratedWorkflowSnapshot).steps) ||
    (value as GeneratedWorkflowSnapshot).steps.length === 0
  ) {
    return false;
  }
  return (value as GeneratedWorkflowSnapshot).steps.every(
    (step) =>
      step &&
      typeof step === 'object' &&
      (!step.blocks ||
        (Array.isArray(step.blocks) &&
          step.blocks.every(
            (block) =>
              block &&
              typeof block.id === 'string' &&
              Boolean(block.id.trim()) &&
              typeof block.blockId === 'string' &&
              Boolean(block.blockId.trim()) &&
              typeof block.order === 'number' &&
              Number.isInteger(block.order) &&
              block.config &&
              typeof block.config === 'object' &&
              block.bindings &&
              typeof block.bindings === 'object' &&
              (!block.outputs || Array.isArray(block.outputs)),
          ))),
  );
}

/** Enforces the locked runtime binding and analytics object-type aliases. */
export function validateGeneratedAppRuntimeBinding(
  value: unknown,
): value is GeneratedAppRuntimeBinding {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const binding = value as Partial<GeneratedAppRuntimeBinding>;
  const template = binding.workflowTemplate;
  const access = binding.respondentAccess;
  return (
    binding.schemaVersion === 'eai.generated_app_runtime_binding.v1' &&
    Boolean(
      template &&
      typeof template.id === 'string' &&
      template.id.trim() &&
      typeof template.version === 'number' &&
      Number.isInteger(template.version) &&
      template.version >= 1 &&
      typeof template.digest === 'string' &&
      SHA256_DIGEST_PATTERN.test(template.digest) &&
      typeof template.title === 'string' &&
      template.title.trim(),
    ) &&
    access?.mode === 'anonymous' &&
    access.submissionObjectType === 'workflow-submission' &&
    access.fileObjectType === 'submission-file'
  );
}

/** Rejects source drift before any workflow UI or anonymous BFF route is enabled. */
export function resolveGeneratedWorkflowRuntime(args: {
  appKey: unknown;
  config: unknown;
  snapshot: unknown;
}): GeneratedWorkflowRuntimeResolution {
  if (!args.config || typeof args.config !== 'object') {
    return { status: 'unconfigured' };
  }
  const config = args.config as {
    tenantId?: unknown;
    runtimeBinding?: unknown;
  };
  if (config.runtimeBinding === undefined) {
    return { status: 'unconfigured' };
  }

  const errors: string[] = [];
  if (typeof args.appKey !== 'string' || !APP_KEY_PATTERN.test(args.appKey)) {
    errors.push('appKey is invalid.');
  }
  if (typeof config.tenantId !== 'string' || !config.tenantId.trim()) {
    errors.push('tenantId is missing.');
  }
  if (!validateGeneratedAppRuntimeBinding(config.runtimeBinding)) {
    errors.push('runtimeBinding is invalid.');
  }
  if (!validateGeneratedWorkflowSnapshot(args.snapshot)) {
    errors.push('workflow snapshot is invalid.');
  }
  if (errors.length > 0) {
    return { status: 'invalid', errors };
  }

  const binding = config.runtimeBinding as GeneratedAppRuntimeBinding;
  const snapshot = args.snapshot as GeneratedWorkflowSnapshot;
  if (
    generatedWorkflowSnapshotDigest(snapshot) !==
    binding.workflowTemplate.digest
  ) {
    return {
      status: 'invalid',
      errors: ['workflow snapshot digest does not match runtimeBinding.'],
    };
  }

  return {
    status: 'ready',
    runtime: {
      appKey: args.appKey as string,
      tenantId: config.tenantId as string,
      binding,
      snapshot,
    },
  };
}
