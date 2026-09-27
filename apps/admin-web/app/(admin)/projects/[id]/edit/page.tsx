import { notFound, redirect } from 'next/navigation';
import { ProjectForm } from '@/components/project-form';
import { PageHeading } from '@/components/page-heading';
import { getCustomer } from '@/lib/api/customers';
import { ApiError } from '@/lib/api/errors';
import { getProject } from '@/lib/api/projects';
import { ResourceError } from '@/components/resource-error';

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let project;
  try { project = await getProject(id); }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); if (error instanceof ApiError && error.status === 401) redirect('/api/auth/expired'); return <ResourceError error={error} href={`/projects/${id}/edit`} />; }
  let customer;
  try { customer = await getCustomer(project.customer_id); }
  catch (error) { if (error instanceof ApiError && error.status === 401) redirect('/api/auth/expired'); return <ResourceError error={error} href={`/projects/${id}/edit`} />; }
  return <><PageHeading title="编辑设计项目" description={`更新 ${project.name} 的基础资料。`} /><section className="form-panel"><ProjectForm project={project} initialCustomer={customer} /></section></>;
}
