import { expect, test } from '@playwright/test';

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
