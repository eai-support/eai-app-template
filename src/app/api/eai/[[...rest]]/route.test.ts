const mockGetAccessToken = jest.fn();
const mockGetClientCredentialsToken = jest.fn();
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
  getClientCredentialsToken: () => mockGetClientCredentialsToken(),
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

import { GET } from './route';

function createRequest(path: string) {
  const url = `https://template.test/api/eai/${path}`;
  return {
    headers: new Headers(),
    method: 'GET',
    nextUrl: new URL(url),
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
    process.env = {
      ...originalEnv,
      BASE_URL_PUBLIC_API: 'https://fallback-api.example.com/public',
      EAI_PRODUCT_SLUG: 'eai-app-template',
    };
    mockGetAccessToken.mockResolvedValue('user-token');
    mockGetClientCredentialsToken.mockResolvedValue('client-token');
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

  it('HP001 routes enabled resource-family requests to the v4 upstream path', async () => {
    process.env.PUBLICAPI_V4_DATA_RESOURCES_ENABLED = 'true';

    await GET(
      createRequest('v3/resources/tenant-a/Application?limit=5'),
      createContext('v3/resources/tenant-a/Application'),
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://regional-api.example.com/public/v4/data/resources/tenant-a/Application?limit=5',
      expect.any(Object),
    );
  });
});
