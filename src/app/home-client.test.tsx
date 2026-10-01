import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

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
  it('keeps the selected live create in the trusted host outside the simulated frame', async () => {
    const originalFetch = global.fetch;
    const digest = `sha256:${'a'.repeat(64)}`;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({
      schemaVersion: 'eai.generated_app_operational_rows.v1',
      acceptedArtifactDigest: digest, fixtureCollection: 'vehicles', rows: [],
    }) });
    try {
      const { container } = render(<HomeClient
        generatedDemo={{ sourceDigest: 'source-sha', fixtureDigest: 'fixture-sha' }}
        generatedOperational={{ acceptedArtifactDigest: digest,
          fixtureCollection: 'vehicles', maxRows: 2, projectedFields: ['name'],
          createFields: [{ name: 'name', type: 'text', required: true }] }} />);
      expect(await screen.findByRole('region', { name: 'Reviewed live create' })).toHaveTextContent('your account permissions');
      expect(screen.getByRole('button', { name: 'Create record' })).toBeInTheDocument();
      expect(screen.getByTitle('Generated app demo')).toHaveAttribute('sandbox', 'allow-scripts');
      expect(container.querySelector('[data-eai-operational-create="true"]')).toBeInTheDocument();
      expect(screen.getByText(/Sample data and simulated interactions/)).toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });
  it('shows only the reviewed live slot for the selected view without sending rows into the frame', async () => {
    const originalFetch = global.fetch;
    const digest = `sha256:${'a'.repeat(64)}`;
    const sourceDigest = `sha256:${'b'.repeat(64)}`;
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      const booking = url.includes('viewId=booking-view');
      return { ok: true, json: async () => ({
        schemaVersion: 'eai.generated_app_operational_rows.v1',
        acceptedArtifactDigest: digest,
        fixtureCollection: booking ? 'bookings' : 'vehicles',
        rows: [{ id: booking ? 'booking-1' : 'vehicle-1',
          [booking ? 'status' : 'name']: booking ? 'confirmed' : 'Car A' }],
      }) };
    });
    try {
      render(<HomeClient generatedDemo={{ sourceDigest, fixtureDigest: 'fixture-sha',
        workflowViews: ['fleet-view', 'booking-view', 'confirmation-view'],
        workflowSteps: [
          { id: 'fleet', title: 'Fleet', viewId: 'fleet-view' },
          { id: 'booking', title: 'Booking', viewId: 'booking-view' },
          { id: 'confirmation', title: 'Confirmation', viewId: 'confirmation-view' },
        ],
        trustedViews: [
          { id: 'fleet-view', title: 'Fleet', trustedLayout: { columns: 2, slots: [
            { componentId: 'fleet-copy', kind: 'static-copy', title: 'Introduction', text: '<script>unsafe</script>' },
            { componentId: 'fleet-table', kind: 'read-table', title: 'Fleet cars', columnSpan: 2 },
          ] } },
          { id: 'booking-view', title: 'Booking', trustedLayout: { columns: 1, slots: [
            { componentId: 'booking-table', kind: 'read-table', title: 'Bookings' },
          ] } },
          { id: 'confirmation-view', title: 'Confirmation', trustedLayout: { columns: 1, slots: [
            { componentId: 'confirmation-copy', kind: 'static-copy', title: 'Confirmed', text: 'Review bookings' },
          ] } },
        ] }}
      generatedOperational={{ acceptedArtifactDigest: digest,
        fixtureCollection: 'vehicles', maxRows: 2, projectedFields: ['name'],
        bindings: [
          { viewId: 'fleet-view', viewTitle: 'Fleet', componentId: 'fleet-table',
            fixtureCollection: 'vehicles', maxRows: 2, projectedFields: ['name'] },
          { viewId: 'booking-view', viewTitle: 'Booking', componentId: 'booking-table',
            fixtureCollection: 'bookings', maxRows: 2, projectedFields: ['status'] },
        ] }} />);
      expect(await screen.findByText('Car A')).toBeVisible();
      expect(screen.queryByTitle('Generated app demo')).not.toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Live app view' }).querySelector('script')).toBeNull();
      expect(screen.getByText('<script>unsafe</script>')).toBeVisible();
      expect(screen.getByText('Car A').closest('[data-eai-operational-slot]'))
        .toHaveAttribute('data-eai-operational-slot', 'fleet-table');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: 'Booking' }));
      await waitFor(() => expect(screen.queryByText('Car A')).not.toBeInTheDocument());
      expect(await screen.findByText('confirmed')).toBeVisible();
      expect(screen.getByText('confirmed').closest('[data-eai-operational-slot]'))
        .toHaveAttribute('data-eai-operational-slot', 'booking-table');
      fireEvent.click(screen.getByRole('button', { name: 'Confirmation' }));
      await waitFor(() => expect(screen.queryByText('confirmed')).not.toBeInTheDocument());
      expect(screen.getByText('Review bookings')).toBeVisible();
      expect(global.fetch).toHaveBeenCalledTimes(2);
      fireEvent.click(screen.getByRole('button', { name: 'Sample preview' }));
      expect(screen.getByTitle('Generated app demo')).toHaveAttribute('sandbox', 'allow-scripts');
      expect(screen.queryByText('Review bookings')).not.toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });
  it('coalesces a burst of valid frame navigation messages into one reviewed live read', async () => {
    const originalFetch = global.fetch;
    const digest = `sha256:${'a'.repeat(64)}`;
    const sourceDigest = `sha256:${'b'.repeat(64)}`;
    global.fetch = jest.fn().mockImplementation(async (url: string) => ({
      ok: true, json: async () => ({
        schemaVersion: 'eai.generated_app_operational_rows.v1',
        acceptedArtifactDigest: digest,
        fixtureCollection: url.includes('booking-view') ? 'bookings' : 'vehicles',
        rows: [{ id: 'row-1', [url.includes('booking-view') ? 'status' : 'name']:
          url.includes('booking-view') ? 'confirmed' : 'Car A' }],
      }),
    }));
    try {
      render(<HomeClient generatedDemo={{ sourceDigest, fixtureDigest: 'fixture-sha',
        workflowViews: ['fleet-view', 'booking-view'],
        trustedViews: [
          { id: 'fleet-view', title: 'Fleet', trustedLayout: { columns: 1, slots: [
            { componentId: 'fleet-table', kind: 'read-table', title: 'Fleet' },
          ] } },
          { id: 'booking-view', title: 'Booking', trustedLayout: { columns: 1, slots: [
            { componentId: 'booking-table', kind: 'read-table', title: 'Booking' },
          ] } },
        ] }}
      generatedOperational={{ acceptedArtifactDigest: digest,
        fixtureCollection: 'vehicles', maxRows: 2, projectedFields: ['name'],
        bindings: [
          { viewId: 'fleet-view', viewTitle: 'Fleet', componentId: 'fleet-table',
            fixtureCollection: 'vehicles', maxRows: 2, projectedFields: ['name'] },
          { viewId: 'booking-view', viewTitle: 'Booking', componentId: 'booking-table',
            fixtureCollection: 'bookings', maxRows: 2, projectedFields: ['status'] },
        ] }} />);
      expect(await screen.findByText('Car A')).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: 'Sample preview' }));
      const frame = screen.getByTitle('Generated app demo') as HTMLIFrameElement;
      const send = (viewId: string) => act(() => window.dispatchEvent(new MessageEvent('message', {
        source: frame.contentWindow, origin: 'null', data: {
          type: 'eai.generated_app_view.v1', acceptedArtifactDigest: digest, sourceDigest, viewId,
        },
      })));
      send('booking-view');
      send('fleet-view');
      send('booking-view');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
      expect(global.fetch).toHaveBeenCalledTimes(2);
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
