import { fireEvent, render, screen } from '@testing-library/react';
import { GeneratedDemo } from './demo-app';
import type { GeneratedDemoArtifact } from '@/lib/generated-demo/contract';

jest.mock('@/generated/app', () => ({
  __esModule: true,
  default: ({
    viewId,
    fixtures,
    runAction,
  }: {
    viewId: string;
    fixtures: GeneratedDemoArtifact['previewFixtures'];
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

const artifact = {
  appDefinition: {
    appName: 'Car app',
    businessCard: { outcome: 'Find available cars' },
    workflow: {
      steps: [
        { id: 'fleet', title: 'Fleet', viewId: 'fleet-view' },
        { id: 'booking', title: 'Booking', viewId: 'booking-view' },
      ],
    },
  },
  previewFixtures: {
    collections: { cars: [{ name: 'Sample car' }] },
    actions: {
      book: { effect: 'session-local', message: 'Booking previewed.' },
    },
  },
  digests: {
    sourceBundle: `sha256:${'a'.repeat(64)}`,
    previewFixtures: `sha256:${'b'.repeat(64)}`,
  },
} as unknown as GeneratedDemoArtifact;

describe('GeneratedDemo', () => {
  it('shows permanent sample labels, navigates views and announces simulated actions', () => {
    const { container } = render(<GeneratedDemo artifact={artifact} />);
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
