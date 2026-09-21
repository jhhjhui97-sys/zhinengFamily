import 'server-only';
import { authToken } from './auth';
import { ApiError } from './errors';
import { serverRequest } from './server';
import type { PageResult, Product, ProductInput } from './types';

async function token() {
  const value = await authToken();
  if (!value) throw new ApiError(401, '登录信息已失效，请重新登录');
  return value;
}

export async function listProducts(params: { limit: number; offset: number; search?: string; category?: string }) {
  const query = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
  if (params.search) query.set('search', params.search);
  if (params.category) query.set('category', params.category);
  return serverRequest<PageResult<Product>>(`/products?${query}`, { token: await token() });
}
export async function getProduct(id: string) { return serverRequest<Product>(`/products/${encodeURIComponent(id)}`, { token: await token() }); }
export async function createProduct(input: ProductInput) { return serverRequest<Product>('/products', { method: 'POST', body: input, token: await token() }); }
export async function updateProduct(id: string, input: Partial<ProductInput>) { return serverRequest<Product>(`/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: input, token: await token() }); }
