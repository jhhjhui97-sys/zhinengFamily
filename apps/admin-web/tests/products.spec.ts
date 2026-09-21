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
  await expect(page.getByText('显示 1–20 / 共 21 件商品')).toBeVisible();
  await page.getByRole('link', { name: '下一页' }).click();
  await expect(page.getByRole('link', { name: '分页商品19' })).toBeVisible();
});

test('product search and category filter combine', async ({ page }) => {
  await page.goto('/products');
  await page.getByLabel('搜索商品').fill('分页品牌');
  await page.getByLabel('商品分类').selectOption('sofa');
  await page.getByRole('button', { name: '筛选' }).click();
  await expect(page.getByText('共 9 件', { exact: true })).toBeVisible();
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

test('missing product uses 404 page', async ({ page }) => {
  await page.goto('/products/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
  await expect(page.getByText('页面不存在')).toBeVisible();
});

test('expired token redirects and browser storage never contains JWT', async ({ page, context }) => {
  await context.clearCookies(); await page.goto('/products');
  await expect(page).toHaveURL(/\/login/);
  await login(page); await page.goto('/products');
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
  expect((await page.request.get('/api/products')).headers()['authorization']).toBeUndefined();
});
