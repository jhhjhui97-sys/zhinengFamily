import { expect, test } from '@playwright/test';

test('sidebar routes to empty resource pages and marks current destination', async ({ page }) => {
  await page.goto('/dashboard');
  for (const [label, path, empty] of [
    ['客户管理', '/customers', '暂无客户'],
    ['商品管理', '/products', '暂无商品'],
    ['设计项目', '/projects', '暂无设计项目'],
  ]) {
    await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { name: empty, exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
  }
});

test('top bar states preview identity and offers honest disabled logout', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByText('预览用户', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '退出（暂未接入）' })).toBeDisabled();
  await page.getByRole('link', { name: '返回登录页' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

for (const width of [768, 820, 1024, 1440]) {
  test(`navigation and content fit viewport ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1180 });
    await page.goto('/customers');
    await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '暂无客户', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 820 || width === 1440) {
      await page.screenshot({ path: `test-results/customers-${width}.png`, fullPage: true });
    }
  });
}

test('narrow layout opens menu, Escape closes it and returns focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dashboard');
  const button = page.getByRole('button', { name: '打开导航菜单' });
  await button.click();
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeVisible();
  await expect(page.getByRole('link', { name: '仪表盘', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('navigation', { name: '主导航' })).toBeHidden();
  await expect(button).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('resource pages are directly accessible on reload', async ({ page }) => {
  for (const [path, heading] of [['/customers', '客户管理'], ['/products', '商品管理'], ['/projects', '设计项目']]) {
    await page.goto(path);
    await page.reload();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  }
});
