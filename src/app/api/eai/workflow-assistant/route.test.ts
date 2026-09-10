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

function request(value: unknown, origin = 'https://workflow.test') {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return {
    nextUrl: new URL('https://workflow.test/api/eai/workflow-assistant'),
    headers: new Headers({
      origin,
      'content-type': 'application/json',
      'x-forwarded-for': '192.0.2.1',
    }),
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
beforeEach(() => {
  jest.clearAllMocks();
  mockGetRuntime.mockReturnValue({
    status: 'ready',
    runtime: {
      appKey: 'leave',
      tenantId: 'tenant-a',
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

it('calls only the bound assistant facade without creating a submission or trusting client scope', async () => {
  const response = await POST(request(question) as never);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ answer: 'Enter the dates.' });
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(mockPlatformFetch).toHaveBeenCalledTimes(1);
  const args = mockPlatformFetch.mock.calls[0][0];
  expect(args).toMatchObject({
    tenantId: 'tenant-a',
    appKey: 'leave',
    path: '/assistant',
    anonymousClientId: expect.stringMatching(/^sha256:/),
  });
  expect(JSON.parse(args.init.body)).toEqual({
    ...question,
    workflowTemplate: reference,
  });
});

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
