import { expect, test } from '@playwright/test';

test('missing sign-in configuration stays on the app and explains setup', async ({ page }) => {
  const providerRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).hostname.endsWith('.ciamlogin.com')) providerRequests.push(request.url());
  });
  await page.goto('/api/auth/signin/microsoft-entra-id');
  await expect(page.getByRole('heading', { name: 'Sign-in unavailable' })).toBeVisible();
  await expect(page.getByText(/Run eai provision entra/)).toBeVisible();
  expect(providerRequests).toEqual([]);
});

test('platform readiness gives structured guidance when auth is not configured', async ({
  request,
}) => {
  const response = await request.get('/api/eai/readiness', {
    headers: {
      'x-eai-readiness-probe': 'tenantinfra',
    },
  });

  expect(response.status()).toBe(503);

  const body = await response.json();
  expect(body).toMatchObject({
    ok: false,
    service: 'eai-app-template',
  });
  expect(body.failureCategories).toContain('auth_misconfigured');
  expect(body.checks[0]).toMatchObject({
    name: 'tenantinfra-probe',
    ok: false,
    category: 'auth_misconfigured',
  });
});
