const mockGetAccessToken = jest.fn();
const mockResolvePublicApiBaseUrl = jest.fn();

jest.mock('next/server', () => ({
  NextResponse: class MockNextResponse {
    readonly body: BodyInit | null | undefined;
    readonly headers: Headers;
    readonly status: number;
    readonly statusText: string;

    constructor(body?: BodyInit | null, init?: ResponseInit) {
      this.body = body;
      this.headers = new Headers(init?.headers);
      this.status = init?.status ?? 200;
      this.statusText = init?.statusText ?? '';
    }
  },
}));

jest.mock('@enterpriseaigroup/core/server', () => ({
  getAccessToken: () => mockGetAccessToken(),
}));

jest.mock('@/lib/platform/session-resolve', () => {
  class RoutingResolutionError extends Error {
    readonly statusCode: number;
    readonly responseBody: unknown;

    constructor(
      message: string,
      statusCode: number,
      responseBody: unknown = null,
    ) {
      super(message);
      this.name = 'RoutingResolutionError';
      this.statusCode = statusCode;
      this.responseBody = responseBody;
    }
  }

  return {
    RoutingResolutionError,
    resolvePublicApiBaseUrl: (...args: unknown[]) =>
      mockResolvePublicApiBaseUrl(...args),
  };
});

import { GET, POST } from './route';
import { resourceRoutesBaseUrl } from '@enterpriseaigroup/platform-sdk';

function createRequest(
  path: string,
  init?: { body?: string; headers?: HeadersInit; method?: string },
) {
  const url = `https://template.test/api/eai/${path}`;
  return {
    headers: new Headers(init?.headers),
    method: init?.method ?? 'GET',
    nextUrl: new URL(url),
    text: async () => init?.body ?? '',
    url,
  } as never;
}

function createContext(path: string) {
  return {
    params: Promise.resolve({ rest: path.split('/') }),
  };
}

