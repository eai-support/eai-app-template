export const APP_CAPABILITY_SCHEMA = 'eai.app_capabilities.v1' as const;

/** Stable PublicAPI capability keys supported by this generated-app contract. */
export type AppCapabilityKind =
  | 'ai.chat'
  | 'ai.profiles'
  | 'integrations'
  | 'workflows.runtime';

/** Logical requirement only; environment-specific resolution remains server-side. */
export interface AppCapabilityRequirement {
  readonly alias: string;
  readonly capability: AppCapabilityKind;
  readonly required: boolean;
  readonly description: string;
}

/** Versioned generated-app manifest that cannot carry tenant records or secrets. */
export interface AppCapabilityRequirements {
  readonly schemaVersion: typeof APP_CAPABILITY_SCHEMA;
  readonly appKey: string;
  readonly requirements: readonly AppCapabilityRequirement[];
}

/**
 * Generated apps declare logical aliases only. Tenant records, provider
 * credentials, prompt bodies, and model settings remain in the control plane.
 */
export const templateCapabilityRequirements = {
  schemaVersion: APP_CAPABILITY_SCHEMA,
  appKey: 'eai-app-template',
  requirements: [
    {
      alias: 'primary-workflow',
      capability: 'workflows.runtime',
      required: true,
      description: 'Workflow executed by the generated application.',
    },
    {
      alias: 'assistant-prompt',
      capability: 'ai.chat',
      required: false,
      description: 'Governed prompt selected for AI-assisted steps.',
    },
    {
      alias: 'assistant-model',
      capability: 'ai.profiles',
      required: false,
      description: 'Governed AI model profile used by AI-assisted steps.',
    },
    {
      alias: 'business-system',
      capability: 'integrations',
      required: false,
      description: 'Tenant integration used by workflow actions.',
    },
  ],
} satisfies AppCapabilityRequirements;
