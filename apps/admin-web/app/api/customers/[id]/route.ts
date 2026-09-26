import { getCustomer, updateCustomer } from '@/lib/api/customers';
import { ApiError, publicError } from '@/lib/api/errors';
import { sameOrigin } from '@/lib/api/origin';
import type { CustomerInput } from '@/lib/api/types';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return Response.json(await getCustomer((await params).id)); }
  catch (error) { return publicError(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return publicError(new ApiError(403, '你没有权限执行此操作'));
  try { return Response.json(await updateCustomer((await params).id, await request.json() as Partial<CustomerInput>)); }
  catch (error) { return publicError(error); }
}
