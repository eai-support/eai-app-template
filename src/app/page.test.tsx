import { render, screen } from '@testing-library/react';

import Home from './page';
import { getAccessToken } from '@enterpriseaigroup/core/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getGeneratedWorkflowRuntime } from '@/lib/generated-workflow/runtime';
jest.mock('@/lib/generated-workflow/runtime', () => ({
  getGeneratedWorkflowRuntime: jest.fn(() => ({ status: 'unconfigured' })),
}));
import {
  resolvePublicApiBaseUrl,
  getRoutingRedirectUrl,
  RoutingResolutionError,
} from '@/lib/platform/session-resolve';

jest.mock('@enterpriseaigroup/core/server', () => ({
  getAccessToken: jest.fn(),
}));

jest.mock('next/headers', () => ({
  headers: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.mock('./home-client', () => ({
  HomeClient: () => <div data-testid='home-client'>home</div>,
}));

jest.mock('@/lib/platform/session-resolve', () => ({
  RoutingResolutionError: class RoutingResolutionError extends Error {
    statusCode: number;
    responseBody: unknown;

    constructor(
      message: string,
      statusCode: number,
      responseBody: unknown = null,
    ) {
      super(message);
      this.name = 'RoutingResolutionError';
      this.statusCode = statusCode;
      this.responseBody = responseBody;
    }
  },
  resolvePublicApiBaseUrl: jest.fn(),
  getRoutingRedirectUrl: jest.fn(),
}));

describe('Home routing bootstrap', () => {
  beforeEach(() => {
    process.env.BASE_URL_PUBLIC_API = 'https://api.test.example.com';
    process.env.EAI_PRODUCT_SLUG = 'eai-app-template';
    process.env.EAI_TENANT_ID = 'tenant-eu';
    (headers as jest.Mock).mockResolvedValue({
      get: (key: string) => {
        if (key === 'x-forwarded-host') return null;
        if (key === 'host') return 'app.au.example.com';
        return null;
      },
    });
    jest.clearAllMocks();
    jest
      .mocked(getGeneratedWorkflowRuntime)
      .mockReturnValue({ status: 'unconfigured' });
  });

  it('passes the configured assistant to the browser without its server tenant context', async () => {
    (getAccessToken as jest.Mock).mockResolvedValue(null);
    const runtime = {
      tenantId: 'private-server-tenant',
      appKey: 'leave',
      assistantEnabled: true,
      snapshot: { steps: [] },
      binding: {
        schemaVersion: 'eai.generated_app_runtime_binding.v1' as const,
        workflowTemplate: {
          id: 'template',
          version: 1,
          digest: `sha256:${'a'.repeat(64)}` as `sha256:${string}`,
          title: 'Leave',
        },
        respondentAccess: {
          mode: 'anonymous' as const,
          submissionObjectType: 'workflow-submission' as const,
          fileObjectType: 'submission-file' as const,
        },
      },
    };
    jest
      .mocked(getGeneratedWorkflowRuntime)
      .mockReturnValue({ status: 'ready', runtime });
    const element = await Home();
    expect(element.props.generatedWorkflow).toMatchObject({
      appKey: 'leave',
      assistantEnabled: true,
    });
    expect(element.props.generatedWorkflow).not.toHaveProperty('tenantId');
    expect(getAccessToken).not.toHaveBeenCalled();
    expect(headers).not.toHaveBeenCalled();
    expect(resolvePublicApiBaseUrl).not.toHaveBeenCalled();
  });

  it('redirects to the resolved app host when routing requires correction', async () => {
    (getAccessToken as jest.Mock).mockResolvedValue('user-token');
    (resolvePublicApiBaseUrl as jest.Mock).mockResolvedValue({
      baseUrl: 'https://api.eu.example.com',
      routing: { routingMode: 'redirect', status: 'resolved' },
    });
    (getRoutingRedirectUrl as jest.Mock).mockReturnValue(
      'https://app.eu.example.com',
    );

    await Home();

    expect(resolvePublicApiBaseUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'user-token',
        currentAppHost: 'app.au.example.com',
        fallbackBaseUrl: 'https://api.test.example.com',
        product: 'eai-app-template',
      }),
    );
    expect(redirect).toHaveBeenCalledWith('https://app.eu.example.com');
  });

  it('renders the home client when no redirect is required', async () => {
    (getAccessToken as jest.Mock).mockResolvedValue(null);

    render(await Home());

    expect(screen.getByTestId('home-client')).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('renders the home client when routing resolution is blocked', async () => {
    (getAccessToken as jest.Mock).mockResolvedValue('user-token');
    (resolvePublicApiBaseUrl as jest.Mock).mockRejectedValue(
      new RoutingResolutionError('tenant_selection_required', 409, {
        status: 'selection_required',
        userId: 'user-123',
        product: 'eai-app-template',
        productAllowed: false,
        routingMode: 'selection_required',
      }),
    );

    render(await Home());

    expect(screen.getByTestId('home-client')).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });
});
