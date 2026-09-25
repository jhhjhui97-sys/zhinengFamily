import { expect, test } from '@playwright/test';
import { login } from './auth-helper';

test('expiry endpoint preserves a valid session and never deletes an absent cookie', async ({ page, request }) => {
  await login(page);
  const response = await page.request.get('/api/auth/expired', { maxRedirects: 0 });
  expect(response.headers()['set-cookie']).toBeUndefined();
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/dashboard$/);
  const anonymous = await request.get('/api/auth/expired', { maxRedirects: 0 });
  expect(anonymous.headers()['set-cookie']).toBeUndefined();
});

test('malformed and opaque origins are rejected without a server error', async ({ request }) => {
  for (const origin of ['null', 'not-a-url']) {
    const response = await request.post('/api/auth/logout', { headers: { origin } });
    expect(response.status()).toBe(403);
    expect(await response.text()).not.toContain('stack');
  }
});

for (const resource of ['customers', 'products', 'projects']) {
  for (const suffix of ['', '/edit']) {
    test(`${resource}${suffix} renders safe recoverable API errors`, async ({ page }) => {
      await login(page);
      for (const [status, message] of [[403, '你没有权限执行此操作'], [422, '提交的信息有误'], [503, '服务暂时不可用']] as const) {
        await page.goto(`/${resource}/review-error-${status}${suffix}`);
        await expect(page.locator('p.form-error[role="alert"]')).toContainText(message);
        await expect(page.getByRole('link', { name: '重试' })).toBeVisible();
        await expect(page.locator('body')).not.toContainText('private stack');
      }
    });
  }
}

for (const [resource, id] of [
  ['customers', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'],
  ['products', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'],
  ['projects', '12121212-1212-4121-8121-121212121211'],
]) {
  test(`${resource} form retains draft and allows retry after network and invalid JSON failures`, async ({ page }) => {
    await login(page);
    await page.goto(`/${resource}/${id}/edit`);
    for (const failure of ['network', 'json']) {
      await page.route(`**/api/${resource}/${id}`, route => failure === 'network' ? route.abort('failed') : route.fulfill({ status: 502, contentType: 'text/html', body: '<html>private stack</html>' }));
      await page.getByRole('button', { name: '保存修改' }).click();
      await expect(page.locator('p.form-error[role="alert"]')).toContainText('服务暂时不可用，请稍后重试');
      await expect(page.getByRole('button', { name: '保存修改' })).toBeEnabled();
      await expect(page).toHaveURL(new RegExp(`/${id}/edit$`));
      await page.unroute(`**/api/${resource}/${id}`);
    }
    await page.getByRole('button', { name: '保存修改' }).click();
    await expect(page).toHaveURL(new RegExp(`/${id}$`));
  });
}

test('logout failure is visible and can be retried', async ({ page }) => {
  await login(page);
  await page.route('**/api/auth/logout', route => route.abort('failed'));
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page.locator('p.form-error[role="alert"]')).toContainText('退出失败，请重试');
  await page.unroute('**/api/auth/logout');
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page).toHaveURL(/\/login$/);
});
