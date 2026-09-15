import { ReadableStream } from 'node:stream/web';
import { TextEncoder } from 'node:util';

const mockPlatformFetch = jest.fn();
const mockGetRuntime = jest.fn();
const mockReadOwnedSubmission = jest.fn();
const mockHasSubmissionSession = jest.fn();

jest.mock('next/server', () => ({
  NextResponse: class MockNextResponse {
    readonly body: unknown;
    readonly headers: Headers;
    readonly status: number;

    constructor(body: unknown, init?: ResponseInit) {
      this.body = body;
      this.headers = new Headers(init?.headers);
      this.status = init?.status ?? 200;
    }

    static json(body: unknown, init?: ResponseInit) {
      return new MockNextResponse(body, init);
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

jest.mock('@/lib/generated-workflow/submission-store', () => ({
  readOwnedSubmission: (...args: unknown[]) => mockReadOwnedSubmission(...args),
}));

jest.mock('@/lib/generated-workflow/submission-session', () => ({
  hasSubmissionSession: (...args: unknown[]) =>
    mockHasSubmissionSession(...args),
}));

import { PATCH } from './route';

function oversizedChunkedPatch(): Request {
  const encoder = new TextEncoder();
  const chunks = [
    encoder.encode('{"formData":{"answer":"'),
    encoder.encode('x'.repeat(256 * 1024)),
    encoder.encode('"}}'),
  ];
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index]);
        index += 1;
      } else {
        controller.close();
      }
    },
  });
  return {
    headers: new Headers({
      'content-type': 'application/json',
      'content-length': '32',
    }),
    body,
  } as unknown as Request;
}

function jsonPatch(value: unknown): Request {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded);
        controller.close();
      },
    }),
  } as unknown as Request;
}

describe('generated workflow anonymous submission update BFF', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRuntime.mockReturnValue({
      status: 'ready',
      runtime: {
        appKey: 'rates-review',
        tenantId: 'tenant-a',
        assistantEnabled: true,
        binding: {
          workflowTemplate: {
            digest: `sha256:${'a'.repeat(64)}`,
          },
        },
      },
    });
    mockHasSubmissionSession.mockReturnValue(true);
    mockPlatformFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  it('rejects a false-small chunked JSON body before ownership or platform access', async () => {
    const response = await PATCH(oversizedChunkedPatch() as never, {
      params: Promise.resolve({ submissionId: 'submission-1' }),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: 'PAYLOAD_TOO_LARGE',
    });
    expect(mockReadOwnedSubmission).not.toHaveBeenCalled();
    expect(mockPlatformFetch).not.toHaveBeenCalled();
  });

  it('uses the signed browser capability and one platform update request', async () => {
    const request = jsonPatch({
      currentStep: 1,
      formData: { contact: { name: 'Ada' } },
    });
    request.headers.set('x-forwarded-for', '192.0.2.10');

    const response = await PATCH(request as never, {
      params: Promise.resolve({ submissionId: 'submission-1' }),
    });

    expect(response.status).toBe(200);
    expect(mockHasSubmissionSession).toHaveBeenCalledWith(
      request,
      'submission-1',
      `sha256:${'a'.repeat(64)}`,
    );
    expect(mockReadOwnedSubmission).not.toHaveBeenCalled();
    expect(mockPlatformFetch).toHaveBeenCalledTimes(1);
    expect(mockPlatformFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        appKey: 'rates-review',
        path: '/submissions/submission-1',
        init: expect.objectContaining({ method: 'PATCH' }),
      }),
    );
  });

  it('rejects an update without a signed browser capability', async () => {
    mockHasSubmissionSession.mockReturnValue(false);

    const response = await PATCH(jsonPatch({ currentStep: 1 }) as never, {
      params: Promise.resolve({ submissionId: 'submission-1' }),
    });

    expect(response.status).toBe(404);
    expect(mockPlatformFetch).not.toHaveBeenCalled();
  });

  it('preserves the finalized response without a preflight platform read', async () => {
    mockPlatformFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        detail: {
          error: 'ALREADY_COMPLETED',
          message: 'This submission has already been completed.',
        },
      }),
    });

    const response = await PATCH(jsonPatch({ status: 'completed' }) as never, {
      params: Promise.resolve({ submissionId: 'submission-1' }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'SUBMISSION_FINALIZED',
    });
    expect(mockReadOwnedSubmission).not.toHaveBeenCalled();
    expect(mockPlatformFetch).toHaveBeenCalledTimes(1);
  });

  it.each(['RUNTIME_BINDING_MISMATCH', 'WORKFLOW_SNAPSHOT_MISMATCH'])(
    'does not misclassify the upstream %s conflict as a finalized submission',
    async (error) => {
      mockPlatformFetch.mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ detail: { error } }),
      });

      const response = await PATCH(jsonPatch({ currentStep: 1 }) as never, {
        params: Promise.resolve({ submissionId: 'submission-1' }),
      });

      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toEqual({
        error: 'SUBMISSION_UPDATE_FAILED',
      });
      expect(mockReadOwnedSubmission).not.toHaveBeenCalled();
      expect(mockPlatformFetch).toHaveBeenCalledTimes(1);
    },
  );
});
