/** @jest-environment node */
import { ReadableStream } from 'node:stream/web';
import { TextEncoder } from 'node:util';

const mockPlatformFetch = jest.fn();
const mockGetRuntime = jest.fn();
jest.mock('next/server', () => ({
  NextResponse: class {
    readonly body: unknown;
    readonly headers: Headers;
    readonly status: number;
    constructor(body: unknown, init?: ResponseInit) {
      this.body = body;
      this.headers = new Headers(init?.headers);
      this.status = init?.status ?? 200;
    }
    static json(body: unknown, init?: ResponseInit) {
      return new this(body, init);
    }
    async json() {
      return this.body;
    }
  },
}));
jest.mock('@/lib/generated-workflow/platform', () => ({
  generatedWorkflowPlatformFetch: (...args: unknown[]) =>
    mockPlatformFetch(...args),
}));
jest.mock('@/lib/generated-workflow/runtime', () => ({
  getGeneratedWorkflowRuntime: () => mockGetRuntime(),
}));
import { POST } from './route';

function request(
  value: unknown,
  origin = 'https://workflow.test',
  options: {
    requestOrigin?: string;
    forwardedHost?: string;
    forwardedProto?: string;
  } = {},
) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const headers = new Headers({
    origin,
    'content-type': 'application/json',
    host: 'workflow-internal:3000',
    'x-forwarded-for': '192.0.2.1',
  });
  if (options.forwardedHost)
    headers.set('x-forwarded-host', options.forwardedHost);
  if (options.forwardedProto)
    headers.set('x-forwarded-proto', options.forwardedProto);
  return {
    nextUrl: new URL(
      `${options.requestOrigin ?? 'https://workflow.test'}/api/eai/workflow-assistant`,
    ),
    headers,
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  };
}
const question = { question: 'Why?', stepId: 'submit', history: [] };
const reference = {
  id: 'template-1',
  version: 4,
  digest: `sha256:${'a'.repeat(64)}`,
};

async function readStreamText(body: unknown): Promise<string> {
  const reader = (body as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  let value = '';
  for (;;) {
    const result = await reader.read();
    if (result.done) break;
    value += decoder.decode(result.value, { stream: true });
  }
  return value + decoder.decode();
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetRuntime.mockReturnValue({
    status: 'ready',
    runtime: {
      appKey: 'leave',
      tenantId: 'tenant-a',
      assistantEnabled: true,
      binding: { workflowTemplate: reference },
      snapshot: { steps: [{ id: 'submit' }] },
    },
  });
  mockPlatformFetch.mockImplementation(async () => ({
    ...request({ answer: 'Enter the dates.' }),
    ok: true,
    status: 200,
  }));
});

it('streams only the bound assistant facade without creating a submission or trusting client scope', async () => {
  const response = await POST(request(question) as never);
  expect(response.status).toBe(200);
  expect(await readStreamText(response.body)).toBe(
    'data: {"type":"token","data":"Enter the dates."}\n\n' +
      'data: {"type":"done","data":null}\n\n',
  );
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('content-type')).toBe(
    'text/event-stream; charset=utf-8',
  );
  expect(mockPlatformFetch).toHaveBeenCalledTimes(1);
  const args = mockPlatformFetch.mock.calls[0][0];
  expect(args).toMatchObject({
    tenantId: 'tenant-a',
    appKey: 'leave',
    path: '/assistant',
    anonymousClientId: expect.stringMatching(/^sha256:/),
  });
  expect(args.init.headers).toEqual({ Accept: 'text/event-stream' });
  expect(JSON.parse(args.init.body)).toEqual({
    ...question,
    workflowTemplate: reference,
  });
});

it('passes through a streaming PublicAPI response without buffering it', async () => {
  const upstream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode('data: {"type":"token","data":"Enter "}\n\n'),
      );
      controller.enqueue(
        new TextEncoder().encode(
          'data: {"type":"token","data":"the dates."}\n\n' +
            'data: {"type":"done","data":null}\n\n',
        ),
      );
      controller.close();
    },
  });
  mockPlatformFetch.mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
    body: upstream,
  });

  const response = await POST(request(question) as never);

  expect(response.status).toBe(200);
  expect(response.body).toBe(upstream);
  expect(response.headers.get('x-accel-buffering')).toBe('no');
});

it.each([undefined, false])(
  'does not call a provider when this app has no NCB assistant (%s)',
  (assistantEnabled) => {
    mockGetRuntime.mockReturnValue({
      status: 'ready',
      runtime: { assistantEnabled },
    });
    return POST(request(question) as never).then((response) => {
      expect(response.status).toBe(404);
      expect(mockPlatformFetch).not.toHaveBeenCalled();
    });
  },
);

it.each([
  'formData',
  'submissionId',
  'workflowTemplate',
  'tenantId',
  'appKey',
  'workflow',
  'tools',
])('rejects browser supplied %s', async (key) => {
  expect(
    (await POST(request({ ...question, [key]: 'private' }) as never)).status,
  ).toBe(400);
  expect(mockPlatformFetch).not.toHaveBeenCalled();
});

it('rejects cross-origin and missing origin before resolving runtime', async () => {
  for (const origin of ['https://foreign.test', '']) {
    expect((await POST(request(question, origin) as never)).status).toBe(403);
  }
  expect(mockGetRuntime).not.toHaveBeenCalled();
});

it('accepts the public Azure origin supplied by the rightmost ingress hop', async () => {
  const response = await POST(
    request(question, 'https://workflow.test', {
      requestOrigin: 'http://workflow-internal:3000',
      forwardedHost: 'attacker.test, workflow.test',
      forwardedProto: 'http, https',
    }) as never,
  );

  expect(response.status).toBe(200);
  expect(mockPlatformFetch).toHaveBeenCalledTimes(1);
});

it.each([
  {
    forwardedHost: 'workflow.test, attacker.test',
    forwardedProto: 'http, https',
  },
  { forwardedHost: 'workflow.test', forwardedProto: 'http' },
  { forwardedHost: 'https://workflow.test', forwardedProto: 'https' },
])('rejects a spoofed or mismatched proxy origin (%o)', async (forwarded) => {
  const response = await POST(
    request(question, 'https://workflow.test', {
      requestOrigin: 'http://workflow-internal:3000',
      ...forwarded,
    }) as never,
  );

  expect(response.status).toBe(403);
  expect(mockGetRuntime).not.toHaveBeenCalled();
  expect(mockPlatformFetch).not.toHaveBeenCalled();
});

it('rejects unknown step and oversized streamed bodies', async () => {
  expect(
    (await POST(request({ ...question, stepId: 'other' }) as never)).status,
  ).toBe(400);
  expect(
    (
      await POST(
        request({ ...question, question: 'x'.repeat(70_000) }) as never,
      )
    ).status,
  ).toBe(413);
  expect(mockPlatformFetch).not.toHaveBeenCalled();
});

it.each([409, 429, 503])(
  'preserves upstream %s without a retry',
  async (status) => {
    mockPlatformFetch.mockResolvedValue({ ok: false, status });
    expect((await POST(request(question) as never)).status).toBe(status);
    expect(mockPlatformFetch).toHaveBeenCalledTimes(1);
  },
);

it('rejects invalid or oversized model responses', async () => {
  for (const value of [
    { answer: 'x'.repeat(4001) },
    { answer: 'x'.repeat(40_000) },
    { answer: null },
  ]) {
    mockPlatformFetch.mockImplementation(async () => ({
      ...request(value),
      ok: true,
      status: 200,
    }));
    expect((await POST(request(question) as never)).status).toBe(502);
  }
});
