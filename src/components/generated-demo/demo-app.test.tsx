import { fireEvent, render, screen } from '@testing-library/react';
import { GeneratedDemo } from './demo-app';
import type { GeneratedDemoClientView } from '@/lib/generated-demo/contract';

jest.mock('@/generated/app', () => ({
  __esModule: true,
  default: ({
    viewId,
    fixtures,
    runAction,
  }: {
    viewId: string;
    fixtures: GeneratedDemoClientView['previewFixtures'];
    runAction: (id: string) => string;
  }) => (
    <div>
      <span>View {viewId}</span>
      <span>{fixtures.collections.cars[0].name as string}</span>
      <button type='button' onClick={() => runAction('book')}>
        Book
      </button>
    </div>
  ),
}));

const demo = {
  appName: 'Car app',
  workflowSteps: [
    { id: 'fleet', title: 'Fleet', viewId: 'fleet-view' },
    { id: 'booking', title: 'Booking', viewId: 'booking-view' },
  ],
  previewFixtures: {
    schemaVersion: 'eai.generated_app_fixtures.v1',
    collections: { cars: [{ name: 'Sample car' }] },
    actions: {
      book: { effect: 'session-local', message: 'Booking previewed.' },
    },
  },
  sourceDigest: `sha256:${'a'.repeat(64)}`,
  fixtureDigest: `sha256:${'b'.repeat(64)}`,
} as GeneratedDemoClientView;

describe('GeneratedDemo', () => {
  it('shows permanent sample labels, navigates views and announces simulated actions', () => {
    const { container } = render(<GeneratedDemo demo={demo} />);
    expect(
      screen.getByText(/Sample data and simulated interactions/),
    ).toBeVisible();
    expect(screen.getByText('View fleet-view')).toBeVisible();
    expect(screen.getByText('Sample car')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Booking' }));
    expect(screen.getByText('View booking-view')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Book' }));
    expect(
      screen.getByText(/Booking previewed. This was a simulation/),
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-eai-demo-ready="true"]'),
    ).toHaveAttribute(
      'data-eai-demo-fixture-digest',
      `sha256:${'b'.repeat(64)}`,
    );
  });
});
