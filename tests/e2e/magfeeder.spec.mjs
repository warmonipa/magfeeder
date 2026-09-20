import { expect, test } from '@playwright/test';

test('simulator feeds a Mag and planner produces an exact route', async ({ page }) => {
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

  await page.getByRole('button', { name: '喂 小HP回复液（Monomate）' }).click();
  await expect(page.locator('[data-sim-card]')).toContainText('同步率 23 / 120');
  await expect(page.locator('[data-sim-card]')).toContainText('0·40%');

  await page.getByRole('tab', { name: '规划器' }).click();
  await page.locator('[data-planner] select').selectOption('Deva');
  for (const [index, value] of ['5', '50', '45', '0'].entries()) {
    await page.locator('[data-planner] input').nth(index).fill(value);
  }
  await page.getByRole('button', { name: '求解' }).click();
  await expect(page.locator('.mag-sim-planner__ok')).toContainText('低喂食方案', {
    timeout: 15_000,
  });
  await expect(page.locator('.mag-sim-planner__result')).toContainText('进化到 提婆（Deva）');

  expect(errors).toEqual([]);
});

test('Mag species, cells and food use canonical names without changing identities', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-sim-card]')).toContainText('玛古');
  await expect(page.locator('[data-feed-item="Monomate"]')).toHaveText('喂 小HP回复液（Monomate）');
  await expect(page.locator('[data-feed-item="Antiparalysis"]')).toHaveText('喂 解麻痹剂（Antiparalysis）');
  await expect(page.locator('option[value="Marica"]').first()).toHaveText('摩利遮（Marica）');
  await expect(page.locator('option[value="Apsaras"]').first()).toHaveText('阿普萨拉斯（Apsaras）');
  await expect(page.locator('option[value="Cell of Mag 213"]')).toHaveText('玛古细胞 213（Cell of Mag 213）');
  await page.locator('[data-feed-item="Monomate"]').click();
  await expect(page.locator('[data-sim-log]')).toContainText('小HP回复液（Monomate）');
});


test('localized controls fit desktop and mobile widths', async ({ page }) => {
  for (const width of [320, 390, 1000, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.locator('[data-feed-item="Antiparalysis"]')).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: innerWidth, content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content, `viewport ${width}`).toBeLessThanOrEqual(dimensions.viewport);
  }
});
