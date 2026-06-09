import { getAccessToken } from '@enterpriseaigroup/core/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { HomeClient } from './home-client';
import {
  getRoutingRedirectUrl,
  resolvePublicApiBaseUrl,
  RoutingResolutionError,
} from '@/lib/platform/session-resolve';

const SERVER_TENANT_ID =
  process.env.NEXT_PUBLIC_EAI_TENANT_ID ||
  process.env.EAI_TENANT_ID ||
  process.env.TENANT_DEFAULT_ID;
const PRODUCT_SLUG =
  process.env.EAI_PRODUCT_SLUG ||
  process.env.NEXT_PUBLIC_APP_NAME ||
  'eai-app-template';

async function redirectToResolvedAppHost(): Promise<void> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return;
  }

  const allHeaders = await headers();
  const currentAppHost = allHeaders.get('x-forwarded-host') || allHeaders.get('host');

  try {
    const { routing } = await resolvePublicApiBaseUrl({
      accessToken,
      fallbackBaseUrl: process.env.BASE_URL_PUBLIC_API,
      product: PRODUCT_SLUG,
      currentAppHost,
      requestedTenantId: SERVER_TENANT_ID,
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

export default async function Home() {
  await redirectToResolvedAppHost();
  return <HomeClient />;
}
