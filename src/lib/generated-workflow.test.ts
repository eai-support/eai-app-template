import {
  buildSubmissionData,
  buildWorkflowDefinition,
  isStepComplete,
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
          options: ['Normal', 'Urgent'],
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
        priority: 'Urgent',
      }),
    ).toEqual({
      status: 'draft',
      currentStep: 'intake',
      payload: { applicantEmail: 'person@example.com', priority: 'Urgent' },
      applicantEmail: 'person@example.com',
      priority: 'Urgent',
    });
  });
});
