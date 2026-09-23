import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getCustomer } from '@/lib/api/customers';
import { ApiError } from '@/lib/api/errors';
import { getProject } from '@/lib/api/projects';
import { dateTime, display } from '@/lib/customers';
import { projectStatuses } from '@/lib/projects';
import { ScenePanel } from '@/components/scene-panel';

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  let project;
  try { project = await getProject((await params).id); }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); if (error instanceof ApiError && error.status === 401) redirect('/api/auth/expired'); throw error; }
  let customer; try { customer = await getCustomer(project.customer_id); } catch (error) { if (error instanceof ApiError && error.status === 401) redirect('/api/auth/expired'); throw error; }
  const fields = [['客户', customer.name], ['联系电话', display(customer.phone)], ['项目地址', display(project.address)], ['销售员', project.sales_user_id], ['状态', projectStatuses[project.status]], ['创建时间', dateTime(project.created_at)], ['更新时间', dateTime(project.updated_at)]];
  return <><div className="detail-heading"><div><span className="eyebrow">设计项目</span><h1>{project.name}</h1><p>查看项目资料和后续设计工作入口。</p></div><div className="detail-actions"><Link className="primary-action" href={`/projects/${project.id}/edit`}>编辑项目</Link><button className="secondary-action" disabled>进入3D设计</button></div></div><section className="detail-card"><dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
    <ScenePanel projectId={project.id} /><section className="future-grid" aria-label="后续设计模块"><article><h2>商品清单</h2><p>商品清单将在后续阶段开放</p></article></section></>;
}
