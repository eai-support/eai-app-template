/** @jest-environment node */
import { NextRequest } from 'next/server';

import { plainTextToRichTextHtml } from '@/lib/generated-workflow/document-creation';
import {
  buildResumeTemplateDocx,
  readDocxText,
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
const DOCX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const LEFTOVER_BLANK = /\{[A-Za-z_][\w.:]*\}/;

function request(body: unknown) {
  return new NextRequest(`${ORIGIN}/api/eai/document-template/template-fill`, {
    method: 'POST',
    headers: {
      origin: ORIGIN,
      'content-type': 'application/json',
      'x-forwarded-for': '192.0.2.1',
    },
    body: JSON.stringify(body),
  });
}

/** What the document block sends: rich-text blanks as `<p>` HTML from the textarea text. */
const values = {
  fullName: 'Alex Respondent',
  email: 'alex@example.com',
  professionalSummary:
    'Payments engineer & team lead.\n\nShips reliable <regulated> systems.',
  workHistory:
    'Acme Pay - Senior Engineer (2019-2024)\nLed the ledger rewrite.\n\nGlobex - Engineer (2015-2019)',
  skills: 'TypeScript, Python, PostgreSQL',
};
const fillRequest = {
  templateId: 'resume-template',
  placeholders: {
    ...values,
    professionalSummary: plainTextToRichTextHtml(values.professionalSummary),
    workHistory: plainTextToRichTextHtml(values.workHistory),
  },
  richTextKeys: ['professionalSummary', 'workHistory'],
  imageFieldKeys: [],
  extraTableRows: [],
  deletedTableRows: [],
  outputFilename: 'Your resume_filled.docx',
};

async function templateResponse() {
  return new Response(
    JSON.stringify({
      templateId: 'resume-template',
      title: 'Resume',
      filename: 'resume.docx',
      blankKeys: [...RESUME_TEMPLATE_BLANKS],
      file: {
        contentType: DOCX_CONTENT_TYPE,
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

it('fills the bound resume template and returns a valid .docx with every value', async () => {
  const response = await POST(request(fillRequest));

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe(DOCX_CONTENT_TYPE);
  expect(response.headers.get('content-disposition')).toBe(
    'attachment; filename="Your resume_filled.docx"',
  );
  expect(response.headers.get('cache-control')).toBe('no-store, no-cache');
  expect(mockPlatformFetch.mock.calls[0][0]).toMatchObject({
    tenantId: 'tenant-a',
    appKey: 'resume-builder',
    path: '/document-template?templateId=resume-template',
    anonymousClientId: expect.stringMatching(/^sha256:/),
  });

  const { xml, text } = await readDocxText(await response.arrayBuffer());
  for (const expected of [
    'Alex Respondent',
    'Email: alex@example.com',
    'Payments engineer & team lead.',
    'Ships reliable <regulated> systems.',
    'Acme Pay - Senior Engineer (2019-2024)\nLed the ledger rewrite.',
    'Globex - Engineer (2015-2019)',
    'TypeScript, Python, PostgreSQL',
  ]) {
    expect(text).toContain(expected);
  }
  // Rich-text paragraphs stay separate Word paragraphs.
  expect(text).toContain(
    'Payments engineer & team lead.\nShips reliable <regulated> systems.',
  );
  expect(xml).not.toContain('undefined');
  expect(xml).not.toContain('___RTMK_');
  expect(xml).not.toMatch(LEFTOVER_BLANK);
});

it('leaves no undefined or raw blank when a value is missing', async () => {
  const { skills: _skills, ...placeholders } = fillRequest.placeholders;
  void _skills;
  const response = await POST(request({ ...fillRequest, placeholders }));

  expect(response.status).toBe(200);
  const { xml, text } = await readDocxText(await response.arrayBuffer());
  expect(text).toContain('Alex Respondent');
  expect(xml).not.toContain('undefined');
  expect(xml).not.toMatch(LEFTOVER_BLANK);
});

it('refuses a template that is not bound to this workflow', async () => {
  const response = await POST(
    request({ ...fillRequest, templateId: 'payroll-template' }),
  );
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    error: 'DOCUMENT_TEMPLATE_NOT_FOUND',
  });
  expect(mockPlatformFetch).not.toHaveBeenCalled();
});

it('rejects values that are not a placeholder map', async () => {
  const response = await POST(request({ ...fillRequest, placeholders: [] }));
  expect(response.status).toBe(400);
  expect(mockPlatformFetch).not.toHaveBeenCalled();
});

it('keeps the download filename header-safe', async () => {
  const response = await POST(
    request({
      ...fillRequest,
      outputFilename: 'cv"\r\nSet-Cookie: x=1;/../é.docx',
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('content-disposition')).toBe(
    'attachment; filename="cv_Set-Cookie_ x_1.docx"',
  );
});

it('passes PublicAPI rate limiting through', async () => {
  mockPlatformFetch.mockResolvedValue(new Response('{}', { status: 429 }));
  const response = await POST(request(fillRequest));
  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ error: 'RATE_LIMITED' });
});
