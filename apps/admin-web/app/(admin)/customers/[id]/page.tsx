import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCustomer } from '@/lib/api/customers';
import { ApiError } from '@/lib/api/errors';
import { customerStatuses, dateTime, display, money } from '@/lib/customers';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  let customer;
  try { customer = await getCustomer((await params).id); }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); if (error instanceof ApiError && error.status === 401) redirect('/api/auth/expired'); throw error; }
  const fields = [['电话', display(customer.phone)], ['微信', display(customer.wechat)], ['来源', display(customer.source)], ['地址', display(customer.address)], ['预算', money(customer.budget)], ['状态', customerStatuses[customer.status]], ['备注', display(customer.notes)], ['最后跟进时间', dateTime(customer.last_follow_up_at)], ['负责人', customer.owner_user_id], ['创建时间', dateTime(customer.created_at)], ['更新时间', dateTime(customer.updated_at)]];
  return <><div className="detail-heading"><div><span className="eyebrow">客户详情</span><h1>{customer.name}</h1><p>查看客户资料和跟进信息。</p></div><div className="detail-actions"><Link className="primary-action" href={`/customers/${customer.id}/edit`}>编辑客户</Link><Link className="secondary-action" href={`/projects/new?customer_id=${customer.id}`}>创建设计方案</Link></div></div><section className="detail-card"><dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section></>;
}
