import { act, render, screen } from '@testing-library/react';

import { HomeClient } from './home-client';

jest.mock('@enterpriseaigroup/demo', () => ({
  DemoPage: () => <div>Demo fallback</div>,
}));

jest.mock('@/components/generated-workflow/workflow-form', () => ({
  GeneratedWorkflowForm: ({
    branding,
    assistantEnabled,
  }: {
    branding?: { displayName?: string };
    assistantEnabled?: boolean;
  }) => (
    <div data-assistant-enabled={assistantEnabled}>
      {branding?.displayName ?? 'Generated workflow form'}
    </div>
  ),
}));

describe('HomeClient generated workflow runtime', () => {
  it('renders a sandboxed demo without serializing the accepted source or fixtures into the parent', () => {
    const { container } = render(
      <HomeClient
        generatedDemo={{
          sourceDigest: 'source-sha',
          fixtureDigest: 'fixture-sha',
        }}
      />,
    );
    const frame = screen.getByTitle('Generated app demo');
    expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
    expect(frame).toHaveAttribute('src', '/eai-demo-frame');
    expect(
      container.querySelector('[data-eai-demo-ready="true"]'),
    ).toHaveAttribute('data-eai-demo-source-digest', 'source-sha');
    expect(container.textContent).toMatch(
      /Sample data and simulated interactions/,
    );
    expect(container.innerHTML).not.toContain('GeneratedApp');
  });
  it('does not mount the generated frame when an authorized operational read is denied', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    try {
      render(<HomeClient generatedDemo={{ sourceDigest: 'source-sha', fixtureDigest: 'fixture-sha' }}
        generatedOperational={{ acceptedArtifactDigest: `sha256:${'a'.repeat(64)}`,
          fixtureCollection: 'vehicles', maxRows: 2, projectedFields: ['name'] }} />);
      expect(await screen.findByRole('alert')).toHaveTextContent('No sample data was substituted');
      expect(screen.queryByTitle('Generated app demo')).not.toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });
  it('renders authorized rows as trusted text while the generated frame stays sample-only', async () => {
    const originalFetch = global.fetch;
    const digest = `sha256:${'a'.repeat(64)}`;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({
      schemaVersion: 'eai.generated_app_operational_rows.v1',
      acceptedArtifactDigest: digest, fixtureCollection: 'vehicles',
      rows: [{ id: 'vehicle-1', name: '<img src=x onerror=alert(1)>' }],
    }) });
    try {
      const { container } = render(<HomeClient
        generatedDemo={{ sourceDigest: 'source-sha', fixtureDigest: 'fixture-sha' }}
        generatedOperational={{ acceptedArtifactDigest: digest,
          fixtureCollection: 'vehicles', maxRows: 2, projectedFields: ['name'] }} />);
      const frame = await screen.findByTitle('Generated app demo') as HTMLIFrameElement;
      expect(container.querySelector('[data-eai-demo-ready="true"]')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Live read-only data' })).toHaveTextContent('<img src=x onerror=alert(1)>');
      expect(screen.getByRole('region', { name: 'Live read-only data' }).querySelector('img')).toBeNull();
      expect(frame).toHaveAttribute('src', '/eai-demo-frame');
      expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
      const framePostMessage = jest.spyOn(frame.contentWindow!, 'postMessage');
      act(() => window.dispatchEvent(new MessageEvent('message', {
        source: frame.contentWindow, origin: 'null', data: { rows: [{ id: 'secret', name: 'ignore' }] },
      })));
      expect(framePostMessage).not.toHaveBeenCalled();
      expect(screen.getByText(/Sample data and simulated interactions/)).toBeVisible();
    } finally {
      global.fetch = originalFetch;
    }
  });
  it('exposes semantic workflow markers on the rendered root', () => {
    const { container } = render(
      <HomeClient
        generatedWorkflow={{
          appKey: 'rates-review',
          assistantEnabled: true,
          binding: {
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
          },
          branding: { displayName: 'Acme Council' },
          snapshot: { steps: [{ id: 'one', title: 'One', fields: [] }] },
        }}
      />,
    );

    const marker = container.querySelector('[data-eai-workflow-ready="true"]');
    expect(marker).toHaveAttribute(
      'data-eai-workflow-digest',
      `sha256:${'a'.repeat(64)}`,
    );
    expect(marker).toHaveAttribute('data-eai-workflow-title', 'Rates Review');
    expect(screen.getByText('Acme Council')).toBeVisible();
    expect(screen.getByText('Acme Council')).toHaveAttribute(
      'data-assistant-enabled',
      'true',
    );
  });

  it('keeps the general template demo when no generated runtime is exported', async () => {
    render(<HomeClient />);

    expect(await screen.findByText('Demo fallback')).toBeVisible();
  });
});
