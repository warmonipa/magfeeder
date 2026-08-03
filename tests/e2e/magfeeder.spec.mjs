import { expect, test } from '@playwright/test';

test('simulator and planner load without runtime or resource errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    errors.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`);
  });

  await page.goto('/');
  await expect(page).toHaveTitle(/玛古模拟器/);
  await expect(page.getByRole('heading', { name: 'Mag Feeder' })).toBeVisible();
  await expect(page.locator('[data-sim-card]')).toContainText('Mag');

  await page.getByRole('tab', { name: '规划器' }).click();
  await expect(page.getByRole('button', { name: '求解' })).toBeVisible();

  expect(errors).toEqual([]);
});
