import { act, render, screen, waitFor } from '@testing-library/react';
import type {
  TemplateFormFillActionPayload,
  TemplateFormFillProps,
} from '@enterpriseaigroup/core';

import {
  DocumentCreationBlock,
  documentTemplateActionHandler,
} from './document-creation-block';
import type { DocumentCreationField } from '@/lib/generated-workflow/document-creation';

const mockTemplateFormFill = jest.fn();
jest.mock('@enterpriseaigroup/core', () => ({
  TemplateFormFill: (props: Record<string, unknown>) => {
    mockTemplateFormFill(props);
    return null;
  },
}));

/** jsdom has no Fetch API Response; this covers what TemplateFormFill reads. */
class TestResponse {
  readonly status: number;
  readonly headers: Headers;
  constructor(
    private readonly text: string,
    init?: ResponseInit,
  ) {
    this.status = init?.status ?? 200;
    this.headers = new Headers(init?.headers);
  }
  get ok() {
    return this.status >= 200 && this.status < 300;
  }
  async json() {
    return JSON.parse(this.text);
  }
}

const field: DocumentCreationField = {
  id: 'resumeDocument',
  label: 'Your resume',
  type: 'smart_block',
  blockType: 'document-creation',
  templateId: 'resume-template',
};
const structure = {
  placeholders: [
    {
      key: 'fullName',
      suggestedType: 'text',
      suggestedLabel: 'Full Name',
      context: 'paragraph',
    },
    {
      key: 'professionalSummary',
      suggestedType: 'richtext',
      suggestedLabel: 'Professional Summary',
      context: 'paragraph',
    },
  ],
  sections: [],
  conditionalKeys: [],
};

function jsonReply(body: unknown, status = 200) {
  return { ok: status < 300, status, json: async () => body };
}

function lastProps(): TemplateFormFillProps {
  return mockTemplateFormFill.mock.calls.at(-1)?.[0] as TemplateFormFillProps;
}

function requestBody(call: number): Record<string, unknown> {
  const init = (global.fetch as jest.Mock).mock.calls[call][1] as RequestInit;
  return JSON.parse(String(init.body));
}

describe('DocumentCreationBlock', () => {
  const originalFetch = global.fetch;
  const globals = global as { Response?: unknown };
  const originalResponse = globals.Response;

  beforeEach(() => {
    mockTemplateFormFill.mockClear();
    globals.Response = TestResponse;
    global.fetch = jest.fn(async () => jsonReply(structure)) as jest.Mock;
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
    globals.Response = originalResponse;
  });

  it('hosts one bound template with the answers so far and the loaded blanks', async () => {
    render(
      <DocumentCreationBlock
        field={field}
        answers={{ id: 'record-1', fullName: 'Alex Respondent' }}
        tenantId='resume-app'
      />,
    );

    await waitFor(() =>
      expect(lastProps().templatePlaceholders?.loading).toBe(false),
    );
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/eai/document-template/extract-placeholders',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(requestBody(0)).toEqual({ templateId: 'resume-template' });
    const props = lastProps();
    expect(props.documentTemplates).toEqual([
      {
        id: 'resume-template',
        title: 'Your resume',
        filename: 'resume-template.docx',
        url: 'template:resume-template',
      },
    ]);
    expect(props.templatePlaceholders).toEqual({
      ...structure,
      loading: false,
      error: null,
    });
    expect(props.businessRequest).toEqual({ fullName: 'Alex Respondent' });
    expect(props.tenantId).toBe('resume-app');
    expect(props.businessLogic).toEqual({
      chatbotEnabled: false,
      exportFormats: ['docx'],
    });
    expect(props.renderEditor).toBeUndefined();
    expect(screen.getByRole('region', { name: 'Your resume' })).toHaveAttribute(
      'data-eai-document-template',
      'resume-template',
    );
  });

  it('reports a template that cannot be loaded', async () => {
    global.fetch = jest.fn(async () =>
      jsonReply({ error: 'DOCUMENT_TEMPLATE_NOT_FOUND' }, 404),
    ) as jest.Mock;
    render(<DocumentCreationBlock field={field} answers={{}} tenantId='app' />);

    await waitFor(() =>
      expect(lastProps().templatePlaceholders).toMatchObject({
        loading: false,
        error: 'The document template could not be loaded.',
        placeholders: [],
      }),
    );
  });

  it('remounts the template form only after new answers settle', async () => {
    jest.useFakeTimers();
    const { rerender } = render(
      <DocumentCreationBlock
        field={field}
        answers={{ fullName: 'Alex' }}
        tenantId='app'
      />,
    );
    rerender(
      <DocumentCreationBlock
        field={field}
        answers={{ fullName: 'Alex R' }}
        tenantId='app'
      />,
    );
    expect(lastProps().businessRequest).toEqual({ fullName: 'Alex' });
    await act(async () => {
      jest.advanceTimersByTime(800);
    });
    expect(lastProps().businessRequest).toEqual({ fullName: 'Alex R' });
  });
});

