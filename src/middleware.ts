import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { isOpaqueDemoNavigation } from '@/lib/generated-demo/frame-boundary';

// API routes that require authentication
const PROTECTED_API_ROUTES = ['/api/eai/v4/identity/'];

// Routes that should bypass auth check
const PUBLIC_ROUTES = [
  '/api/auth',
  '/api/eai/config',
  '/api/eai/stream',
  '/_next',
];

/** Apply an opaque-origin CSP to v2 demos and deny their API navigations before the BFF. */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  // SECURITY: Only this middleware can mark the frame; an incoming flag is untrusted.
  requestHeaders.delete('x-eai-isolated-demo');

  if (
    process.env.EAI_GENERATED_DEMO_V2 === 'true' &&
    pathname.startsWith('/api/eai/') &&
    isOpaqueDemoNavigation(request.headers)
  ) {
    return NextResponse.json(
      { error: 'Demo navigation is not allowed' },
      { status: 403 },
    );
  }

  if (pathname === '/eai-demo-frame') {
    requestHeaders.set('x-eai-isolated-demo', '1');
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    const forwardedProtocol = request.headers
      .get('x-forwarded-proto')
      ?.split(',')[0]
      ?.trim();
    const protocol =
      forwardedProtocol === 'http' || forwardedProtocol === 'https'
        ? forwardedProtocol
        : request.nextUrl.protocol.slice(0, -1);
    const requestOrigin = new URL(
      `${protocol}://${request.headers.get('host') || request.nextUrl.host}/`,
    ).origin;
    const staticPath = `${requestOrigin}${request.nextUrl.basePath}/_next/static/`;
    response.headers.set(
      'Content-Security-Policy',
      [
        'sandbox allow-scripts',
        "default-src 'none'",
        `script-src 'unsafe-inline' ${staticPath}`,
        `style-src 'unsafe-inline' ${staticPath}`,
        `font-src data: ${staticPath}`,
        `img-src data: blob: ${requestOrigin}/favicon.ico`,
        "connect-src 'none'",
        "form-action 'none'",
        "frame-src 'none'",
        "frame-ancestors 'self'",
        "object-src 'none'",
        "worker-src 'none'",
        "base-uri 'none'",
        "manifest-src 'none'",
      ].join('; '),
    );
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  }

  // Skip public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Protect API routes
  if (PROTECTED_API_ROUTES.some((route) => pathname.startsWith(route))) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
