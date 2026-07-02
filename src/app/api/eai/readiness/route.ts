import { evaluateRuntimeReadiness } from '@/lib/platform/readiness';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

export async function GET(): Promise<Response> {
  const readiness = evaluateRuntimeReadiness();

  return Response.json(readiness, {
    status: readiness.ok ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
}
