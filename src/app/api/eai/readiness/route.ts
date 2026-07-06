import { evaluateRuntimeReadiness } from '@/lib/platform/readiness';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

type ProbeFailureCategory = 'auth_misconfigured' | 'tenant_assignment_invalid';

const readinessProbeTokenEnvKey = ['EAI', 'READINESS', 'PROBE', 'TOKEN'].join(
  '_',
);

function probeFailure(
  category: ProbeFailureCategory,
  status: number,
): Response {
  return Response.json(
    {
      ok: false,
      service: process.env.NEXT_PUBLIC_APP_NAME || 'eai-app-template',
      checks: [{ name: 'tenantinfra-probe', ok: false, category }],
      failureCategories: [category],
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    },
  );
}

function requireHeader(
  headers: Headers,
  name: string,
  expected: string | undefined,
): boolean {
  return !expected || headers.get(name) === expected;
}

function validateTenantInfraProbe(request: Request): Response | null {
  const headers = request.headers;

  if (headers.get('x-eai-readiness-probe') !== 'tenantinfra') {
    return probeFailure('auth_misconfigured', 401);
  }

  const token = process.env[readinessProbeTokenEnvKey];
  if (token && headers.get('authorization') !== `Bearer ${token}`) {
    return probeFailure('auth_misconfigured', 401);
  }

  const scopeMatches =
    requireHeader(
      headers,
      'x-eai-tenant-id',
      process.env.NEXT_PUBLIC_EAI_TENANT_ID,
    ) &&
    requireHeader(headers, 'x-eai-app-key', process.env.EAI_PRODUCT_SLUG) &&
    requireHeader(headers, 'x-eai-environment', process.env.EAI_ENVIRONMENT) &&
    requireHeader(headers, 'x-eai-config-hash', process.env.EAI_CONFIG_HASH);

  if (!scopeMatches) {
    return probeFailure('tenant_assignment_invalid', 403);
  }

  return null;
}

export async function GET(request: Request): Promise<Response> {
  const probeFailureResponse = validateTenantInfraProbe(request);
  if (probeFailureResponse) {
    return probeFailureResponse;
  }

  const readiness = evaluateRuntimeReadiness();

  return Response.json(readiness, {
    status: readiness.ok ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  });
}
