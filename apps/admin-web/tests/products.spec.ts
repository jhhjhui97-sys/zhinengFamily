import { expect, test } from '@playwright/test';
import { login } from './auth-helper';

test.beforeEach(async ({ page }) => { await login(page); });

test('product list shows price, dimensions, asset states and pagination', async ({ page }) => {
  await page.goto('/products');
  await expect(page.getByRole('link', { name: '三人沙发' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '¥6,800.50', exact: true })).toBeVisible();
  await expect(page.getByText('2400 × 950 × 850 mm')).toBeVisible();
  await expect(page.getByText('已配置')).toBeVisible();
  await expect(page.getByText('已有模型')).toBeVisible();
  await expect(page.getByText('显示 1–20 / 共 23 件商品')).toBeVisible();
  await page.getByRole('link', { name: '下一页' }).click();
  await expect(page.getByRole('link', { name: '分页商品21' })).toBeVisible();
});

test('free-form product category combines with search and survives pagination', async ({ page }) => {
  await page.goto('/products');
  await page.getByLabel('搜索商品').fill('分页品牌');
  await page.getByLabel('商品分类').fill('bed');
  await page.getByRole('button', { name: '筛选' }).click();
  await expect(page.getByText('共 21 件', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: '下一页' }).click();
  await expect(page).toHaveURL(/search=%E5%88%86%E9%A1%B5%E5%93%81%E7%89%8C/);
  await expect(page).toHaveURL(/category=bed/);
  await expect(page.getByRole('link', { name: '分页商品21' })).toBeVisible();
});

for (const metadata of ['{"x":1e400}', '{"x":-1e400}', '{"nested":{"values":[1,1e400]}}', '{"nested":[{"x":-1e400}]}']) {
  test(`create rejects non-finite metadata without POST: ${metadata}`, async ({ page }) => {
    let posts = 0; page.on('request', request => { if (request.url().endsWith('/api/products') && request.method() === 'POST') posts += 1; });
    await page.goto('/products/new');
    await page.getByLabel('分类 *').fill('bed'); await page.getByLabel('品牌 *').fill('示例'); await page.getByLabel('商品名称 *').fill('溢出测试'); await page.getByLabel('SKU *').fill('OVERFLOW');
    await page.getByLabel('价格 *').fill('1.00'); await page.getByLabel('宽度 *').fill('1'); await page.getByLabel('深度 *').fill('1'); await page.getByLabel('高度 *').fill('1');
    await page.getByLabel('Metadata JSON').fill(metadata); await page.getByRole('button', { name: '保存商品' }).click();
    await expect(page.getByText('Metadata 不能包含无穷大或非数字数值')).toBeVisible(); expect(posts).toBe(0);
  });
}

test('metadata accepts blank and valid objects but rejects invalid JSON without POST', async ({ page }) => {
  let posts = 0; page.on('request', request => { if (request.url().endsWith('/api/products') && request.method() === 'POST') posts += 1; });
  await page.goto('/products/new');
  await page.getByLabel('分类 *').fill('中文分类'); await page.getByLabel('品牌 *').fill('示例'); await page.getByLabel('商品名称 *').fill('JSON 测试'); await page.getByLabel('SKU *').fill('JSON-TEST');
  await page.getByLabel('价格 *').fill('1.00'); await page.getByLabel('宽度 *').fill('1'); await page.getByLabel('深度 *').fill('1'); await page.getByLabel('高度 *').fill('1');
  await page.getByLabel('Metadata JSON').fill('{bad'); await page.getByRole('button', { name: '保存商品' }).click();
  await expect(page.getByText('Metadata 必须是合法 JSON 对象')).toBeVisible(); expect(posts).toBe(0);
  await page.getByLabel('Metadata JSON').fill(''); await page.getByRole('button', { name: '保存商品' }).click();
  await expect(page).toHaveURL(/\/products\/ffffffff/); expect(posts).toBe(1);
});