describe('EAI proxy v4 route-family routing', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      BASE_URL_PUBLIC_API: 'https://fallback-api.example.com/public',
      EAI_PRODUCT_SLUG: 'eai-app-template',
    };
    mockGetAccessToken.mockResolvedValue('user-token');
    mockResolvePublicApiBaseUrl.mockResolvedValue({
      baseUrl: 'https://regional-api.example.com/public',
      routing: {
        status: 'resolved',
        userId: 'user-1',
        product: 'eai-app-template',
        productAllowed: true,
        routingMode: 'api_only',
        activeTenantId: 'tenant-a',
      },
    });
    global.fetch = jest.fn().mockResolvedValue({
      body: null,
      clone: () => ({
        text: async () => JSON.stringify({ ok: true }),
      }),
      headers: new Headers({ 'Content-Type': 'application/json' }),
      status: 200,
      statusText: 'OK',
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  it('HP001 routes v4 resource-family requests to the v4 upstream path', async () => {
    await GET(
      createRequest('v4/data/resources/tenant-a/Application?limit=5'),
      createContext('v4/data/resources/tenant-a/Application'),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      `${resourceRoutesBaseUrl('https://regional-api.example.com/public')}/tenant-a/Application?limit=5`,
      expect.any(Object),
    );
  });

  it('BP001 rejects paths outside PublicAPI V4 before proxying upstream', async () => {
    const response = await GET(
      createRequest('resources/tenant-a/Application?limit=5'),
      createContext('resources/tenant-a/Application'),
    );

    expect(response.status).toBe(410);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('HP002 rewrites root platform user lookups to tenant-scoped v4 paths when app tenant is configured', async () => {
    process.env.EAI_TENANT_ID = 'tenant-a';

    await GET(
      createRequest('v4/platform/users/by-email?email=jane@example.com'),
      createContext('v4/platform/users/by-email'),
    );
    await GET(
      createRequest('v4/platform/users/user-oid/memberships'),
      createContext('v4/platform/users/user-oid/memberships'),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://regional-api.example.com/public/v4/platform/tenants/tenant-a/users/by-email?email=jane%40example.com',
      expect.any(Object),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'https://regional-api.example.com/public/v4/platform/tenants/tenant-a/users/user-oid/memberships',
      expect.any(Object),
    );
    expect(mockResolvePublicApiBaseUrl).toHaveBeenCalledWith(
      expect.objectContaining({ requestedTenantId: 'tenant-a' }),
    );
  });

  it('HP003 refuses data-plane proxy requests without a signed-in user token', async () => {
    mockGetAccessToken.mockResolvedValue(null);

    const response = await GET(
      createRequest('v4/data/resources/tenant-a/Application?limit=5'),
      createContext('v4/data/resources/tenant-a/Application'),
    );

    expect(response.status).toBe(401);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockResolvePublicApiBaseUrl).not.toHaveBeenCalled();
  });

  it('HP004 forwards trace IDs, strips baggage, returns response IDs, and does not log response bodies', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const secretBody = JSON.stringify({ applicantName: 'Sensitive Person' });
    const cloneText = jest.fn(async () => secretBody);
    (global.fetch as jest.Mock).mockResolvedValue({
      body: null,
      clone: () => ({
        text: cloneText,
      }),
      headers: new Headers({
        'Content-Type': 'application/json',
        'content-length': String(secretBody.length),
      }),
      status: 200,
      statusText: 'OK',
    });

    const response = await GET(
      createRequest('v4/data/resources/tenant-a/Application?limit=5', {
        headers: {
          baggage: 'tenant.id=tenant-a,user.email=person@example.com',
          cookie: 'next-auth.session-token=browser',
          traceparent:
            '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
          tracestate: 'vendor=state',
          'x-correlation-id': 'corr-template-1',
          'x-request-id': 'req-template-1',
        },
      }),
      createContext('v4/data/resources/tenant-a/Application'),
    );

    const [, fetchOptions] = (global.fetch as jest.Mock).mock.calls[0];
    const headers = fetchOptions.headers as Headers;

    expect(headers.get('baggage')).toBeNull();
    expect(headers.get('cookie')).toBeNull();
    expect(headers.get('traceparent')).toBe(
      '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
    );
    expect(headers.get('tracestate')).toBe('vendor=state');
    expect(headers.get('x-request-id')).toBe('req-template-1');
    expect(headers.get('x-correlation-id')).toBe('corr-template-1');
    expect(response.headers.get('x-request-id')).toBe('req-template-1');
    expect(response.headers.get('x-correlation-id')).toBe('corr-template-1');
    expect(cloneText).not.toHaveBeenCalled();
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain('Sensitive Person');
  });

  it('HP005 forwards both tenant headers server-authoritatively for tenant-scoped resource calls', async () => {
    process.env.EAI_TENANT_ID = 'tenant-a';

    await GET(
      createRequest('v4/data/resources/tenant-a/storage', {
        headers: {
          tenant: 'spoofed-tenant',
          'x-tenant-id': 'spoofed-tenant',
        },
      }),
      createContext('v4/data/resources/tenant-a/storage'),
    );

    const [, fetchOptions] = (global.fetch as jest.Mock).mock.calls[0];
    const headers = fetchOptions.headers as Headers;

    expect(headers.get('tenant')).toBe('tenant-a');
    expect(headers.get('x-tenant-id')).toBe('tenant-a');
  });

  it('BP002 strips inbound proxy and hop-by-hop headers without losing server authority', async () => {
    process.env.EAI_TENANT_ID = 'tenant-a';

    const response = await GET(
      createRequest('v4/data/resources/tenant-a/task', {
        headers: {
          authorization: 'Bearer browser-spoofed',
          connection: 'keep-alive, x-hop-only, authorization, tenant',
          'content-length': '999',
          forwarded: 'host=localhost:3330;proto=http',
          'proxy-authorization': 'Basic browser-spoofed',
          tenant: 'spoofed-tenant',
          te: 'trailers',
          'x-correlation-id': 'corr-template-2',
          'x-forwarded-for': '127.0.0.1',
          'x-forwarded-host': 'localhost:3330',
          'x-forwarded-port': '3330',
          'x-forwarded-proto': 'http',
          'x-hop-only': 'browser-spoofed',
          'x-request-id': 'req-template-2',
          'x-tenant-id': 'spoofed-tenant',
        },
      }),
      createContext('v4/data/resources/tenant-a/task'),
    );

    const [targetUrl, fetchOptions] = (global.fetch as jest.Mock).mock.calls[0];
    const headers = fetchOptions.headers as Headers;

    expect(targetUrl).toBe(
      `${resourceRoutesBaseUrl('https://regional-api.example.com/public')}/tenant-a/task`,
    );
    for (const name of [
      'connection',
      'content-length',
      'forwarded',
      'host',
      'proxy-authorization',
      'te',
      'x-forwarded-for',
      'x-forwarded-host',
      'x-forwarded-port',
      'x-forwarded-proto',
      'x-hop-only',
    ]) {
      expect(headers.get(name)).toBeNull();
    }
    expect(headers.get('authorization')).toBe('Bearer user-token');
    expect(headers.get('tenant')).toBe('tenant-a');
    expect(headers.get('x-tenant-id')).toBe('tenant-a');
    expect(headers.get('x-request-id')).toBe('req-template-2');
    expect(headers.get('x-correlation-id')).toBe('corr-template-2');
    expect(response.status).toBe(200);
  });

  it('HP006 preserves a JSON Task write while stripping spoofed forwarding metadata', async () => {
    process.env.EAI_TENANT_ID = 'tenant-a';
    const body = JSON.stringify({ data: { title: 'Customer task' } });

    await POST(
      createRequest('v4/data/resources/tenant-a/task', {
        body,
        method: 'POST',
        headers: {
          authorization: 'Bearer browser-spoofed',
          'content-length': '999',
          'content-type': 'application/json',
          forwarded: 'host=localhost:3330;proto=http',
          tenant: 'spoofed-tenant',
          'x-correlation-id': 'corr-template-3',
          'x-forwarded-host': 'localhost:3330',
          'x-forwarded-proto': 'http',
          'x-request-id': 'req-template-3',
        },
      }),
      createContext('v4/data/resources/tenant-a/task'),
    );

    const [, fetchOptions] = (global.fetch as jest.Mock).mock.calls[0];
    const headers = fetchOptions.headers as Headers;
    expect(fetchOptions.method).toBe('POST');
    expect(fetchOptions.body).toBe(body);
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('content-length')).toBeNull();
    expect(headers.get('forwarded')).toBeNull();
    expect(headers.get('x-forwarded-host')).toBeNull();
    expect(headers.get('x-forwarded-proto')).toBeNull();
    expect(headers.get('authorization')).toBe('Bearer user-token');
    expect(headers.get('tenant')).toBe('tenant-a');
    expect(headers.get('x-tenant-id')).toBe('tenant-a');
    expect(headers.get('x-request-id')).toBe('req-template-3');
    expect(headers.get('x-correlation-id')).toBe('corr-template-3');
  });
});
