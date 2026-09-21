import type { Metadata } from 'next';

import type { GeneratedWorkflowRuntimeResolution } from './runtime-contract';

/** Derive browser chrome from the same reviewed app identity and branding as the form. */
export function generatedWorkflowDocumentMetadata(
  resolution: GeneratedWorkflowRuntimeResolution,
): Metadata {
  if (resolution.status !== 'ready') {
    return {
      title: 'EAI App Template',
      description: 'Enterprise AI application template',
      icons: { icon: '/favicon.ico' },
    };
  }

  const { binding, branding } = resolution.runtime;
  const brandName = branding?.displayName;
  const appName = binding.workflowTemplate.title;
  const title = brandName ?? appName;
  return {
    title,
    description: brandName
      ? `${appName} workflow for ${brandName}`
      : `${appName} workflow`,
    icons: { icon: branding?.logoDataUrl ?? '/favicon.ico' },
  };
}
