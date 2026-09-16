const mockGetRuntime = jest.fn();
const mockHasSubmissionSession = jest.fn();
const mockPlatformFetch = jest.fn();
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

jest.mock('@/lib/generated-workflow/submission-session', () => ({
  hasSubmissionSession: (...args: unknown[]) =>
    mockHasSubmissionSession(...args),
}));

jest.mock('@/lib/generated-workflow/platform', () => ({
  generatedWorkflowPlatformFetch: (...args: unknown[]) =>
    mockPlatformFetch(...args),
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
    mockHasSubmissionSession.mockReturnValue(true);
    mockPlatformFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ file: { id: 'file-1' } }),
    });
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

  it('uploads once after the local submission capability check', async () => {
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

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      file: { id: 'file-1' },
    });
    expect(mockHasSubmissionSession).toHaveBeenCalledWith(
      request,
      'submission-1',
      `sha256:${'a'.repeat(64)}`,
    );
    expect(mockPlatformFetch).toHaveBeenCalledTimes(1);
    expect(mockPlatformFetch).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        appKey: 'rates-review',
        path: '/submissions/submission-1/files',
        init: expect.objectContaining({ method: 'POST' }),
      }),
    );
  });

  it('rejects a missing submission capability without calling the platform', async () => {
    mockHasSubmissionSession.mockReturnValue(false);
    const request = {
      url: 'http://localhost/api/eai/workflow-submissions/submission-1/files',
      headers: new Headers({
        'content-type': 'multipart/form-data; boundary=test',
      }),
    };

    const response = await POST(request as never, {
      params: Promise.resolve({ submissionId: 'submission-1' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'SUBMISSION_NOT_FOUND',
    });
    expect(mockPlatformFetch).not.toHaveBeenCalled();
  });
});
