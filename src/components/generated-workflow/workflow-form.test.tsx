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

    expect(screen.getByText('Contact details')).toBeVisible();
    const submit = await screen.findByRole('button', { name: 'Submit' });
    fireEvent.click(submit);
    expect(screen.getByText('This field is required.')).toBeVisible();

    fireEvent.change(screen.getByLabelText(/Full name/), {
      target: { value: 'Alex Respondent' },
    });
    fireEvent.click(submit);

    await waitFor(() => expect(screen.getByText('Submitted')).toBeVisible());
    expect(global.fetch).toHaveBeenLastCalledWith(
      '/api/eai/workflow-submissions/submission-1',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('Alex Respondent'),
      }),
    );
  });
});
