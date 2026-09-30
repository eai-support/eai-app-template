'use client';

import dynamic from 'next/dynamic';
import type { GeneratedDemoArtifact } from '@/lib/generated-demo/contract';
import type { DemoOperationalIdentity } from './demo-host';

// Generated source must execute only after the browser enters the opaque-origin frame.
const GeneratedDemo = dynamic(
  () => import('./demo-app').then((module) => module.GeneratedDemo),
  { ssr: false },
);

export function ClientOnlyGeneratedDemo({
  artifact,
  operational,
}: {
  artifact: GeneratedDemoArtifact;
  operational?: DemoOperationalIdentity;
}) {
  return <GeneratedDemo artifact={artifact} operational={operational} />;
}
