'use client';

import { DemoPage } from '@enterpriseaigroup/demo';
import { useStoreValue } from '@enterpriseaigroup/core';

import { GeneratedWorkflowPage } from './generated-workflow';
import type { GeneratedWorkflowState } from '@/lib/generated-workflow';

export function HomeClient() {
  const workflow = useStoreValue<GeneratedWorkflowState | undefined>(
    'workflow',
  );

  if (workflow?.steps?.length) {
    return <GeneratedWorkflowPage workflow={workflow} />;
  }

  return <DemoPage />;
}
