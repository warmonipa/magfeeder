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
  const portrait = page.locator('.mag-sim-card__sprite');
  await expect(portrait).toBeVisible();
  await expect.poll(() => portrait.evaluate(img => img.naturalWidth)).toBe(900);

  await page.getByRole('button', { name: '喂 小HP回复液（Monomate）' }).click();
  await expect(page.locator('[data-sim-card]')).toContainText('同步率 23 / 120');
  await expect(page.locator('[data-sim-card]')).toContainText('0·40%');

  await page.getByRole('link', { name: '规划器', exact:true }).click();
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
      height: innerHeight, contentHeight: document.documentElement.scrollHeight,
    }));
    expect(dimensions.content, `viewport ${width}`).toBeLessThanOrEqual(dimensions.viewport);
    if (width === 1440) expect(dimensions.contentHeight).toBeLessThanOrEqual(dimensions.height);
    if (width === 320 || width === 1440) await page.screenshot({path:`/tmp/magfeeder-angular-${width}.png`,fullPage:true});
  }
});

test('both routes are prerendered without JavaScript and missing URLs return 404', async ({ browser, request }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4174/');
  await expect(page.locator('[data-sim-card]')).toContainText('Lv 5 / 200');
  await expect(page.locator('[data-feed-item="Monomate"]')).toBeVisible();
  await page.goto('http://127.0.0.1:4174/planner/');
  await expect(page.getByRole('heading', {name:'规划器',exact:true})).toBeVisible();
  await expect(page.locator('[data-planner="magId"]')).toBeVisible();
  const response=await request.get('/not-a-route/');
  expect(response.status()).toBe(404);
  expect(await response.text()).toContain('页面不存在');
  await context.close();
});

test('routing preserves session, bank undo and share replay hydrate without errors', async ({page})=>{
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/');
  await page.locator('[data-feed-item="Monomate"]').click();
  await expect(page.locator('[data-sim-card]')).toContainText('5·5%');
  await page.locator('[data-bank]').click();
  await expect(page.locator('[data-sim-card]')).toContainText('5·4%');
  await page.locator('[data-undo]').click();
  await expect(page.locator('[data-sim-card]')).toContainText('5·5%');
  await page.getByRole('link',{name:'规划器',exact:true}).click();
  await expect(page).toHaveURL(/\/planner\/$/);
  await page.getByRole('link',{name:'模拟器',exact:true}).click();
  await expect(page.locator('[data-sim-card]')).toContainText('同步率 23 / 120');
  await page.locator('[data-share]').click();
  await expect(page).toHaveURL(/#r=/);
  const shared=page.url();
  await page.goto(shared);
  await expect(page.locator('[data-sim-card]')).toContainText('同步率 23 / 120');
  await expect(page.locator('[data-sim-log]')).toContainText('小HP回复液');
  await page.locator('[data-feed-item="Monomate"]').click();
  await expect(page.locator('[data-sim-card]')).toContainText('同步率 26 / 120');
  await page.goto('/#r=invalid');
  await expect(page.locator('[data-share-status]')).toContainText('分享链接无效');
  await expect(page.locator('[data-sim-card]')).toContainText('Lv 5 / 200');
  expect(errors).toEqual([]);
});

test('plan import, custom PBs and rejected cells retain engine behavior',async({page})=>{
  await page.goto('/planner/');
  await page.locator('[data-planner="magId"]').selectOption('Deva');
  for(const [key,value] of Object.entries({def:'5',pow:'50',dex:'45',mind:'0'}))
    await page.locator('[data-planner="'+key+'"]').fill(value);
  await page.locator('[data-planner-solve]').click();
  await expect(page.locator('[data-import-plan]')).toBeVisible({timeout:15000});
  await page.locator('[data-import-plan]').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('[data-sim-card]')).toContainText('提婆');
  await expect(page.locator('[data-sim-card]')).toContainText('Lv 100 / 200');
  await page.getByRole('tab',{name:'自定义',exact:true}).click();
  await page.locator('[data-custom="magId"]').selectOption('Varuna');
  await page.locator('[data-custom="pow"]').fill('5');
  const pbs=page.locator('[data-custom-pb]');
  await pbs.nth(0).check();await pbs.nth(1).check();await pbs.nth(2).check();
  await expect(pbs.nth(3)).toBeDisabled();
  await page.locator('[data-apply-custom]').click();
  await expect(page.locator('[data-sim-card]')).toContainText('PB 3/3');
  await page.locator('[data-cell-select]').selectOption('Cell of Mag 213');
  await page.locator('[data-auto-bank]').check();
  await page.locator('[data-feed-cell]').click();
  await expect(page.locator('[data-sim-log]')).toContainText('未生效');
  await expect(page.locator('[data-cycles]')).toHaveText('0');
  await expect(page.locator('[data-sim-log]')).not.toContainText('存银行');
});


test('HTTP directory redirects, explicit index documents and query strings agree with Router', async ({page,request})=>{
 const redirect=await request.get('/planner?example=1',{maxRedirects:0});
 expect(redirect.status()).toBe(301);
 expect(redirect.headers().location).toBe('/planner/?example=1');
 const response=await request.get('/planner/?example=1');
 expect(response.status()).toBe(200);
 expect(await response.text()).toContain('目标 Mag');
 const index=await request.get('/planner/index.html?example=1');
 expect(index.status()).toBe(200);
 await page.goto('/planner/index.html?example=1');
 await expect(page).toHaveURL(/\/planner\/\?example=1$/);
 await expect(page.locator('[data-planner="magId"]')).toBeVisible();
 await page.reload();
 await expect(page.getByRole('heading',{name:'规划器',exact:true})).toBeVisible();
 await page.goto('/index.html');
 await expect(page).toHaveURL('http://127.0.0.1:4174/');
 await expect(page.locator('[data-sim-card]')).toContainText('当前 Mag');
});
