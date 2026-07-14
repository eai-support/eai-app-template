import { EAIConfigProvider } from '@enterpriseaigroup/core';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GeneratedWorkflowPage } from './generated-workflow';
import { useResources } from '@/hooks/useResources';
import type { GeneratedWorkflowState } from '@/lib/generated-workflow';

jest.mock('@/hooks/useResources', () => ({
  useResources: jest.fn(),
}));
jest.mock('@enterpriseaigroup/core', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  let generatedComponent: React.ComponentType<Record<string, unknown>> | null =
    null;
  const registry = {
    set: (
      _name: string,
      component: React.ComponentType<Record<string, unknown>>,
    ) => {
      generatedComponent = component;
    },
  };

  return {
    EAIConfigProvider: ({ children }: { children: React.ReactNode }) =>
      children,
    useConfig: () => ({ tenantId: 'tenant-a' }),
    useEAIConfig: () => ({ registry }),
    WorkflowShell: ({
      workflow,
      componentOverrides,
    }: {
      workflow: {
        stages: Array<{
          steps: Array<{
            page: { components: Array<{ props: Record<string, unknown> }> };
          }>;
        }>;
      };
      componentOverrides: Record<string, Record<string, unknown>>;
    }) => {
      const Component = generatedComponent;
      if (!Component) return null;
      const props = workflow.stages[0].steps[0].page.components[0].props;
      return React.createElement(Component, {
        ...props,
        ...componentOverrides.GeneratedWorkflowFields,
      });
    },
    Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
      React.createElement('button', props),
    Input: (props: React.InputHTMLAttributes<HTMLInputElement>) =>
      React.createElement('input', props),
    Label: (props: React.LabelHTMLAttributes<HTMLLabelElement>) =>
      React.createElement('label', props),
    Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) =>
      React.createElement('textarea', props),
    Checkbox: (props: {
      id?: string;
      checked?: boolean;
      onCheckedChange?: (checked: boolean) => void;
    }) =>
      React.createElement('input', {
        id: props.id,
        type: 'checkbox',
        checked: props.checked,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          props.onCheckedChange?.(event.target.checked),
      }),
    Select: ({ children }: { children: React.ReactNode }) => children,
    SelectTrigger: ({ children }: { children: React.ReactNode }) => children,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => children,
    SelectItem: ({ children }: { children: React.ReactNode }) => children,
  };
});

const mockUseResources = useResources as jest.MockedFunction<
  typeof useResources
>;

const workflow: GeneratedWorkflowState = {
  appKey: 'rates-review',
  displayName: 'Rates Review',
  submissionObjectType: 'RatesReviewSubmission',
  steps: [
    {
      id: 'intake',
      title: 'Intake',
      fields: [
        {
          name: 'applicantEmail',
          label: 'Applicant email',
          type: 'text',
          required: true,
        },
      ],
    },
  ],
};

describe('GeneratedWorkflowPage', () => {
  it('creates a draft and executes the existing ResourceAPI submit action', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'submission-1' });
    const executeAction = jest.fn().mockResolvedValue({});
    mockUseResources.mockReturnValue({
      create,
      get: jest.fn(),
      executeAction,
      uploadFile: jest.fn(),
    } as unknown as ReturnType<typeof useResources>);

    render(
      <EAIConfigProvider
        config={{ tenantId: 'tenant-a', store: {}, layout: {} }}
      >
        <GeneratedWorkflowPage workflow={workflow} />
      </EAIConfigProvider>,
    );

    await userEvent.type(
      screen.getByLabelText('Applicant email'),
      'person@example.com',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        status: 'draft',
        currentStep: 'intake',
        payload: { applicantEmail: 'person@example.com' },
        applicantEmail: 'person@example.com',
      });
      expect(executeAction).toHaveBeenCalledWith('submission-1', 'submit');
    });
    expect(screen.getByText('Your response has been submitted.')).toBeVisible();
  });

  it('retries a transient action failure against the same draft', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'submission-1' });
    const executeAction = jest
      .fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce({});
    const get = jest
      .fn()
      .mockResolvedValue({ data: { status: 'draft' }, version: 1 });
    const update = jest.fn().mockResolvedValue({});
    mockUseResources.mockReturnValue({
      create,
      get,
      update,
      executeAction,
      uploadFile: jest.fn(),
    } as unknown as ReturnType<typeof useResources>);

    render(
      <EAIConfigProvider
        config={{ tenantId: 'tenant-a', store: {}, layout: {} }}
      >
        <GeneratedWorkflowPage workflow={workflow} />
      </EAIConfigProvider>,
    );

    await userEvent.type(
      screen.getByLabelText('Applicant email'),
      'person@example.com',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await screen.findByText('Your response has been submitted.');
    expect(create).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      'submission-1',
      expect.objectContaining({ applicantEmail: 'person@example.com' }),
      1,
    );
    expect(executeAction).toHaveBeenCalledTimes(2);
  });

  it('creates the draft before uploading a required file and submitting', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'submission-file' });
    const uploadFile = jest.fn().mockResolvedValue({});
    const executeAction = jest.fn().mockResolvedValue({});
    mockUseResources.mockReturnValue({
      create,
      get: jest.fn(),
      uploadFile,
      executeAction,
    } as unknown as ReturnType<typeof useResources>);
    const fileWorkflow: GeneratedWorkflowState = {
      ...workflow,
      steps: [
        {
          id: 'evidence',
          title: 'Evidence',
          fields: [
            { name: 'evidence', label: 'Evidence', type: 'file', required: true },
          ],
        },
      ],
    };

    render(
      <EAIConfigProvider
        config={{ tenantId: 'tenant-a', store: {}, layout: {} }}
      >
        <GeneratedWorkflowPage workflow={fileWorkflow} />
      </EAIConfigProvider>,
    );
    const file = new File(['evidence'], 'evidence.txt', { type: 'text/plain' });
    await userEvent.upload(screen.getByLabelText('Evidence'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await screen.findByText('Your response has been submitted.');
    expect(create).toHaveBeenCalledWith(
      expect.not.objectContaining({ evidence: expect.anything() }),
    );
    expect(uploadFile).toHaveBeenCalledWith(
      'submission-file',
      'evidence',
      file,
      { filename: 'evidence.txt', contentType: 'text/plain' },
    );
    expect(executeAction).toHaveBeenCalledWith('submission-file', 'submit');
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(
      uploadFile.mock.invocationCallOrder[0],
    );
    expect(uploadFile.mock.invocationCallOrder[0]).toBeLessThan(
      executeAction.mock.invocationCallOrder[0],
    );
  });
});
