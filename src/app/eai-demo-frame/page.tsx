import { ClientOnlyGeneratedDemo } from '@/components/generated-demo/client-only-demo';
import { getGeneratedDemoRuntime } from '@/lib/generated-demo/runtime';
import { getGeneratedOperationalRuntime } from '@/lib/generated-demo/operational-runtime';

export const dynamic = 'force-dynamic';

/** Render accepted source only in the middleware-sandboxed document. */
export default function IsolatedDemoPage() {
  const runtime = getGeneratedDemoRuntime();
  if (runtime.status !== 'ready') {
    return <main role='alert'>The demo app is unavailable.</main>;
  }
  const operational = getGeneratedOperationalRuntime();
  if (operational.status === 'invalid') {
    return <main role='alert'>The operational app binding is unavailable.</main>;
  }
  return <ClientOnlyGeneratedDemo artifact={runtime.artifact} operational={operational.status === 'ready' ? {
    acceptedArtifactDigest: operational.config.acceptedArtifactDigest,
    fixtureCollection: operational.config.readBindings[0].fixtureCollection,
    maxRows: operational.config.readBindings[0].maxRows,
  } : undefined} />;
}
