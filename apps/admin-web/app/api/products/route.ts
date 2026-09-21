import { createProduct, listProducts } from '@/lib/api/products';
import { ApiError, publicError } from '@/lib/api/errors';
import { sameOrigin } from '@/lib/api/origin';
import type { ProductInput } from '@/lib/api/types';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return Response.json(await listProducts({
      limit: Number(url.searchParams.get('limit') ?? 20), offset: Number(url.searchParams.get('offset') ?? 0),
      search: url.searchParams.get('search')?.slice(0, 100) || undefined,
      category: url.searchParams.get('category')?.slice(0, 100) || undefined,
    }));
  } catch (error) { return publicError(error); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return publicError(new ApiError(403, '你没有权限执行此操作'));
  try { return Response.json(await createProduct(await request.json() as ProductInput), { status: 201 }); }
  catch (error) { return publicError(error); }
}
