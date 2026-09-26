'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { Customer, CustomerInput, CustomerStatus } from '@/lib/api/types';
import { customerStatuses } from '@/lib/customers';
import { browserRequest } from '@/lib/api/browser';
import { ApiError, errorMessage } from '@/lib/api/errors';

export function CustomerForm({ customer }: { customer?: Customer }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [nameError, setNameError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNameError(''); const form = new FormData(event.currentTarget); const name = String(form.get('name') ?? '').trim();
    if (!name) { setNameError('请输入客户姓名'); return; }
    const nullable = (key: string) => String(form.get(key) ?? '').trim() || null;
    const input: CustomerInput = { name, phone: nullable('phone'), wechat: nullable('wechat'), source: nullable('source'), address: nullable('address'), budget: nullable('budget'), status: String(form.get('status')) as CustomerStatus, notes: nullable('notes') };
    setBusy(true);
    try { const body = await browserRequest<Customer>(customer ? `/api/customers/${customer.id}` : '/api/customers', { method: customer ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }); router.replace(`/customers/${body.id}`); router.refresh(); }
    catch (cause) { if (cause instanceof ApiError && cause.status === 401) { router.replace('/login?expired=1'); router.refresh(); return; } setError(cause instanceof ApiError ? cause.message : errorMessage(503)); setBusy(false); }
  }
  return <form className="customer-form" noValidate onSubmit={submit}>
    <div><label htmlFor="name">姓名 *</label><input id="name" name="name" maxLength={200} defaultValue={customer?.name ?? ''} />{nameError && <small className="field-error">{nameError}</small>}</div>
    <div><label htmlFor="phone">手机</label><input id="phone" name="phone" maxLength={32} defaultValue={customer?.phone ?? ''} /></div><div><label htmlFor="wechat">微信</label><input id="wechat" name="wechat" maxLength={100} defaultValue={customer?.wechat ?? ''} /></div><div><label htmlFor="source">来源</label><input id="source" name="source" maxLength={100} defaultValue={customer?.source ?? ''} /></div>
    <div className="wide"><label htmlFor="address">地址</label><input id="address" name="address" maxLength={500} defaultValue={customer?.address ?? ''} /></div><div><label htmlFor="budget">预算</label><input id="budget" name="budget" inputMode="decimal" defaultValue={customer?.budget ?? ''} placeholder="例如 80000.00" /></div><div><label htmlFor="status">状态</label><select id="status" name="status" defaultValue={customer?.status ?? 'new'}>{Object.entries(customerStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    <div className="wide"><label htmlFor="notes">备注</label><textarea id="notes" name="notes" maxLength={10000} rows={5} defaultValue={customer?.notes ?? ''} /></div>{error && <p className="form-error wide" role="alert">{error}</p>}
    <div className="form-actions wide"><button className="primary-action" type="submit" disabled={busy}>{busy ? '保存中…' : customer ? '保存修改' : '保存客户'}</button><button className="secondary-action" type="button" onClick={() => router.back()} disabled={busy}>取消</button></div>
  </form>;
}
