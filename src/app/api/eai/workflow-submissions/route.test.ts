const mockPlatformFetch = jest.fn();
const mockGetRuntime = jest.fn();
const mockSetSubmissionSession = jest.fn();

jest.mock('next/server', () => ({
  NextResponse: class MockNextResponse {
    readonly body: unknown;
    readonly headers: Headers;
    readonly status: number;
    readonly cookies = { set: jest.fn() };

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

jest.mock('@/lib/generated-workflow/submission-session', () => ({
  setSubmissionSession: (...args: unknown[]) =>
    mockSetSubmissionSession(...args),
}));

import { POST } from './route';

describe('generated workflow anonymous submission BFF', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRuntime.mockReturnValue({
      status: 'ready',
      runtime: {
        appKey: 'rates-review',
        tenantId: 'tenant-a',
        binding: {
          workflowTemplate: {
            id: 'template-123',
            version: 4,
            digest: `sha256:${'a'.repeat(64)}`,
          },
          respondentAccess: {
            submissionObjectType: 'workflow-submission',
          },
        },
      },
    });
    mockPlatformFetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ submissionId: 'submission-1' }),
    });
  });

  it('calls only the managed-identity facade and issues browser ownership state', async () => {
    const response = await POST({
      headers: new Headers({ 'x-forwarded-for': '192.0.2.1' }),
      json: async () => ({ device: 'Desktop' }),
    } as never);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      submissionId: 'submission-1',
    });
    expect(mockPlatformFetch).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      appKey: 'rates-review',
      path: '/submissions',
      anonymousClientId: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      init: {
        method: 'POST',
        body: expect.any(String),
      },
    });
    const requestBody = JSON.parse(
      mockPlatformFetch.mock.calls[0][0].init.body,
    );
    expect(requestBody).toMatchObject({
      workflowTemplate: {
        id: 'template-123',
        version: 4,
        digest: `sha256:${'a'.repeat(64)}`,
      },
      device: 'Desktop',
    });
    expect(JSON.stringify(requestBody)).not.toContain('token');
    expect(mockSetSubmissionSession).toHaveBeenCalledWith(
      response,
      'submission-1',
      `sha256:${'a'.repeat(64)}`,
    );
  });

  it('rejects malformed device values before calling PublicAPI', async () => {
    const response = await POST({
      headers: new Headers(),
      json: async () => ({ device: 'Watch' }),
    } as never);

    expect(response.status).toBe(400);
    expect(mockPlatformFetch).not.toHaveBeenCalled();
  });
});
