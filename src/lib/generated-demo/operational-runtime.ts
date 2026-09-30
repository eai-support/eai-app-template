import operationalConfig from '@/eai.config/generated-operational.json';
import { generatedWorkflowAppKey } from '@/lib/generated-workflow/runtime';
import { getGeneratedDemoRuntime } from './runtime';
import {
  resolveGeneratedOperationalRuntime,
  type GeneratedOperationalResolution,
} from './operational-contract';

/** A missing server-owned tenant identity never enables a live data binding. */
export function getGeneratedOperationalRuntime(): GeneratedOperationalResolution {
  if (operationalConfig === null) return { status: 'unconfigured' };
  if (process.env.EAI_GENERATED_OPERATIONAL_READ_ENABLED !== 'true') {
    return { status: 'invalid', errors: ['operational reads are not enabled'] };
  }
  const demo = getGeneratedDemoRuntime();
  if (demo.status !== 'ready')
    return { status: 'invalid', errors: ['accepted demo artifact is unavailable'] };
  return resolveGeneratedOperationalRuntime(
    operationalConfig as unknown,
    demo.artifact,
    process.env.EAI_TENANT_ID || process.env.TENANT_DEFAULT_ID,
    generatedWorkflowAppKey(),
  );
}
