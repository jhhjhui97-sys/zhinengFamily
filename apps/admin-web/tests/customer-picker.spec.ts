import { expect, test, type Route } from '@playwright/test';
import { login } from './auth-helper';

test.beforeEach(async ({ page }) => { await login(page); });

for (const path of ['/projects/new', '/projects/12121212-1212-4121-8121-121212121211/edit']) {
  test(`customer search expires after opening ${path}`, async ({ page, context }) => {
    await page.goto(path);
    await expect(page.getByLabel('项目名称 *')).toBeVisible();
    await context.addCookies([{ name: 'admin_access_token', value: 'truly-expired-token', domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Strict' }]);
    const response = page.waitForResponse(res => res.url().includes('/api/customers?') && res.status() === 401);
    await page.getByLabel('查找客户').fill('过期搜索');
    await response;
    await expect(page).toHaveURL(/\/login\?expired=1/);
    expect((await context.cookies()).find(cookie => cookie.name === 'admin_access_token')).toBeUndefined();
  });
}

for (const failure of ['403', '503', 'network']) {
  test(`customer search ${failure} is distinct from empty and supports retry`, async ({ page }) => {
    await page.goto('/projects/new');
    await page.getByLabel('查找客户').fill('张先生');
    await expect(page.getByRole('button', { name: '选择 张先生' })).toBeVisible();
    let fail = true;
    await page.route('**/api/customers?**', async route => {
      if (!fail) return route.continue();
      if (failure === 'network') return route.abort('failed');
      return route.fulfill({ status: Number(failure), json: { error: 'upstream internal detail must not leak' } });
    });
    await page.getByLabel('查找客户').fill('分页客户17');
    await expect(page.getByRole('button', { name: '选择 张先生' })).toHaveCount(0);
    await expect(page.locator('.customer-picker').getByRole('alert')).toContainText(failure === '403' ? '你没有权限执行此操作' : '服务暂时不可用，请稍后重试');
    await expect(page.getByText('无匹配客户')).toHaveCount(0);
    await expect(page.getByRole('listbox')).toHaveCount(0);
    fail = false;
    await page.getByRole('button', { name: '重试查询' }).click();
    await page.getByRole('button', { name: '选择 分页客户17' }).click();
    await expect(page.getByText('已选择：分页客户17')).toBeVisible();
    await expect(page.locator('.customer-picker').getByRole('alert')).toHaveCount(0);
  });
}

test('customer search shows an empty state only after successful empty response', async ({ page }) => {
  await page.goto('/projects/new');
  await page.getByLabel('查找客户').fill('不存在的客户');
  await expect(page.getByText('无匹配客户')).toBeVisible();
  await expect(page.locator('.customer-picker').getByRole('alert')).toHaveCount(0);
});

for (const oldFirst of [true, false]) {
  test(`superseded search cannot replace results or loading (old first: ${oldFirst})`, async ({ page }) => {
    // Simulate a transport that completes despite abort, to exercise stale-response protection.
    await page.goto('/projects/new');
    await page.evaluate(() => {
      const original = window.fetch.bind(window);
      window.fetch = (input, init) => original(input, typeof input === 'string' && input.startsWith('/api/customers?') ? { ...init, signal: undefined } : init);
    });
    await expect(page.getByRole('button', { name: '选择 张先生' })).toBeVisible();
    let oldResolve!: (route: Route) => void;
    let newResolve!: (route: Route) => void;
    const oldRequest = new Promise<Route>(resolve => { oldResolve = resolve; });
    const newRequest = new Promise<Route>(resolve => { newResolve = resolve; });
    await page.route('**/api/customers?**', route => {
      if (new URL(route.request().url()).searchParams.get('search') === '旧查询') oldResolve(route);
      else newResolve(route);
    });
    await page.getByLabel('查找客户').fill('旧查询');
    const oldRoute = await oldRequest;
    await expect(page.getByRole('button', { name: '选择 张先生' })).toHaveCount(0);
    await page.getByLabel('查找客户').fill('新查询');
    const newRoute = await newRequest;
    const oldResponse = page.waitForResponse(res => res.url() === oldRoute.request().url());
    if (oldFirst) {
      await oldRoute.fulfill({ status: 503, json: {} }); await oldResponse;
      await expect(page.getByText('正在查找…')).toBeVisible();
      await expect(page.locator('.customer-picker').getByRole('alert')).toHaveCount(0);
      await newRoute.fulfill({ json: { items: [{ id: 'new', name: '新客户' }], total: 1 } });
    } else {
      await newRoute.fulfill({ json: { items: [{ id: 'new', name: '新客户' }], total: 1 } });
      await expect(page.getByRole('button', { name: '选择 新客户' })).toBeVisible();
      await oldRoute.fulfill({ json: { items: [{ id: 'old', name: '旧客户' }], total: 1 } }); await oldResponse;
    }
    await expect(page.getByRole('button', { name: '选择 新客户' })).toBeVisible();
    await expect(page.getByRole('button', { name: '选择 旧客户' })).toHaveCount(0);
    await expect(page.getByText('正在查找…')).toHaveCount(0);
    await expect(page.locator('.customer-picker').getByRole('alert')).toHaveCount(0);
  });
}
