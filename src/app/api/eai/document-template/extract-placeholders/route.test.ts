/** @jest-environment node */
import { NextRequest } from 'next/server';

import {
  buildResumeTemplateDocx,
  RESUME_TEMPLATE_BLANKS,
} from '../../../../../../tests/fixtures/document-template/resume-template';

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
import { POST } from './route';

const ORIGIN = 'https://resume.test';

function request(body: unknown, origin: string | null = ORIGIN) {
  const headers = new Headers({
    'content-type': 'application/json',
    'x-forwarded-for': '192.0.2.1',
  });
  if (origin) headers.set('origin', origin);
  return new NextRequest(
    `${ORIGIN}/api/eai/document-template/extract-placeholders`,
    { method: 'POST', headers, body: JSON.stringify(body) },
  );
}

async function templateResponse(templateId = 'resume-template') {
  return new Response(
    JSON.stringify({
      templateId,
      title: 'Resume',
      filename: 'resume.docx',
      blankKeys: [...RESUME_TEMPLATE_BLANKS],
      file: {
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        base64: (await buildResumeTemplateDocx()).toString('base64'),
      },
    }),
    { headers: { 'content-type': 'application/json' } },
  );
}

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
                label: 'Your resume',
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
  mockPlatformFetch.mockImplementation(() => templateResponse());
});

it('returns the bound template blanks parsed from the PublicAPI template', async () => {
  const response = await POST(request({ templateId: 'resume-template' }));

  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store, no-cache');
  const body = await response.json();
  expect(
    body.placeholders.map((placeholder: { key: string }) => placeholder.key),
  ).toEqual([...RESUME_TEMPLATE_BLANKS]);
  expect(Array.isArray(body.sections)).toBe(true);
  expect(body.conditionalKeys).toEqual([]);
  expect(mockPlatformFetch).toHaveBeenCalledTimes(1);
  expect(mockPlatformFetch.mock.calls[0][0]).toMatchObject({
    tenantId: 'tenant-a',
    appKey: 'resume-builder',
    path: '/document-template?templateId=resume-template',
    anonymousClientId: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    init: { method: 'GET' },
  });
});

it.each([
  ['an unknown template', { templateId: 'other-template' }],
  ['a missing template id', {}],
  ['a non-string template id', { templateId: ['resume-template'] }],
])(
  'refuses %s before calling PublicAPI',
  async (_label, body: Record<string, unknown>) => {
    const response = await POST(request(body));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'DOCUMENT_TEMPLATE_NOT_FOUND',
    });
    expect(mockPlatformFetch).not.toHaveBeenCalled();
  },
);

it('refuses a cross-origin caller', async () => {
  const response = await POST(
    request({ templateId: 'resume-template' }, 'https://evil.test'),
  );
  expect(response.status).toBe(403);
  expect(mockPlatformFetch).not.toHaveBeenCalled();
});

it('refuses when no workflow runtime is bound', async () => {
  mockGetRuntime.mockReturnValue({ status: 'unconfigured' });
  const response = await POST(request({ templateId: 'resume-template' }));
  expect(response.status).toBe(503);
  expect(mockPlatformFetch).not.toHaveBeenCalled();
});

it.each([
  [404, 404, 'DOCUMENT_TEMPLATE_NOT_FOUND'],
  [429, 429, 'RATE_LIMITED'],
  [500, 502, 'DOCUMENT_TEMPLATE_UNAVAILABLE'],
])(
  'maps a PublicAPI %s to %s',
  async (upstream: number, status: number, error: string) => {
    mockPlatformFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: 'x' }), { status: upstream }),
    );
    const response = await POST(request({ templateId: 'resume-template' }));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
  },
);

it('treats a PublicAPI template for a different id as not found', async () => {
  mockPlatformFetch.mockImplementation(() => templateResponse('other'));
  const response = await POST(request({ templateId: 'resume-template' }));
  expect(response.status).toBe(404);
});
