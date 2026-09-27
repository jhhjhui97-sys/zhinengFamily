import 'server-only';
import { authToken } from './auth';
import { ApiError } from './errors';
import { serverRequest } from './server';
import type { Customer, CustomerInput, PageResult } from './types';

async function token() {
  const value = await authToken();
  if (!value) throw new ApiError(401, '登录信息已失效，请重新登录');
  return value;
}

export async function listCustomers(params: { limit: number; offset: number; search?: string }) {
  const query = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
  if (params.search) query.set('search', params.search);
  return serverRequest<PageResult<Customer>>(`/customers?${query}`, { token: await token() });
}
export async function getCustomer(id: string) { return serverRequest<Customer>(`/customers/${encodeURIComponent(id)}`, { token: await token() }); }
export async function createCustomer(input: CustomerInput) { return serverRequest<Customer>('/customers', { method: 'POST', body: input, token: await token() }); }
export async function updateCustomer(id: string, input: Partial<CustomerInput>) { return serverRequest<Customer>(`/customers/${encodeURIComponent(id)}`, { method: 'PATCH', body: input, token: await token() }); }
