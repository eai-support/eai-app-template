'use client';

import type { GeneratedDemoAppProps } from '@/lib/generated-demo/contract';

/** Export replaces this entry with accepted source for v2 demo apps. */
export default function GeneratedApp({ viewId }: GeneratedDemoAppProps) {
  return (
    <p data-eai-generated-view={viewId}>No generated demo is configured.</p>
  );
}
