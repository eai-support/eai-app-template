import {
  buildSubmissionData,
  buildWorkflowDefinition,
  fillableFields,
  isStepComplete,
  submissionObjectTypeFor,
  withOwnerProjectionRetry,
  type GeneratedWorkflowState,
} from './generated-workflow';
import { PlatformError } from '@enterpriseaigroup/platform-sdk';

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

  it('keeps required smart blocks non-fillable and hides fields they replace', () => {
    const fields = [
      { id: 'manual-review', name: 'manualReview', required: true },
      {
        id: 'automated-review',
        name: 'automatedReview',
        type: 'smart_block',
        required: true,
        replaces: ['manual-review'],
      },
    ];

    expect(fillableFields(fields)).toEqual([fields[1]]);
    expect(
      isStepComplete({ id: 'review', title: 'Review', fields }, {}),
    ).toBe(true);
  });

  it('keeps file metadata in payload but omits the file property before upload', () => {
    const file = new File(['evidence'], 'evidence.txt', { type: 'text/plain' });
    const data = buildSubmissionData(
      {
        ...workflow,
        steps: [
          {
            id: 'evidence',
            title: 'Evidence',
            fields: [{ name: 'evidence', type: 'file', required: true }],
          },
        ],
      },
      { evidence: file },
    );

    expect(data).not.toHaveProperty('evidence');
    expect(data.payload).toEqual({
      evidence: { name: 'evidence.txt', size: 8, type: 'text/plain' },
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

  it('bounds retries while owner-private access is being projected', async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(
        new PlatformError({ status: 403, code: 'FORBIDDEN', message: 'wait' }),
      )
      .mockResolvedValue('ok');
    const sleep = jest.fn().mockResolvedValue(undefined);

    await expect(withOwnerProjectionRetry(operation, sleep)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(100);
  });
});
