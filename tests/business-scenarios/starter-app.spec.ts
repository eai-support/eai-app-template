import { expect, test } from '@playwright/test';

test('business user can open the starter app', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');

  await expect(page).toHaveTitle(/EAI App Template/);
  await expect(page.locator('body')).toBeVisible();
  expect(pageErrors).toEqual([]);
});
