import {
  buildSubmissionData,
  buildWorkflowDefinition,
  isStepComplete,
  submissionObjectTypeFor,
  type GeneratedWorkflowState,
} from './generated-workflow';

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
        {
          name: 'priority',
          label: 'Priority',
          type: 'select',
          options: ['Normal', 'Urgent request'],
        },
      ],
    },
  ],
};

describe('generated workflow runtime', () => {
  it('turns generated steps into the existing WorkflowShell contract', () => {
    expect(buildWorkflowDefinition(workflow)).toMatchObject({
      slug: 'rates-review',
      stages: [
        {
          code: 'generated-workflow',
          steps: [
            {
              code: 'intake',
              page: {
                components: [
                  {
                    component: 'GeneratedWorkflowFields',
                    props: { isLastStep: true },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
  });

  it('requires builder-authored required fields before advancing', () => {
    expect(isStepComplete(workflow.steps[0], {})).toBe(false);
    expect(
      isStepComplete(workflow.steps[0], {
        applicantEmail: 'person@example.com',
      }),
    ).toBe(true);
  });

  it('builds the existing ResourceAPI submission payload', () => {
    expect(
      buildSubmissionData(workflow, {
        applicantEmail: 'person@example.com',
        priority: 'urgent-request',
      }),
    ).toEqual({
      status: 'draft',
      currentStep: 'intake',
      payload: {
        applicantEmail: 'person@example.com',
        priority: 'urgent-request',
      },
      applicantEmail: 'person@example.com',
      priority: 'urgent-request',
    });
  });

  it('normalises legacy select labels and omits smart-block display state', () => {
    expect(
      buildSubmissionData(
        {
          ...workflow,
          steps: [
            {
              ...workflow.steps[0],
              fields: [
                ...(workflow.steps[0].fields ?? []),
                { name: 'analysis', type: 'smart_block' },
              ],
            },
          ],
        },
        { priority: 'Urgent request', analysis: 'not resource data' },
      ),
    ).toMatchObject({
      payload: { priority: 'urgent-request' },
      priority: 'urgent-request',
    });
  });

  it('accepts an explicit false answer for a required boolean field', () => {
    expect(
      isStepComplete(
        {
          id: 'check',
          title: 'Check',
          fields: [{ name: 'confirmed', type: 'boolean', required: true }],
        },
        { confirmed: false },
      ),
    ).toBe(true);
  });

  it('derives the legacy app-specific submission Object Type name', () => {
    expect(
      submissionObjectTypeFor({ ...workflow, submissionObjectType: undefined }),
    ).toBe('RatesReviewSubmission');
  });
});
