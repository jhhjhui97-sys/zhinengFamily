import { expect, test } from '@playwright/test';
import { login } from './auth-helper';

test.beforeEach(async ({ page }) => {
  await login(page);
  await page.goto('/customers/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
  await page.getByRole('link', { name: '创建设计方案' }).click();
  await page.getByLabel('项目名称 *').fill('场景验收项目');
  await page.getByRole('button', { name: '保存项目' }).click();
  await expect(page.getByRole('heading', { name: '场景验收项目' })).toBeVisible();
});

test('sample saves v1, edit saves v2, restore creates v3 with immutable history', async ({ page }) => {
  await expect(page.getByText('SceneModel 尚未创建')).toBeVisible();
  await page.getByRole('button', { name: '载入两室一厅示例' }).click();
  const editor = page.getByLabel('场景 JSON', { exact: true });
  const first = JSON.parse(await editor.inputValue());
  expect(first.rooms.map((room: { name: string }) => room.name)).toEqual(['客厅', '主卧', '次卧']);
  expect(first.furniture_instances).toEqual([]);
  await page.getByRole('button', { name: '保存场景' }).click();
  await expect(page.getByText('当前版本：v1', { exact: true })).toBeVisible();
  await expect(page.getByText('房间 3 · 墙体 6 · 门 3 · 窗 2 · 家具实例 0')).toBeVisible();
  await expect(page.getByLabel('当前场景 JSON')).toContainText('主卧');
  first.metadata.title = '修改后的方案';
  await editor.fill(JSON.stringify(first));
  await page.getByRole('button', { name: '保存场景' }).click();
  await expect(page.getByText('当前版本：v2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '查看 v1', exact: true }).click();
  await expect(page.getByLabel('历史场景 JSON')).toContainText('两室一厅');
  await expect(page.getByLabel('历史场景 JSON')).not.toContainText('修改后的方案');
  await page.getByRole('button', { name: '恢复 v1 为新版本', exact: true }).click();
  await expect(page.getByText('当前版本：v3', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('当前版本：v3', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '查看 v1', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '查看 v2', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '进入3D设计' })).toBeDisabled();
  const response = await page.request.get(page.url().replace('/projects/', '/api/projects/') + '/scene');
  expect(await response.text()).not.toContain('mock-valid-token');
  expect(await page.evaluate(() => ({ ...localStorage, ...sessionStorage }))).toEqual({});
});

for (const content of ['{', '{}', '{"x":1e400}']) {
  test(`invalid scene editor input does not send PUT: ${content}`, async ({ page }) => {
    let writes = 0;
    page.on('request', req => { if (req.method() === 'PUT') writes++; });
    await page.getByLabel('场景 JSON', { exact: true }).fill(content);
    await page.getByRole('button', { name: '保存场景' }).click();
    await expect(page.locator('.scene-panel').getByRole('alert')).toContainText('场景');
    expect(writes).toBe(0);
  });
}

for (const status of [403, 404, 409, 422, 503, 0]) {
  test(`scene write failure ${status} retains draft and provides Chinese feedback`, async ({ page }) => {
    await page.getByRole('button', { name: '载入两室一厅示例' }).click();
    const draft = await page.getByLabel('场景 JSON', { exact: true }).inputValue();
    await page.route('**/api/projects/*/scene', route => {
      if (route.request().method() !== 'PUT') return route.continue();
      return status === 0 ? route.abort() : route.fulfill({ status, json: { error: status === 409 ? '数据状态已发生变化，请刷新后重试' : status === 422 ? '提交的信息有误，请检查后重试' : status === 403 ? '你没有权限执行此操作' : status === 404 ? '请求的数据不存在' : '服务暂时不可用，请稍后重试' } });
    });
    await page.getByRole('button', { name: '保存场景' }).click();
    await expect(page.locator('.scene-panel').getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('场景 JSON', { exact: true })).toHaveValue(draft);
    if (status === 409) {
      await expect(page.getByRole('button', { name: '保存场景' })).toBeDisabled();
      await page.getByRole('button', { name: '重新读取当前版本（保留草稿）' }).click();
      await expect(page.getByLabel('场景 JSON', { exact: true })).toHaveValue(draft);
    }
    await expect(page.getByRole('button', { name: '保存场景' })).toBeEnabled();
  });
}

test('expired scene request clears auth and redirects', async ({ page, context }) => {
  await page.getByRole('button', { name: '载入两室一厅示例' }).click();
  await context.addCookies([{ name: 'admin_access_token', value: 'expired', domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Strict' }]);
  await page.getByRole('button', { name: '保存场景' }).click();
  await expect(page).toHaveURL(/\/login\?expired=1/);
  expect((await context.cookies()).find(cookie => cookie.name === 'admin_access_token')).toBeUndefined();
});

test('BFF rejects nonfinite scene JSON and foreign-origin writes', async ({ page }) => {
  const path = new URL(page.url()).pathname.replace('/projects/', '/api/projects/') + '/scene';
  const invalid = await page.request.put(path, { headers: { Origin: 'http://127.0.0.1:3000', 'Content-Type': 'application/json' }, data: '{"base_version":0,"scene_data":{"x":1e400}}' });
  expect(invalid.status()).toBe(422);
  const forbidden = await page.request.put(path, { headers: { Origin: 'https://foreign.example' }, data: {} });
  expect(forbidden.status()).toBe(403);
});