describe('documentTemplateActionHandler', () => {
  const originalFetch = global.fetch;
  const globals = global as { Response?: unknown };
  const originalResponse = globals.Response;
  const onTemplateAction = documentTemplateActionHandler('resume-template');

  beforeEach(() => {
    globals.Response = TestResponse;
  });
  afterEach(() => {
    global.fetch = originalFetch;
    globals.Response = originalResponse;
  });

  it('maps unmatched blanks through the AI route and shows AI HTML as plain text', async () => {
    global.fetch = jest.fn(async () =>
      jsonReply({
        mappedFields: {
          professionalSummary:
            '<p>Seasoned engineer &amp; mentor.</p><p>Leads teams.</p>',
          skills: 'TypeScript',
        },
      }),
    ) as jest.Mock;

    const response = await onTemplateAction({
      type: 'aiFieldMapper',
      unmatchedPlaceholders: ['professionalSummary', 'skills'],
      placeholderMeta: structure.placeholders,
      brContext: { id: 'record-1', fullName: 'Alex', resume: { file: true } },
    } as TemplateFormFillActionPayload);

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/eai/document-template/ai-field-mapper',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(requestBody(0)).toEqual({
      templateId: 'resume-template',
      unmatchedPlaceholders: ['professionalSummary', 'skills'],
      placeholderMeta: [
        {
          key: 'fullName',
          suggestedType: 'text',
          suggestedLabel: 'Full Name',
        },
        {
          key: 'professionalSummary',
          suggestedType: 'richtext',
          suggestedLabel: 'Professional Summary',
        },
      ],
      brContext: { fullName: 'Alex' },
    });
    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual({
      mappedFields: {
        professionalSummary: 'Seasoned engineer & mentor.\n\nLeads teams.',
        skills: 'TypeScript',
      },
    });
  });

  it('passes an AI mapping failure through for TemplateFormFill to ignore', async () => {
    global.fetch = jest.fn(async () =>
      jsonReply({ error: 'RATE_LIMITED' }, 429),
    ) as jest.Mock;
    const response = await onTemplateAction({
      type: 'aiFieldMapper',
      unmatchedPlaceholders: ['skills'],
      placeholderMeta: [],
      brContext: { fullName: 'Alex' },
    } as unknown as TemplateFormFillActionPayload);
    expect(response.status).toBe(429);
  });

  it('fills through the template route with rich-text blanks sent as paragraph HTML', async () => {
    const docx = { ok: true, status: 200, blob: async () => 'docx-bytes' };
    global.fetch = jest.fn(async () => docx) as jest.Mock;

    const response = await onTemplateAction({
      type: 'templateFill',
      templateBlobPath: 'template:resume-template',
      placeholders: {
        fullName: 'Alex <Respondent>',
        professionalSummary: 'Seasoned & kind.\n\nLeads teams.\nShips.',
      },
      richTextKeys: ['professionalSummary'],
      imageFieldKeys: [],
      extraTableRows: [],
      deletedTableRows: [],
      outputFilename: 'Your resume_filled.docx',
    });

    expect(response).toBe(docx);
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/eai/document-template/template-fill',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(requestBody(0)).toEqual({
      templateId: 'resume-template',
      placeholders: {
        fullName: 'Alex <Respondent>',
        professionalSummary:
          '<p>Seasoned &amp; kind.</p><p>Leads teams.<br>Ships.</p>',
      },
      richTextKeys: ['professionalSummary'],
      imageFieldKeys: [],
      extraTableRows: [],
      deletedTableRows: [],
      outputFilename: 'Your resume_filled.docx',
    });
  });

  it.each([
    { type: 'listTemplates' },
    { type: 'fetchSkillConfig' },
    { type: 'searchKnowledgeBase', query: 'rates' },
    {
      type: 'autoSave',
      businessRequestId: 'br-1',
      savePath: 'formData',
      data: {},
    },
  ] as TemplateFormFillActionPayload[])(
    'answers unsupported $type actions with 501 and no network call',
    async (payload) => {
      global.fetch = jest.fn() as jest.Mock;
      const response = await onTemplateAction(payload);
      expect(response.status).toBe(501);
      expect(await response.json()).toEqual({ error: 'not-implemented' });
      expect(global.fetch).not.toHaveBeenCalled();
    },
  );
});
