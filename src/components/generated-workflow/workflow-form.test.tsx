import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { GeneratedWorkflowForm } from './workflow-form';
import type { GeneratedAppRuntimeBinding } from '@/lib/generated-workflow/runtime-contract';

const binding: GeneratedAppRuntimeBinding = {
  schemaVersion: 'eai.generated_app_runtime_binding.v1',
  workflowTemplate: {
    id: 'template-123',
    version: 2,
    digest: `sha256:${'a'.repeat(64)}`,
    title: 'Rates Review',
  },
  respondentAccess: {
    mode: 'anonymous',
    submissionObjectType: 'workflow-submission',
    fileObjectType: 'submission-file',
  },
};

describe('GeneratedWorkflowForm', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ submissionId: 'submission-1' }),
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it.each([false, true])(
    'renders Q&A only when enabled for this app (%s)',
    async (assistantEnabled) => {
      render(
        <GeneratedWorkflowForm
          appKey='rates-review'
          binding={binding}
          assistantEnabled={assistantEnabled}
          snapshot={{
            steps: [{ id: 'request', title: 'Request', fields: [] }],
          }}
        />,
      );
      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
      expect(Boolean(screen.queryByLabelText('Workflow assistant'))).toBe(
        assistantEnabled,
      );
    },
  );

  it('adds the resumable submission URL without notifying the app router', async () => {
    const routerPatchedReplaceState = jest.fn();
    Object.defineProperty(window.history, 'replaceState', {
      configurable: true,
      value: routerPatchedReplaceState,
      writable: true,
    });

    try {
      render(
        <GeneratedWorkflowForm
          appKey='rates-review'
          binding={binding}
          snapshot={{
            steps: [{ id: 'request', title: 'Request', fields: [] }],
          }}
        />,
      );

      await screen.findByRole('button', { name: 'Submit' });
      expect(window.location.search).toBe('?submission=submission-1');
      expect(routerPatchedReplaceState).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    } finally {
      Reflect.deleteProperty(window.history, 'replaceState');
    }
  });

  it('renders exported fields, validates required answers, and completes anonymously', async () => {
    render(
      <GeneratedWorkflowForm
        appKey='rates-review'
        binding={binding}
        snapshot={{
          steps: [
            {
              id: 'contact',
              title: 'Contact details',
              fields: [
                {
                  id: 'full-name',
                  label: 'Full name',
                  type: 'text',
                  required: true,
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Contact details' }),
    ).toBeVisible();
    const submit = await screen.findByRole('button', { name: 'Submit' });
    fireEvent.click(submit);
    expect(screen.getByText('This field is required.')).toBeVisible();

    fireEvent.change(screen.getByLabelText(/Full name/), {
      target: { value: 'Alex Respondent' },
    });
    fireEvent.click(submit);

    await waitFor(() => expect(screen.getByText('Submitted')).toBeVisible());
    expect(screen.getByRole('main')).toHaveClass(
      'min-h-svh',
      'items-center',
      'justify-center',
      'text-center',
    );
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/eai/workflow-submissions/submission-1',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('Alex Respondent'),
      }),
    );
  });

  it('does not submit invalid formatted answers and accepts their correction', async () => {
    render(
      <GeneratedWorkflowForm
        appKey='rates-review'
        binding={binding}
        snapshot={{
          steps: [
            {
              id: 'contact',
              title: 'Contact',
              fields: [
                { id: 'email', label: 'Email', type: 'text', required: true },
                {
                  id: 'amount',
                  label: 'Amount',
                  type: 'text',
                  validation: { format: 'currency', min: 10, max: 20 },
                },
              ],
            },
          ],
        }}
      />,
    );
    const submit = await screen.findByRole('button', { name: 'Submit' });
    fireEvent.change(
      screen.getByLabelText(/Email/, { selector: '[id="contact.email"]' }),
      {
        target: { value: 'bad' },
      },
    );
    fireEvent.change(screen.getByLabelText(/Amount/), {
      target: { value: '9' },
    });
    fireEvent.click(submit);
    expect(screen.getByText('Enter a valid email address')).toBeVisible();
    expect(screen.getByText('Must be at least 10')).toBeVisible();
    expect(global.fetch).toHaveBeenCalledTimes(1);
    fireEvent.change(
      screen.getByLabelText(/Email/, { selector: '[id="contact.email"]' }),
      {
        target: { value: 'alex@example.com' },
      },
    );
    fireEvent.change(screen.getByLabelText(/Amount/), {
      target: { value: '12.50' },
    });
    fireEvent.click(submit);
    await screen.findByText('Submitted');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('returns a resumed form to an earlier invalid step before completing', async () => {
    window.history.replaceState(null, '', '/?submission=existing');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        submission: {
          status: 'in_progress',
          currentStep: 1,
          formData: { contact: { email: 'invalid' } },
        },
      }),
    });
    render(
      <GeneratedWorkflowForm
        appKey='rates-review'
        binding={binding}
        snapshot={{
          steps: [
            {
              id: 'contact',
              title: 'Contact',
              fields: [
                { id: 'email', label: 'Email', type: 'text', required: true },
              ],
            },
            { id: 'review', title: 'Review', fields: [] },
          ],
        }}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));
    expect(
      await screen.findByText('Enter a valid email address'),
    ).toBeVisible();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('renders the exported company brand snapshot', async () => {
    render(
      <GeneratedWorkflowForm
        appKey='rates-review'
        binding={binding}
        branding={{
          displayName: 'Acme Council',
          primaryColor: '#123ABC',
          secondaryColor: '#EDF4FF',
          accentColor: '#F59E0B',
          logoDataUrl: 'data:image/png;base64,cHVibGljLWxvZ28=',
        }}
        snapshot={{ steps: [{ id: 'one', title: 'One', fields: [] }] }}
      />,
    );

    expect(screen.getByText('Acme Council')).toBeVisible();
    expect(screen.getByAltText('Acme Council logo')).toBeVisible();
    expect(screen.getByLabelText('Published workflow')).toHaveStyle({
      '--primary': '#123ABC',
      '--secondary': '#EDF4FF',
    });
    expect(await screen.findByRole('button', { name: 'Submit' })).toHaveClass(
      'bg-primary',
      'text-primary-foreground',
    );
  });

  it('matches the signed two-panel workflow preview shell', async () => {
    render(
      <GeneratedWorkflowForm
        appKey='rates-review'
        binding={binding}
        assistantEnabled
        branding={{ displayName: 'Acme Council' }}
        snapshot={{
          steps: [
            { id: 'request', title: 'Request', fields: [] },
            { id: 'review', title: 'Review', fields: [] },
          ],
        }}
      />,
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Published workflow')).toHaveClass(
      'h-full',
      'min-h-0',
      'overflow-hidden',
    );
    expect(screen.getByLabelText('Acme Council branding')).toBeVisible();
    expect(
      screen.getByRole('navigation', { name: 'Workflow steps' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: '1 Request' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByLabelText('Workflow assistant')).toHaveClass('border-l');
    expect(
      await screen.findByRole('button', { name: 'Continue' }),
    ).toBeVisible();
  });

  it('renders canonical step blocks in order and persists declared outputs', async () => {
    render(
      <GeneratedWorkflowForm
        appKey='rates-review'
        binding={binding}
        snapshot={{
          steps: [
            {
              id: 'review',
              title: 'Review',
              fields: [],
              blocks: [
                {
                  id: 'approval-1',
                  blockId: 'approvals',
                  order: 20,
                  config: {
                    presentationConfig: { title: 'Manager approval' },
                    dataConfig: {},
                    businessLogic: {},
                    accessControl: {},
                    actionsConfig: {},
                  },
                  bindings: {
                    policy: { kind: 'literal', value: 'Rates policy' },
                  },
                  outputs: [
                    {
                      name: 'decision',
                      valueType: 'string',
                      required: true,
                    },
                  ],
                },
                {
                  id: 'checklist-1',
                  blockId: 'document-checklist',
                  order: 10,
                  config: {
                    presentationConfig: { title: 'Required documents' },
                    dataConfig: {},
                    businessLogic: {},
                    accessControl: {},
                    actionsConfig: {},
                  },
                  bindings: {},
                },
              ],
            },
          ],
        }}
      />,
    );

    await screen.findByRole('button', { name: 'Submit' });
    expect(
      screen
        .getByText('Required documents')
        .compareDocumentPosition(screen.getByText('Manager approval')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(
      screen.getByText('Complete the required guided activity outputs.'),
    ).toBeVisible();
    fireEvent.change(screen.getByLabelText(/decision/), {
      target: { value: 'approved' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(screen.getByText('Submitted')).toBeVisible());
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/eai/workflow-submissions/submission-1',
      expect.objectContaining({
        body: expect.stringContaining(
          '"__blocks":{"approval-1.decision":"approved"}',
        ),
      }),
    );
  });

  it('fails visibly when a canonical block has no runtime adapter', async () => {
    render(
      <GeneratedWorkflowForm
        appKey='rates-review'
        binding={binding}
        snapshot={{
          steps: [
            {
              id: 'review',
              title: 'Review',
              blocks: [
                {
                  id: 'custom-1',
                  blockId: 'customer.unsupported',
                  order: 0,
                  config: {
                    presentationConfig: {},
                    dataConfig: {},
                    businessLogic: {},
                    accessControl: {},
                    actionsConfig: {},
                  },
                  bindings: {},
                },
              ],
            },
          ],
        }}
      />,
    );

    expect(
      await screen.findByText(/unsupported block “customer\.unsupported”/),
    ).toBeVisible();
    expect(
      await screen.findByRole('button', { name: 'Submit' }),
    ).toBeDisabled();
    expect(screen.queryByText('Submitted')).not.toBeInTheDocument();
  });
});
