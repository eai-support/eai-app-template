/** @jest-environment node */
import { NextRequest } from 'next/server';

const mockPlatformFetch = jest.fn();
const mockGetRuntime = jest.fn();
jest.mock('@/lib/generated-workflow/platform', () => ({
  ...jest.requireActual('@/lib/generated-workflow/platform'),
  generatedWorkflowPlatformFetch: (...args: unknown[]) =>
    mockPlatformFetch(...args),
}));
jest.mock('@/lib/generated-workflow/runtime', () => ({
  getGeneratedWorkflowRuntime: () => mockGetRuntime(),
}));
import { GeneratedWorkflowPlatformUnavailableError } from '@/lib/generated-workflow/platform';
import { POST } from './route';

const ORIGIN = 'https://resume.test';

function request(body: unknown) {
  return new NextRequest(
    `${ORIGIN}/api/eai/document-template/ai-field-mapper`,
    {
      method: 'POST',
      headers: {
        origin: ORIGIN,
        'content-type': 'application/json',
        'x-forwarded-for': '192.0.2.1',
      },
      body: JSON.stringify(body),
    },
  );
}

const mapperRequest = {
  templateId: 'resume-template',
  unmatchedPlaceholders: ['professionalSummary', 'skills'],
  placeholderMeta: [
    {
      key: 'professionalSummary',
      suggestedType: 'richtext',
      suggestedLabel: 'Professional Summary',
      context: 'paragraph',
      styling: { rPr: '<w:rPr/>' },
    },
    { key: 'notRequested', suggestedType: 'text', suggestedLabel: 'X' },
  ],
  brContext: {
    id: 'record-1',
    fullName: 'Alex Respondent',
    experience: '7 years building payments platforms',
    upload: { fileId: 'file-1' },
    years: 7,
    blank: '   ',
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetRuntime.mockReturnValue({
    status: 'ready',
    runtime: {
      appKey: 'resume-builder',
      tenantId: 'tenant-a',
      binding: { workflowTemplate: { id: 'workflow-1' } },
      snapshot: {
        steps: [
          {
            id: 'document',
            fields: [
              {
                id: 'resumeDocument',
                type: 'smart_block',
                blockType: 'document-creation',
                templateId: 'resume-template',
              },
            ],
          },
        ],
      },
    },
  });
  mockPlatformFetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        values: {
          professionalSummary: '<p>Payments engineer.</p>',
          skills: 'TypeScript, Python',
          injected: 'not requested',
          empty: 7,
        },
      }),
      { headers: { 'content-type': 'application/json' } },
    ),
  );
});

it('forwards bounded string answers to PublicAPI and returns only requested blanks', async () => {
  const response = await POST(request(mapperRequest));

  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store, no-cache');
  expect(await response.json()).toEqual({
    mappedFields: {
      professionalSummary: '<p>Payments engineer.</p>',
      skills: 'TypeScript, Python',
    },
  });
  expect(mockPlatformFetch).toHaveBeenCalledTimes(1);
  const args = mockPlatformFetch.mock.calls[0][0];
  expect(args).toMatchObject({
    tenantId: 'tenant-a',
    appKey: 'resume-builder',
    path: '/document-template/ai-field-mapping',
    anonymousClientId: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    init: { method: 'POST' },
  });
  expect(JSON.parse(args.init.body)).toEqual({
    templateId: 'resume-template',
    unmatchedPlaceholders: ['professionalSummary', 'skills'],
    placeholderMeta: [
      {
        key: 'professionalSummary',
        suggestedType: 'richtext',
        suggestedLabel: 'Professional Summary',
      },
    ],
    answers: {
      fullName: 'Alex Respondent',
      experience: '7 years building payments platforms',
    },
  });
});

it('caps answers at 64 keys of at most 4000 characters', async () => {
  const brContext = Object.fromEntries(
    Array.from({ length: 70 }, (_, index) => [
      `answer${index}`,
      index < 3 ? 'x'.repeat(4500) : `answer ${index}`,
    ]),
  );
  await POST(request({ ...mapperRequest, brContext }));

  const { answers } = JSON.parse(mockPlatformFetch.mock.calls[0][0].init.body);
  expect(Object.keys(answers)).toHaveLength(64);
  expect(answers.answer0).toHaveLength(4000);
  expect(answers.answer63).toBe('answer 63');
  expect(answers.answer64).toBeUndefined();
});

it('rejects an oversized body before calling PublicAPI', async () => {
  const response = await POST(
    request({ ...mapperRequest, brContext: { notes: 'x'.repeat(300_000) } }),
  );
  expect(response.status).toBe(413);
  expect(mockPlatformFetch).not.toHaveBeenCalled();
});

it.each([
  ['no unmatched blanks', { unmatchedPlaceholders: [] }],
  ['no usable answers', { brContext: { id: 'record-1', upload: {} } }],
])(
  'skips the AI call when there are %s',
  async (_label, patch: Record<string, unknown>) => {
    const response = await POST(request({ ...mapperRequest, ...patch }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ mappedFields: {} });
    expect(mockPlatformFetch).not.toHaveBeenCalled();
  },
);

it('refuses a template that is not bound to this workflow', async () => {
  const response = await POST(
    request({ ...mapperRequest, templateId: 'someone-elses-template' }),
  );
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    error: 'DOCUMENT_TEMPLATE_NOT_FOUND',
  });
  expect(mockPlatformFetch).not.toHaveBeenCalled();
});

it.each([
  [429, 429, 'RATE_LIMITED'],
  [404, 404, 'DOCUMENT_TEMPLATE_NOT_FOUND'],
  [503, 502, 'DOCUMENT_TEMPLATE_UNAVAILABLE'],
])(
  'maps a PublicAPI %s to %s',
  async (upstream: number, status: number, error: string) => {
    mockPlatformFetch.mockResolvedValue(
      new Response('{}', { status: upstream }),
    );
    const response = await POST(request(mapperRequest));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
  },
);

it('reports an unreachable platform as 503', async () => {
  mockPlatformFetch.mockRejectedValue(
    new GeneratedWorkflowPlatformUnavailableError(),
  );
  const response = await POST(request(mapperRequest));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: 'PLATFORM_UNAVAILABLE' });
});