test('create validates fields, numbers and metadata then saves exact money', async ({ page }) => {
  await page.goto('/products/new');
  await page.getByRole('button', { name: '保存商品' }).click();
  await expect(page.getByText('请填写商品名称')).toBeVisible();
  await page.getByLabel('分类 *').fill('sofa'); await page.getByLabel('品牌 *').fill('新品牌');
  await page.getByLabel('商品名称 *').fill('新沙发'); await page.getByLabel('SKU *').fill('SOFA-NEW');
  await page.getByLabel('价格 *').fill('not-money'); await page.getByLabel('宽度 *').fill('0');
  await page.getByLabel('深度 *').fill('900'); await page.getByLabel('高度 *').fill('800');
  await page.getByLabel('Metadata JSON').fill('{bad');
  await page.getByRole('button', { name: '保存商品' }).click();
  await expect(page.getByText('请输入有效价格')).toBeVisible();
  await expect(page.getByText('尺寸必须大于 0')).toBeVisible();
  await expect(page.getByText('Metadata 必须是合法 JSON 对象')).toBeVisible();
  await page.getByLabel('价格 *').fill('6800.50'); await page.getByLabel('宽度 *').fill('2400');
  await page.getByLabel('Metadata JSON').fill('{"color":"浅灰"}');
  await page.getByRole('button', { name: '保存商品' }).click();
  await expect(page).toHaveURL(/\/products\/ffffffff/);
  await expect(page.getByText('¥6,800.50')).toBeVisible();
});

test('SKU conflict has a clear message', async ({ page }) => {
  await page.goto('/products/new');
  await page.getByLabel('分类 *').fill('sofa'); await page.getByLabel('品牌 *').fill('示例');
  await page.getByLabel('商品名称 *').fill('冲突'); await page.getByLabel('SKU *').fill('SOFA-001');
  await page.getByLabel('价格 *').fill('1.00'); await page.getByLabel('宽度 *').fill('1');
  await page.getByLabel('深度 *').fill('1'); await page.getByLabel('高度 *').fill('1');
  await page.getByRole('button', { name: '保存商品' }).click();
  await expect(page.locator('.form-error')).toContainText('SKU 已存在');
});

test('product detail and edit work', async ({ page }) => {
  await page.goto('/products/dddddddd-dddd-4ddd-8ddd-ddddddddddd1');
  await expect(page.getByRole('heading', { name: '三人沙发' })).toBeVisible();
  await expect(page.getByText('"material": "科技布"')).toBeVisible();
  await page.getByRole('link', { name: '编辑商品' }).click();
  await page.getByLabel('价格 *').fill('6999.90');
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.getByText('¥6,999.90')).toBeVisible();
});

test('edit rejects non-finite metadata without PATCH', async ({ page }) => {
  let patches = 0; page.on('request', request => { if (request.url().includes('/api/products/') && request.method() === 'PATCH') patches += 1; });
  await page.goto('/products/dddddddd-dddd-4ddd-8ddd-ddddddddddd1/edit');
  await page.getByLabel('Metadata JSON').fill('{"nested":[1e400]}'); await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.getByText('Metadata 不能包含无穷大或非数字数值')).toBeVisible(); expect(patches).toBe(0);
});

test('edit SKU conflict is Chinese and preserves the original product', async ({ page }) => {
  await page.goto('/products/dddddddd-dddd-4ddd-8ddd-ddddddddddd2/edit');
  await page.getByLabel('SKU *').fill('SOFA-001'); await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.locator('.form-error')).toContainText('SKU 已存在');
  await page.goto('/products/dddddddd-dddd-4ddd-8ddd-ddddddddddd2');
  await expect(page.getByText('BED-001', { exact: true })).toBeVisible();
});

test('missing product uses 404 page', async ({ page }) => {
  await page.goto('/products/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  await expect(page.getByText('页面不存在')).toBeVisible();
});

test('expired token redirects and browser storage never contains JWT', async ({ page, context }) => {
  await context.addCookies([{ name: 'admin_access_token', value: 'truly-expired-token', domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Strict' }]);
  await page.goto('/products'); await expect(page).toHaveURL(/\/login\?expired=1/);
  expect((await context.cookies()).find(cookie => cookie.name === 'admin_access_token')).toBeUndefined();
  await login(page); await page.goto('/products');
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
  const response = await page.request.get('/api/products'); expect(response.headers()['authorization']).toBeUndefined(); expect(await response.text()).not.toContain('mock-valid-token');
});

test('product BFF rejects non-finite metadata before forwarding', async ({ page }) => {
  const createBody = '{"category":"bed","brand":"示例","name":"绕过测试","sku":"BFF-OVERFLOW","price":"1.00","width_mm":1,"depth_mm":1,"height_mm":1,"thumbnail":null,"model_url":null,"metadata":{"x":1e400}}';
  const create = await page.request.post('/api/products', { headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:3000' }, data: createBody });
  expect(create.status()).toBe(422); expect(await create.text()).toContain('Metadata');
  const update = await page.request.patch('/api/products/dddddddd-dddd-4ddd-8ddd-ddddddddddd1', { headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:3000' }, data: '{"metadata":{"nested":[-1e400]}}' });
  expect(update.status()).toBe(422); expect(await update.text()).toContain('Metadata');
});
