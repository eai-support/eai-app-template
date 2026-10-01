import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { HomeClient } from './home-client';

jest.mock('@enterpriseaigroup/demo', () => ({
  DemoPage: () => <div>Demo fallback</div>,
}));

jest.mock('@/components/generated-workflow/workflow-form', () => ({
  GeneratedWorkflowForm: ({ branding, assistantEnabled }: {
    branding?: { displayName?: string }; assistantEnabled?: boolean;
  }) => <div data-assistant-enabled={assistantEnabled}>{branding?.displayName ?? 'Generated workflow form'}</div>,
}));

const fixtures = {
  schemaVersion: 'eai.generated_app_fixtures.v1' as const,
  collections: { vehicles: [{ id: 'car-1', name: '<img src=x onerror=alert(1)>', status: 'available' }] },
  actions: { book: { effect: 'session-local' as const, message: 'Booking previewed' } },
};

const safeUi = {
  version: 'eai.safe_ui.v1' as const,
  root: { kind: 'stack' as const, direction: 'column' as const, gap: 'md' as const, children: [
    { kind: 'heading' as const, level: 1 as const, text: 'Fleet dashboard' },
    { kind: 'stat' as const, label: 'First car', value: {
      kind: 'fixture' as const, collection: 'vehicles', field: 'name', rowIndex: 0,
    } },
    { kind: 'table' as const, fixtureCollection: 'vehicles', columns: [
      { field: 'name', label: 'Car' }, { field: 'status', label: 'Status' },
    ] },
    { kind: 'input' as const, id: 'query', label: 'Search', inputType: 'text' as const },
    { kind: 'button' as const, label: 'Book', actionId: 'book' },
    { kind: 'view-link' as const, label: 'Open booking', targetViewId: 'booking-view' },
  ] },
};

const demo = {
  appName: 'Fleet Demo', sourceDigest: 'source-sha', fixtureDigest: 'fixture-sha',
  previewFixtures: fixtures,
  workflowViews: ['fleet-view', 'booking-view'],
  workflowSteps: [
    { id: 'fleet', title: 'Fleet', viewId: 'fleet-view' },
    { id: 'booking', title: 'Booking', viewId: 'booking-view' },
  ],
  trustedViews: [
    { id: 'fleet-view', title: 'Fleet', safeUi, trustedLayout: { columns: 1 as const, slots: [
      { componentId: 'fleet-table', kind: 'read-table' as const, title: 'Vehicles' },
    ] } },
    { id: 'booking-view', title: 'Booking', safeUi: {
      version: 'eai.safe_ui.v1' as const,
      root: { kind: 'text' as const, text: 'Booking page' },
    } },
  ],
};

describe('HomeClient generated app runtime', () => {
  it('renders accepted safe components with escaped fixture data and local-only actions', () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn();
    try {
      const { container } = render(<HomeClient generatedDemo={demo} />);
      const preview = screen.getByRole('region', { name: 'Safe app preview' });
      expect(preview).toHaveTextContent('Fleet dashboard');
      expect(preview).toHaveTextContent('<img src=x onerror=alert(1)>');
      expect(preview.querySelector('img')).toBeNull();
      expect(preview.querySelector('iframe')).toBeNull();
      expect(preview.querySelector('script')).toBeNull();
      expect(container.querySelector('[data-eai-demo-ready="true"]'))
        .toHaveAttribute('data-eai-demo-source-digest', 'source-sha');
      fireEvent.change(screen.getByRole('textbox', { name: 'Search' }), { target: { value: 'local' } });
      fireEvent.click(screen.getByRole('button', { name: 'Book' }));
      expect(screen.getByText(/Booking previewed This was a simulation/)).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: 'Open booking' }));
      expect(preview).toHaveTextContent('Booking page');
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('does not substitute sample data when a legacy authorized operational read is denied', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    try {
      render(<HomeClient generatedDemo={demo}
        generatedOperational={{ acceptedArtifactDigest: `sha256:${'a'.repeat(64)}`,
          fixtureCollection: 'vehicles', maxRows: 2, projectedFields: ['name'] }} />);
      expect(await screen.findByRole('alert')).toHaveTextContent('No sample data was substituted');
      expect(screen.queryByRole('region', { name: 'Safe app preview' })).not.toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('renders v3 authorized rows only in reviewed live slots and keeps the safe preview simulated', async () => {
    const originalFetch = global.fetch;
    const digest = `sha256:${'a'.repeat(64)}`;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({
      schemaVersion: 'eai.generated_app_operational_rows.v1',
      acceptedArtifactDigest: digest, fixtureCollection: 'vehicles',
      rows: [{ id: 'live-1', name: 'PRIVATE_LIVE_CAR' }],
    }) });
    try {
      render(<HomeClient generatedDemo={demo}
        generatedOperational={{ acceptedArtifactDigest: digest,
          fixtureCollection: 'vehicles', maxRows: 2, projectedFields: ['name'],
          bindings: [{ viewId: 'fleet-view', viewTitle: 'Fleet', componentId: 'fleet-table',
            fixtureCollection: 'vehicles', maxRows: 2, projectedFields: ['name'] }] }} />);
      expect(await screen.findByText('PRIVATE_LIVE_CAR')).toBeVisible();
      expect(screen.getByText('PRIVATE_LIVE_CAR').closest('[data-eai-operational-slot]'))
        .toHaveAttribute('data-eai-operational-slot', 'fleet-table');
      fireEvent.click(screen.getByRole('button', { name: 'Sample preview' }));
      const preview = screen.getByRole('region', { name: 'Safe app preview' });
      expect(preview).toHaveTextContent('Fleet dashboard');
      expect(preview).not.toHaveTextContent('PRIVATE_LIVE_CAR');
      expect(preview.querySelector('iframe')).toBeNull();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('keeps selected live create in the host and verifies readback', async () => {
    const originalFetch = global.fetch;
    const digest = `sha256:${'a'.repeat(64)}`;
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({
      schemaVersion: 'eai.generated_app_operational_rows.v1',
      acceptedArtifactDigest: digest, fixtureCollection: 'vehicles', rows: [],
    }) });
    try {
      render(<HomeClient generatedDemo={demo}
        generatedOperational={{ acceptedArtifactDigest: digest,
          fixtureCollection: 'vehicles', maxRows: 2, projectedFields: ['name'],
          createFields: [{ name: 'name', type: 'text', required: true }] }} />);
      expect(await screen.findByRole('region', { name: 'Reviewed live create' })).toBeVisible();
      expect(screen.getByRole('region', { name: 'Safe app preview' })).toBeVisible();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('renders a generated workflow and the generic fallback when no app artifact is configured', async () => {
    const workflow = render(<HomeClient generatedWorkflow={{
      appKey: 'rates-review', assistantEnabled: true,
      binding: {
        schemaVersion: 'eai.generated_app_runtime_binding.v1',
        workflowTemplate: { id: 'template-123', version: 2,
          digest: `sha256:${'a'.repeat(64)}`, title: 'Rates Review' },
        respondentAccess: { mode: 'anonymous', submissionObjectType: 'workflow-submission',
          fileObjectType: 'submission-file' },
      },
      branding: { displayName: 'Acme Council' },
      snapshot: { steps: [{ id: 'one', title: 'One', fields: [] }] },
    }} />);
    expect(workflow.container.querySelector('[data-eai-workflow-ready="true"]')).toBeInTheDocument();
    expect(screen.getByText('Acme Council')).toBeVisible();
    workflow.unmount();
    render(<HomeClient />);
    await waitFor(() => expect(screen.getByText('Demo fallback')).toBeVisible());
  });
});
