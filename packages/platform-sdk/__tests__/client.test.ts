import { EAIPlatformClient } from '../src/client';

const originalEnv = process.env;
const originalFetch = global.fetch;

describe('EAIPlatformClient', () => {
  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it('HP001 defaults API URLs to the Next.js app base path when configured', () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_BASE_PATH: '/my-template/',
    };

    const client = new EAIPlatformClient({ tenantId: 'test-tenant' });

    expect(client.baseUrl).toBe('/my-template/api/eai');
    expect(client.streamBaseUrl).toBe('/my-template/api/eai');
  });

  it('HP002 preserves explicitly provided API URLs', () => {
    const client = new EAIPlatformClient({
      tenantId: 'test-tenant',
      baseUrl: '/custom/api',
      streamBaseUrl: '/custom/stream',
    });

    expect(client.baseUrl).toBe('/custom/api');
    expect(client.streamBaseUrl).toBe('/custom/stream');
  });

  it('HP003 streams chat through the BFF catch-all route by default', async () => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_APP_BASE_PATH: '/my-template',
    };
    const mockFetch = jest
      .fn()
      .mockResolvedValue({ ok: true, body: new ReadableStream() });
    global.fetch = mockFetch;

    const client = new EAIPlatformClient({ tenantId: 'test-tenant' });
    await client.chat.stream({
      workflowId: 'my-workflow',
      stage: 'chat',
      message: 'Hello',
      conversationId: 'conversation-123',
      params: {},
    });

    // The template serves /api/eai/[[...rest]] only; it has no /api/eai/stream route.
    expect(mockFetch.mock.calls[0][0]).toBe(
      '/my-template/api/eai/v4/ai/chat/stream/test-tenant/my-workflow/chat',
    );
  });
});
