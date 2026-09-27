import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeading } from '@/components/page-heading';
import { listCustomers } from '@/lib/api/customers';
import { ApiError } from '@/lib/api/errors';
import { customerStatuses, dateTime, display, money } from '@/lib/customers';

const pageSize = 20;
export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ search?: string; offset?: string }> }) {
  const query = await searchParams;
  const search = query.search?.trim().slice(0, 100) ?? '';
  const offset = Math.max(0, Number.parseInt(query.offset ?? '0', 10) || 0);
  let result;
  try { result = await listCustomers({ limit: pageSize, offset, search: search || undefined }); }
  catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/api/auth/expired');
    return <><PageHeading title="客户管理" description="了解每一位客户，让接待与跟进更从容。" /><p className="form-error">{error instanceof ApiError ? error.message : '服务暂时不可用，请稍后重试'}</p></>;
  }
  const start = result.total ? result.offset + 1 : 0;
  const end = Math.min(result.offset + result.items.length, result.total);
  const link = (next: number) => `/customers?${new URLSearchParams({ ...(search ? { search } : {}), offset: String(next) })}`;
  return <><div className="heading-actions"><PageHeading title="客户管理" description="了解每一位客户，让接待与跟进更从容。" /><Link className="primary-action" href="/customers/new">新建客户</Link></div>
    <form className="search-form"><label htmlFor="customer-search">搜索客户</label><input id="customer-search" name="search" defaultValue={search} maxLength={100} placeholder="姓名、手机或微信" /><button type="submit">搜索</button></form>
    <div className="resource-panel"><div className="panel-header"><h2>客户列表</h2><span className="pill">共 {result.total} 位</span></div>
      {result.items.length ? <div className="table-scroll"><table className="customer-table"><thead><tr><th>姓名</th><th>手机</th><th>微信</th><th>来源</th><th>地址</th><th>预算</th><th>状态</th><th>最后跟进</th></tr></thead><tbody>{result.items.map(customer => <tr key={customer.id}><td><Link href={`/customers/${customer.id}`}>{customer.name}</Link></td><td>{display(customer.phone)}</td><td>{display(customer.wechat)}</td><td>{display(customer.source)}</td><td>{display(customer.address)}</td><td>{money(customer.budget)}</td><td><span className={`status status-${customer.status}`}>{customerStatuses[customer.status]}</span></td><td>{dateTime(customer.last_follow_up_at)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><span className="empty-symbol">◎</span><h2>{search ? '没有匹配的客户' : '暂无客户'}</h2><p>{search ? '请尝试其他姓名、手机或微信。' : '新建第一位客户，开始记录接待与跟进。'}</p>{!search && <Link className="primary-action" href="/customers/new">新建客户</Link>}</div>}
      <div className="pagination"><span>显示 {start}–{end} / 共 {result.total} 位客户</span><div>{offset > 0 ? <Link href={link(Math.max(0, offset - pageSize))}>上一页</Link> : <span>上一页</span>}{offset + result.items.length < result.total ? <Link href={link(offset + pageSize)}>下一页</Link> : <span>下一页</span>}</div></div>
    </div></>;
}
