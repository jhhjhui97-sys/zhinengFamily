import { redirect } from 'next/navigation';
import { ProjectForm } from '@/components/project-form';
import { PageHeading } from '@/components/page-heading';
import { getCustomer } from '@/lib/api/customers';
import { ApiError } from '@/lib/api/errors';

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<{ customer_id?: string }> }) {
  const id = (await searchParams).customer_id; let customer;
  if (id) { try { customer = await getCustomer(id); } catch (error) { if (error instanceof ApiError && error.status === 401) redirect('/api/auth/expired'); } }
  return <><PageHeading title="新建设计项目" description="选择客户并记录空间项目的基础资料。" /><section className="form-panel"><ProjectForm initialCustomer={customer} /></section></>;
}
