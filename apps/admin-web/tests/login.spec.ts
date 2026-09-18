import { expect, test } from '@playwright/test';

test('root opens login and preview link enters dashboard', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: '欢迎回到门店工作台' })).toBeVisible();
  await expect(page.getByText('当前为界面预览，尚未接入登录认证。')).toBeVisible();
  await page.screenshot({ path: 'test-results/login.png', fullPage: true });
  await page.getByRole('link', { name: '进入后台预览' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: '仪表盘', exact: true })).toBeVisible();
});
