'use client';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { Customer, DesignProject, ProjectInput, ProjectStatus } from '@/lib/api/types';
import { projectStatuses } from '@/lib/projects';
import { CustomerPicker } from './customer-picker';
import { browserRequest } from '@/lib/api/browser';
import { ApiError, errorMessage } from '@/lib/api/errors';

export function ProjectForm({ project, initialCustomer }: { project?: DesignProject; initialCustomer?: Customer }) {
  const router = useRouter(); const [customer, setCustomer] = useState<Customer | undefined>(initialCustomer); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [nameError, setNameError] = useState(''); const [customerError, setCustomerError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNameError(''); setCustomerError(''); const form = new FormData(event.currentTarget); const name = String(form.get('name') ?? '').trim();
    if (!name) setNameError('请输入项目名称'); if (!customer) setCustomerError('请选择客户'); if (!name || !customer) return;
    const input: ProjectInput = { customer_id: customer.id, name, address: String(form.get('address') ?? '').trim() || null, status: String(form.get('status')) as ProjectStatus };
    setBusy(true);
    try { const body = await browserRequest<DesignProject>(project ? `/api/projects/${project.id}` : '/api/projects', { method: project ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }); router.replace(`/projects/${body.id}`); router.refresh(); }
    catch (cause) { if (cause instanceof ApiError && cause.status === 401) { router.replace('/login?expired=1'); router.refresh(); return; } setError(cause instanceof ApiError ? cause.message : errorMessage(503)); setBusy(false); }
  }
  return <form className="customer-form" noValidate onSubmit={submit}><div className="wide"><CustomerPicker initial={initialCustomer} onSelect={setCustomer} />{customerError && <small className="field-error">{customerError}</small>}</div>
    <div><label htmlFor="name">项目名称 *</label><input id="name" name="name" maxLength={200} defaultValue={project?.name ?? ''} />{nameError && <small className="field-error">{nameError}</small>}</div><div><label htmlFor="status">项目状态</label><select id="status" name="status" defaultValue={project?.status ?? 'draft'}>{Object.entries(projectStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    <div className="wide"><label htmlFor="address">项目地址</label><input id="address" name="address" maxLength={500} defaultValue={project?.address ?? ''} /></div>{project && <p className="selection-note wide">当前销售员：{project.sales_user_id}。负责人转交继续由现有后端权限控制。</p>}{error && <p className="form-error wide" role="alert">{error}</p>}
    <div className="form-actions wide"><button className="primary-action" type="submit" disabled={busy}>{busy ? '保存中…' : project ? '保存修改' : '保存项目'}</button><button className="secondary-action" type="button" onClick={() => router.back()} disabled={busy}>取消</button></div>
  </form>;
}
