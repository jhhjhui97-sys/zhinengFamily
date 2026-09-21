import type { CustomerStatus } from './api/types';

export const customerStatuses: Record<CustomerStatus, string> = { new: '新客户', following: '跟进中', won: '已成交', lost: '已流失' };
export function display(value: string | null | undefined) { return value?.trim() || '—'; }
export function money(value: string | null) {
  if (value === null) return '—';
  const [whole] = value.split('.');
  return `¥${BigInt(whole).toLocaleString('zh-CN')}`;
}
export function dateTime(value: string | null) { return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(new Date(value)) : '—'; }
