import { expect, test } from '@playwright/test';
import { login } from './auth-helper';

test.beforeEach(async ({ page }) => { await login(page); });

test('customer list shows real data, null placeholders, money and pagination', async ({ page }) => {
  await page.goto('/customers');
  await expect(page.getByRole('link', { name: '张先生' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '¥80,000', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '¥80,000.50', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '¥12,345.67', exact: true })).toBeVisible();
  await expect(page.getByText('跟进中')).toBeVisible();
  const li = page.getByRole('row', { name: /李女士/ });
  await expect(li.getByText('—')).toHaveCount(6);
  await expect(page.getByText('显示 1–20 / 共 21 位客户')).toBeVisible();
  await page.getByRole('link', { name: '下一页' }).click();
  await expect(page.getByRole('link', { name: '分页客户17' })).toBeVisible();
});

test('search filters customers and preserves server pagination', async ({ page }) => {
  await page.goto('/customers');
  await page.getByLabel('搜索客户').fill('张');
  await page.getByRole('button', { name: '搜索' }).click();
  await expect(page.getByRole('link', { name: '张先生' })).toBeVisible();
  await expect(page.getByRole('link', { name: '李女士' })).toBeHidden();
  await expect(page).toHaveURL(/search=%E5%BC%A0/);
});

test('creates a customer and opens detail without exposing token', async ({ page }) => {
  const responses: string[] = [];
  page.on('response', async response => { if (response.url().includes('/api/customers')) responses.push(await response.text()); });
  await page.goto('/customers/new');
  await page.getByLabel('姓名').fill('陈女士');
  await page.getByLabel('手机').fill('13600000000');
  await page.getByLabel('预算').fill('66000.00');
  await page.getByRole('button', { name: '保存客户' }).click();
  await expect(page.getByRole('heading', { name: '陈女士' })).toBeVisible();
  expect(responses.join('')).not.toContain('mock-valid-token');
});

test('create validation and API error are shown in Chinese', async ({ page }) => {
  await page.goto('/customers/new');
  await page.getByRole('button', { name: '保存客户' }).click();
  await expect(page.getByText('请输入客户姓名')).toBeVisible();
  await page.getByLabel('姓名').fill('冲突客户');
  await page.getByRole('button', { name: '保存客户' }).click();
  await expect(page.locator('.form-error')).toContainText('数据状态已发生变化');
});

test('customer detail shows complete existing fields and project action', async ({ page }) => {
  await page.goto('/customers/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
  await expect(page.getByRole('heading', { name: '张先生' })).toBeVisible();
  await expect(page.getByText('偏好原木风')).toBeVisible();
  await expect(page.getByText('11111111-1111-4111-8111-111111111111')).toBeVisible();
  await expect(page.getByRole('link', { name: '创建设计方案' })).toHaveAttribute('href', '/projects/new?customer_id=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
});

test('missing or cross-merchant customer shows Chinese 404', async ({ page }) => {
  await page.goto('/customers/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  await expect(page.getByRole('heading', { name: '客户不存在' })).toBeVisible();
});

test('edits a customer and validates the form', async ({ page }) => {
  await page.goto('/customers/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1/edit');
  await page.getByLabel('预算').fill('98000.00');
  await page.getByLabel('姓名').fill('');
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.getByText('请输入客户姓名')).toBeVisible();
  await page.getByLabel('姓名').fill('张先生');
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.getByRole('heading', { name: '张先生' })).toBeVisible();
  await expect(page.getByText('¥98,000')).toBeVisible();
});
