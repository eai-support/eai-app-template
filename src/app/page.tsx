import { getAccessToken } from '@enterpriseaigroup/core/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { HomeClient } from './home-client';
import {
  getRoutingRedirectUrl,
  resolvePublicApiBaseUrl,
  RoutingResolutionError,
} from '@/lib/platform/session-resolve';
import { getGeneratedWorkflowRuntime } from '@/lib/generated-workflow/runtime';

function getServerTenantId(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_EAI_TENANT_ID ||
    process.env.EAI_TENANT_ID ||
    process.env.TENANT_DEFAULT_ID
  );
}

function getProductSlug(): string {
  return (
    process.env.EAI_PRODUCT_SLUG ||
    process.env.NEXT_PUBLIC_APP_NAME ||
    'eai-app-template'
  );
}

async function redirectToResolvedAppHost(): Promise<void> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return;
  }

  const allHeaders = await headers();
  const currentAppHost =
    allHeaders.get('x-forwarded-host') || allHeaders.get('host');

  try {
    const { routing } = await resolvePublicApiBaseUrl({
      accessToken,
      fallbackBaseUrl: process.env.BASE_URL_PUBLIC_API,
      product: getProductSlug(),
      currentAppHost,
      requestedTenantId: getServerTenantId(),
    });

    const redirectUrl = getRoutingRedirectUrl(routing);
    if (redirectUrl) {
      redirect(redirectUrl);
    }
  } catch (error) {
    if (error instanceof RoutingResolutionError) {
      return;
    }
    throw error;
  }
}

/** Renders immutable generated workflows while retaining the generic template fallback. */
export default async function Home() {
  await redirectToResolvedAppHost();
  const generatedWorkflow = getGeneratedWorkflowRuntime();
  if (generatedWorkflow.status === 'ready') {
    const { appKey, binding, branding, snapshot } = generatedWorkflow.runtime;
    return (
      <HomeClient generatedWorkflow={{ appKey, binding, branding, snapshot }} />
    );
  }
  return (
    <HomeClient
      runtimeError={
        generatedWorkflow.status === 'invalid'
          ? 'WORKFLOW_SNAPSHOT_INVALID'
          : undefined
      }
    />
  );
}
