import { getProduct, updateProduct } from '@/lib/api/products';
import { ApiError, publicError } from '@/lib/api/errors';
import { sameOrigin } from '@/lib/api/origin';
import type { ProductInput } from '@/lib/api/types';
import { validateMetadata } from '@/lib/product-metadata';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return Response.json(await getProduct((await params).id)); }
  catch (error) { return publicError(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return publicError(new ApiError(403, '你没有权限执行此操作'));
  try {
    const input = await request.json() as Partial<ProductInput>;
    if ('metadata' in input) {
      const metadataError = validateMetadata(input.metadata);
      if (metadataError) throw new ApiError(422, metadataError);
    }
    return Response.json(await updateProduct((await params).id, input));
  }
  catch (error) { return publicError(error); }
}
