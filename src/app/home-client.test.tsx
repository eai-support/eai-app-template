import { render, screen } from '@testing-library/react';
import { useStoreValue } from '@enterpriseaigroup/core';

import { HomeClient } from './home-client';

jest.mock('@enterpriseaigroup/core', () => ({
  useStoreValue: jest.fn(),
}));
jest.mock('@enterpriseaigroup/demo', () => ({
  DemoPage: () => <div>Template page</div>,
}));
jest.mock('./generated-workflow', () => ({
  GeneratedWorkflowPage: () => <div>Generated workflow</div>,
}));

const mockUseStoreValue = useStoreValue as jest.MockedFunction<
  typeof useStoreValue
>;

describe('HomeClient', () => {
  it('renders the generated workflow when exported steps are present', () => {
    mockUseStoreValue.mockReturnValue({
      appKey: 'rates-review',
      displayName: 'Rates Review',
      steps: [{ id: 'intake', title: 'Intake', fields: [] }],
    });

    render(<HomeClient />);

    expect(screen.getByText('Generated workflow')).toBeInTheDocument();
  });

  it('keeps the template page for repositories without generated steps', () => {
    mockUseStoreValue.mockReturnValue(undefined);

    render(<HomeClient />);

    expect(screen.getByText('Template page')).toBeInTheDocument();
  });
});
