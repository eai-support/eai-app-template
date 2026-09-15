import { generatedWorkflowDocumentMetadata } from './document-metadata';

const binding = {
  schemaVersion: 'eai.generated_app_runtime_binding.v1' as const,
  workflowTemplate: {
    id: 'template-one',
    version: 3,
    digest: `sha256:${'a'.repeat(64)}` as `sha256:${string}`,
    title: 'Birthday bash',
  },
  respondentAccess: {
    mode: 'anonymous' as const,
    submissionObjectType: 'workflow-submission' as const,
    fileObjectType: 'submission-file' as const,
  },
};

describe('generated workflow document metadata', () => {
  it('uses the managed app name and tenant logo for browser chrome', () => {
    expect(
      generatedWorkflowDocumentMetadata({
        status: 'ready',
        runtime: {
          appKey: 'birthday-bash',
          tenantId: 'tenant-a',
          binding,
          snapshot: { steps: [] },
          branding: {
            displayName: 'Google',
            logoDataUrl: 'data:image/png;base64,cHVibGljLWxvZ28=',
          },
        },
      }),
    ).toEqual({
      title: 'Google',
      description: 'Birthday bash workflow for Google',
      icons: { icon: 'data:image/png;base64,cHVibGljLWxvZ28=' },
    });
  });

  it('keeps generic metadata only for the unconfigured template workspace', () => {
    expect(
      generatedWorkflowDocumentMetadata({ status: 'unconfigured' }),
    ).toEqual({
      title: 'EAI App Template',
      description: 'Enterprise AI application template',
      icons: { icon: '/favicon.ico' },
    });
  });

  it('uses the app name when tenant branding has no display name or logo', () => {
    expect(
      generatedWorkflowDocumentMetadata({
        status: 'ready',
        runtime: {
          appKey: 'birthday-bash',
          tenantId: 'tenant-a',
          binding,
          snapshot: { steps: [] },
        },
      }),
    ).toEqual({
      title: 'Birthday bash',
      description: 'Birthday bash workflow',
      icons: { icon: '/favicon.ico' },
    });
  });
});
