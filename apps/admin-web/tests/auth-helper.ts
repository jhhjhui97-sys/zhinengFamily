import { expect, type Page } from '@playwright/test';

export const credentials = { merchant_id: '22222222-2222-4222-8222-222222222222', email: 'owner@example.test', password: 'correct-test-password' };

export async function login(page: Page, overrides: Partial<typeof credentials> = {}) {
  await page.goto('/login');
  await page.getByLabel('商家 ID').fill(overrides.merchant_id ?? credentials.merchant_id);
  await page.getByLabel('邮箱').fill(overrides.email ?? credentials.email);
  await page.getByLabel('密码').fill(overrides.password ?? credentials.password);
  await page.getByRole('button', { name: '登录' }).click();
  if ((overrides.email ?? credentials.email) === credentials.email && (overrides.password ?? credentials.password) === credentials.password) {
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(credentials.email)).toBeVisible();
  }
}
