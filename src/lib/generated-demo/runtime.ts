import artifact from '@/eai.config/generated-demo.json';
import { generatedWorkflowAppKey } from '@/lib/generated-workflow/runtime';
import {
  resolveGeneratedDemoRuntime,
  type GeneratedDemoRuntimeResolution,
} from './runtime-contract';

let cached:
  { appKey: string; resolution: GeneratedDemoRuntimeResolution } | undefined;

export function getGeneratedDemoRuntime(): GeneratedDemoRuntimeResolution {
  const appKey = generatedWorkflowAppKey();
  if (cached?.appKey === appKey) return cached.resolution;
  const resolution = resolveGeneratedDemoRuntime(artifact as unknown, appKey);
  cached = { appKey, resolution };
  return resolution;
}
