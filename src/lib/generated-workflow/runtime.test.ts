const mockResolveGeneratedWorkflowRuntime = jest.fn(() => ({
  status: 'ready' as const,
  runtime: { appKey: 'rates-review' },
}));

jest.mock('@/eai.config', () => ({
  tenantConfigs: { default: { tenantId: 'tenant-a' } },
  workflowSnapshots: { default: { steps: [] } },
}));

jest.mock('./runtime-contract', () => ({
  resolveGeneratedWorkflowRuntime: mockResolveGeneratedWorkflowRuntime,
}));

const originalProductSlug = process.env.EAI_PRODUCT_SLUG;

afterAll(() => {
  if (originalProductSlug === undefined) delete process.env.EAI_PRODUCT_SLUG;
  else process.env.EAI_PRODUCT_SLUG = originalProductSlug;
});

it('validates immutable generated runtime bytes once per server process', async () => {
  process.env.EAI_PRODUCT_SLUG = 'rates-review';
  const { getGeneratedWorkflowRuntime } = await import('./runtime');

  const resolutions = Array.from({ length: 100 }, () =>
    getGeneratedWorkflowRuntime(),
  );

  expect(resolutions.every((resolution) => resolution === resolutions[0])).toBe(
    true,
  );
  expect(mockResolveGeneratedWorkflowRuntime).toHaveBeenCalledTimes(1);
  expect(mockResolveGeneratedWorkflowRuntime).toHaveBeenCalledWith({
    appKey: 'rates-review',
    config: { tenantId: 'tenant-a' },
    snapshot: { steps: [] },
  });
});
