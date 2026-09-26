import { expect, test } from '@playwright/test';
import { login } from './auth-helper';

test.beforeEach(async ({ page }) => { await login(page); });

test('project list shows customer, status, sales user and pagination', async ({ page }) => {
  await page.goto('/projects');
  const row = page.getByRole('row', { name: /张先生全屋设计/ });
  await expect(row.getByRole('cell', { name: '张先生', exact: true })).toBeVisible(); await expect(row.getByText('进行中')).toBeVisible();
  await expect(row.getByText('11111111-1111-4111-8111-111111111111')).toBeVisible();
  await expect(page.getByText('显示 1–20 / 共 21 个项目')).toBeVisible();
  await page.getByRole('link', { name: '下一页' }).click();
  await expect(page.getByRole('link', { name: '分页项目20' })).toBeVisible();
});

test('new project finds a customer beyond the first page', async ({ page }) => {
  await page.goto('/projects/new');
  await page.getByLabel('查找客户').fill('分页客户17');
  await page.getByRole('button', { name: '选择 分页客户17' }).click();
  await page.getByLabel('项目名称 *').fill('远页客户项目'); await page.getByRole('button', { name: '保存项目' }).click();
  await expect(page.getByRole('heading', { name: '远页客户项目' })).toBeVisible();
  await expect(page.getByText('分页客户17')).toBeVisible();
});

test('customer detail creates a linked design project', async ({ page }) => {
  await page.goto('/customers/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
  await page.getByRole('link', { name: '创建设计方案' }).click();
  await expect(page.getByText('已选择：张先生')).toBeVisible();
  await page.getByLabel('项目名称 *').fill('龙湖小区120㎡'); await page.getByLabel('项目地址').fill('龙湖小区');
  await page.getByRole('button', { name: '保存项目' }).click();
  await expect(page.getByRole('heading', { name: '龙湖小区120㎡' })).toBeVisible();
  await expect(page.getByText('张先生')).toBeVisible();
});

test('project form validates and presents API errors in Chinese', async ({ page }) => {
  await page.goto('/projects/new'); await page.getByRole('button', { name: '保存项目' }).click();
  await expect(page.getByText('请输入项目名称')).toBeVisible(); await expect(page.getByText('请选择客户')).toBeVisible();
  await page.getByLabel('查找客户').fill('张先生'); await page.getByRole('button', { name: '选择 张先生' }).click();
  await page.getByLabel('项目名称 *').fill('冲突项目'); await page.getByRole('button', { name: '保存项目' }).click();
  await expect(page.locator('.form-error')).toContainText('数据状态已发生变化');
});

test('project detail includes customer and future design placeholders', async ({ page }) => {
  await page.goto('/projects/12121212-1212-4121-8121-121212121211');
  await expect(page.getByRole('heading', { name: '张先生全屋设计' })).toBeVisible();
  await expect(page.getByText('SceneModel 尚未创建')).toBeVisible(); await expect(page.getByRole('heading', { name: '版本历史' })).toBeVisible();
  await expect(page.getByText('商品清单将在后续阶段开放')).toBeVisible(); await expect(page.getByRole('button', { name: '进入3D设计' })).toBeDisabled();
});

test('project edit updates allowed fields and preserves assignee', async ({ page }) => {
  await page.goto('/projects/12121212-1212-4121-8121-121212121211/edit');
  await page.getByLabel('项目名称 *').fill('张先生全屋升级'); await page.getByLabel('项目状态').selectOption('archived');
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.getByRole('heading', { name: '张先生全屋升级' })).toBeVisible(); await expect(page.getByText('已归档')).toBeVisible();
  await expect(page.getByText('11111111-1111-4111-8111-111111111111')).toBeVisible();
});

test('missing project uses Chinese 404', async ({ page }) => {
  await page.goto('/projects/13131313-1313-4131-8131-131313131313'); await expect(page.getByRole('heading', { name: '项目不存在' })).toBeVisible();
});

test('project BFF clears expired auth and never exposes JWT', async ({ page, context }) => {
  await context.addCookies([{ name: 'admin_access_token', value: 'truly-expired-token', domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Strict' }]);
  await page.goto('/projects'); await expect(page).toHaveURL(/\/login\?expired=1/); expect((await context.cookies()).find(cookie => cookie.name === 'admin_access_token')).toBeUndefined();
  await login(page); const response = await page.request.get('/api/projects'); expect(await response.text()).not.toContain('mock-valid-token');
  expect(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }))).toEqual({ local: {}, session: {} });
});
