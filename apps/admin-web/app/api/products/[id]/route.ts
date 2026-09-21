import { getProduct, updateProduct } from '@/lib/api/products';
import { ApiError, publicError } from '@/lib/api/errors';
import { sameOrigin } from '@/lib/api/origin';
import type { ProductInput } from '@/lib/api/types';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return Response.json(await getProduct((await params).id)); }
  catch (error) { return publicError(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return publicError(new ApiError(403, '你没有权限执行此操作'));
  try { return Response.json(await updateProduct((await params).id, await request.json() as Partial<ProductInput>)); }
  catch (error) { return publicError(error); }
}
