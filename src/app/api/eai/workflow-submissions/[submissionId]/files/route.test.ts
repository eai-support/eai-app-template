const mockGetRuntime = jest.fn();
const mockReadOwnedSubmission = jest.fn();
const mockSubmissionReadFailure = jest.fn();
let parsedForm: FormData;

class MockRequest {
  readonly headers: Headers;
  readonly url: string;

  constructor(url: string, init?: RequestInit) {
    this.url = url;
    this.headers = new Headers(init?.headers);
  }

  async formData() {
    return parsedForm;
  }
}

Object.defineProperty(globalThis, 'Request', {
  configurable: true,
  value: MockRequest,
});

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

jest.mock('@/lib/generated-workflow/runtime', () => ({
  getGeneratedWorkflowRuntime: () => mockGetRuntime(),
}));

jest.mock('@/lib/generated-workflow/submission-store', () => ({
  readOwnedSubmission: (...args: unknown[]) => mockReadOwnedSubmission(...args),
  submissionReadFailure: (...args: unknown[]) =>
    mockSubmissionReadFailure(...args),
}));

jest.mock('@/lib/generated-workflow/bounded-body', () => {
  class RequestBodyTooLargeError extends Error {}
  return {
    readBoundedRequestBody: jest
      .fn()
      .mockResolvedValue(new Uint8Array([1, 2, 3])),
    RequestBodyTooLargeError,
  };
});

import { POST } from './route';

describe('generated workflow file upload BFF', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRuntime.mockReturnValue({
      status: 'ready',
      runtime: {
        appKey: 'rates-review',
        tenantId: 'tenant-a',
        binding: {
          workflowTemplate: { digest: `sha256:${'a'.repeat(64)}` },
        },
        snapshot: {
          steps: [
            {
              id: 'documents',
              fields: [{ id: 'evidence', type: 'file' }],
            },
          ],
        },
      },
    });
  });

  it('keeps an ownership-read platform timeout retryable instead of returning 404', async () => {
    const upstreamError = new Error('upstream unavailable');
    mockReadOwnedSubmission.mockRejectedValue(upstreamError);
    mockSubmissionReadFailure.mockReturnValue({
      error: 'PLATFORM_UNAVAILABLE',
      status: 503,
    });
    const form = new FormData();
    form.set('file', new File(['proof'], 'proof.txt', { type: 'text/plain' }));
    form.set('stepId', 'documents');
    form.set('fieldId', 'evidence');
    parsedForm = form;
    const request = {
      url: 'http://localhost/api/eai/workflow-submissions/submission-1/files',
      headers: new Headers({
        'content-type': 'multipart/form-data; boundary=test',
      }),
    };

    const response = await POST(request as never, {
      params: Promise.resolve({ submissionId: 'submission-1' }),
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: 'PLATFORM_UNAVAILABLE',
    });
    expect(mockSubmissionReadFailure).toHaveBeenCalledWith(upstreamError);
  });
});
