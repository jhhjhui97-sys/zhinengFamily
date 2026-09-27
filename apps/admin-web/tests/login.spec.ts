import { expect, test } from '@playwright/test';
import { login, credentials } from './auth-helper';

test('login validates me and survives refresh without browser storage', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await login(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(credentials.email)).toBeVisible();
  await expect(page.getByText('owner', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(credentials.email)).toBeVisible();
  expect(await page.evaluate(() => [localStorage, sessionStorage].every(s => !JSON.stringify(s).includes('mock-valid-token') && !JSON.stringify(s).includes('correct-test-password')))).toBe(true);
  expect((await page.context().cookies()).some(cookie => cookie.httpOnly && cookie.value === 'mock-valid-token')).toBe(true);
});

test('wrong password shows Chinese error without session', async ({ page }) => {
  await login(page, { password: 'wrong-test-password' });
  await expect(page.locator('.form-error')).toContainText('账号或密码错误');
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.context().cookies()).some(cookie => cookie.value === 'mock-valid-token')).toBe(false);
});

for (const [email, message] of [
  ['forbidden@example.test', '你没有权限执行此操作'],
  ['missing@example.test', '请求的数据不存在'],
  ['conflict@example.test', '数据状态已发生变化，请刷新后重试'],
  ['invalid@example.test', '商家 ID 格式不正确'],
  ['broken@example.test', '服务暂时不可用，请稍后重试'],
  ['offline@example.test', '服务暂时不可用，请稍后重试'],
]) {
  test(`API error ${email} has safe Chinese feedback`, async ({ page }) => {
    await login(page, { email });
    await expect(page.locator('.form-error')).toContainText(message);
    await expect(page.locator('.form-error')).not.toContainText('private stack');
  });
}

test('expired cookie is rejected and cleared by auth/me', async ({ page }) => {
  await page.context().addCookies([{ name: 'admin_access_token', value: 'expired-token', url: 'http://127.0.0.1:3000', httpOnly: true }]);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?expired=1$/);
  await expect(page.locator('.form-error')).toContainText('登录信息已失效，请重新登录');
  expect((await page.context().cookies()).some(cookie => cookie.name === 'admin_access_token')).toBe(false);
});

test('logout clears cookie and protects dashboard afterward', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});
