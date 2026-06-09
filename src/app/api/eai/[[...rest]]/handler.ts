import { NextRequest, NextResponse } from 'next/server';
import {
  getClientCredentialsToken,
  getAccessToken,
} from '@enterpriseaigroup/core/server';
import {
  resolvePublicApiBaseUrl,
  RoutingResolutionError,
} from '@/lib/platform/session-resolve';
import { resolvePublicApiRoutePath } from '@/lib/platform/publicapi-route-family';

export interface RouteContext {
  params: Promise<{ rest?: string[] }>;
}

const SERVER_TENANT_ID =
  process.env.NEXT_PUBLIC_EAI_TENANT_ID ||
  process.env.EAI_TENANT_ID ||
  process.env.TENANT_DEFAULT_ID;
const PRODUCT_SLUG =
  process.env.EAI_PRODUCT_SLUG ||
  process.env.NEXT_PUBLIC_APP_NAME ||
  'eai-app-template';

// Content types that should be treated as binary (not logged as text)
const BINARY_CONTENT_TYPES = [
  'application/zip',
  'application/octet-stream',
  'application/pdf',
  'image/',
  'audio/',
  'video/',
];

function isBinaryContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return BINARY_CONTENT_TYPES.some((type) =>
    contentType.toLowerCase().includes(type),
  );
}

async function proxyRequest(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  console.log('[EAI Proxy] Route hit:', request.method, request.url);
  try {
    const params = await context.params;
    console.log('[EAI Proxy] Params:', params);
    const path = params.rest?.join('/') || '';
    const fallbackBaseUrl = process.env.BASE_URL_PUBLIC_API;
    let baseUrl = fallbackBaseUrl;
    console.log('[EAI Proxy] Path:', path, 'Base URL:', baseUrl);

    // Ensure baseUrl ends with / and path doesn't start with /
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('tenant');
    headers.delete('x-tenant-id');

    // Try to get user token first, fallback to client credentials
    let token = await getAccessToken();

    if (token) {
      const resolved = await resolvePublicApiBaseUrl({
        accessToken: token,
        fallbackBaseUrl,
        product: PRODUCT_SLUG,
        currentAppHost: request.nextUrl.host,
        requestedTenantId: SERVER_TENANT_ID,
      });
      baseUrl = resolved.baseUrl;
      console.log('[EAI Proxy] Using user token for:', path);
      headers.set('Authorization', `Bearer ${token}`);
    } else {
      console.log(
        '[EAI Proxy] No user token available, using client credentials for:',
        path,
      );
      if (!baseUrl) {
        throw new Error('BASE_URL_PUBLIC_API environment variable is not set');
      }
      token = await getClientCredentialsToken();
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (!baseUrl) {
      throw new Error('Unable to resolve PublicAPI base URL');
    }

    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const targetPath = resolvePublicApiRoutePath(path);
    const targetUrl = new URL(targetPath, normalizedBaseUrl);
    console.log('[EAI Proxy] Target URL:', targetUrl.toString());

    // Preserve query params
    request.nextUrl.searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value);
    });

    // Keep the tenant header server-authoritative so clients cannot spoof tenant context.
    if (SERVER_TENANT_ID) {
      headers.set('tenant', SERVER_TENANT_ID);
    }

    const fetchOptions: RequestInit & { duplex?: 'half' } = {
      method: request.method,
      headers,
    };

    // Include body for methods that support it
    if (!['GET', 'HEAD'].includes(request.method)) {
      const contentType = request.headers.get('content-type') || '';

      // For JSON requests, read the body as text and forward it
      // This ensures the body is properly sent even if the stream was partially consumed
      if (contentType.includes('application/json')) {
        try {
          const bodyText = await request.text();
          if (bodyText) {
            fetchOptions.body = bodyText;
            console.log(
              '[EAI Proxy] Forwarding JSON body, length:',
              bodyText.length,
            );
          }
        } catch (e) {
          console.log('[EAI Proxy] Could not read JSON body:', e);
        }
      } else if (request.body) {
        // For other content types (FormData/multipart), use stream
        fetchOptions.body = request.body;
        fetchOptions.duplex = 'half';
      }
    }

    const response = await fetch(targetUrl.toString(), fetchOptions);

    const contentType = response.headers.get('content-type');
    const isBinary = isBinaryContentType(contentType);

    // Only log text responses to avoid corrupting binary data
    if (!isBinary) {
      const clonedResponse = response.clone();
      const responseData = await clonedResponse.text();
      console.log('[EAI Proxy] Response status:', response.status);
      console.log('[EAI Proxy] Response body:', responseData);
    } else {
      console.log('[EAI Proxy] Response status:', response.status);
      console.log('[EAI Proxy] Binary response, content-type:', contentType);
    }

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete('content-encoding');

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[EAI Proxy] Request failed:', error);

    if (error instanceof RoutingResolutionError) {
      return new NextResponse(
        JSON.stringify({
          error: 'Routing resolution failed',
          message: error.message,
          details: error.responseBody,
        }),
        {
          status: error.statusCode,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Don't expose internal error details to client
    const isConfigError =
      error instanceof Error &&
      (error.message.includes('BASE_URL_PUBLIC_API') ||
        error.message.includes('PublicAPI base URL'));

    return new NextResponse(
      JSON.stringify({
        error: 'Proxy request failed',
        message: isConfigError
          ? 'Service configuration error'
          : 'An error occurred while processing your request',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}

export async function handleEaiProxyRequest(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  return proxyRequest(request, context);
}
