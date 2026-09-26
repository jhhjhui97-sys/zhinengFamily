import { notFound, redirect } from 'next/navigation';
import { CustomerForm } from '@/components/customer-form';
import { PageHeading } from '@/components/page-heading';
import { getCustomer } from '@/lib/api/customers';
import { ApiError } from '@/lib/api/errors';
import { ResourceError } from '@/components/resource-error';

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let customer;
  try { customer = await getCustomer(id); }
  catch (error) { if (error instanceof ApiError && error.status === 404) notFound(); if (error instanceof ApiError && error.status === 401) redirect('/api/auth/expired'); return <ResourceError error={error} href={`/customers/${id}/edit`} />; }
  return <><PageHeading title="编辑客户" description={`更新 ${customer.name} 的资料与跟进状态。`} /><section className="form-panel"><CustomerForm customer={customer} /></section></>;
}
