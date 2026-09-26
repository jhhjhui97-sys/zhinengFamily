import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeading } from '@/components/page-heading';
import { getCustomer } from '@/lib/api/customers';
import { ApiError } from '@/lib/api/errors';
import { listProjects } from '@/lib/api/projects';
import { dateTime, display } from '@/lib/customers';
import { projectStatuses } from '@/lib/projects';

const pageSize = 20;
export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ offset?: string }> }) {
  const query = await searchParams; const offset = Math.max(0, Number.parseInt(query.offset ?? '0', 10) || 0); let result;
  try { result = await listProjects({ limit: pageSize, offset }); }
  catch (error) { if (error instanceof ApiError && error.status === 401) redirect('/api/auth/expired'); return <><PageHeading title="设计项目" description="围绕客户与空间，清晰管理每一个设计项目。" /><p className="form-error">{error instanceof ApiError ? error.message : '服务暂时不可用，请稍后重试'}</p></>; }
  const customerNames = new Map<string, string>(); await Promise.all(result.items.map(async project => { try { customerNames.set(project.customer_id, (await getCustomer(project.customer_id)).name); } catch (error) { if (error instanceof ApiError && error.status === 401) redirect('/api/auth/expired'); customerNames.set(project.customer_id, '—'); } }));
  const start = result.total ? result.offset + 1 : 0; const end = Math.min(result.offset + result.items.length, result.total);
  return <><div className="heading-actions"><PageHeading title="设计项目" description="围绕客户与空间，清晰管理每一个设计项目。" /><Link className="primary-action" href="/projects/new">新建设计项目</Link></div><div className="resource-panel"><div className="panel-header"><h2>项目列表</h2><span className="pill">共 {result.total} 个</span></div>
    {result.items.length ? <div className="table-scroll"><table className="customer-table project-table"><thead><tr><th>项目名称</th><th>客户</th><th>地址</th><th>销售员</th><th>状态</th><th>更新时间</th></tr></thead><tbody>{result.items.map(project => <tr key={project.id}><td><Link href={`/projects/${project.id}`}>{project.name}</Link></td><td>{customerNames.get(project.customer_id) ?? '—'}</td><td>{display(project.address)}</td><td>{project.sales_user_id}</td><td><span className={`status status-${project.status}`}>{projectStatuses[project.status]}</span></td><td>{dateTime(project.updated_at)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><span className="empty-symbol">◇</span><h2>暂无设计项目</h2><p>从客户需求出发，新建第一份设计方案。</p><Link className="primary-action" href="/projects/new">新建设计项目</Link></div>}
    <div className="pagination"><span>显示 {start}–{end} / 共 {result.total} 个项目</span><div>{offset > 0 ? <Link href={`/projects?offset=${Math.max(0, offset - pageSize)}`}>上一页</Link> : <span>上一页</span>}{offset + result.items.length < result.total ? <Link href={`/projects?offset=${offset + pageSize}`}>下一页</Link> : <span>下一页</span>}</div></div></div></>;
}
