import { createCustomer, listCustomers } from '@/lib/api/customers';
import { ApiError, publicError } from '@/lib/api/errors';
import { sameOrigin } from '@/lib/api/origin';
import type { CustomerInput } from '@/lib/api/types';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return Response.json(await listCustomers({ limit: Number(url.searchParams.get('limit') ?? 20), offset: Number(url.searchParams.get('offset') ?? 0), search: url.searchParams.get('search')?.slice(0, 100) || undefined }));
  } catch (error) { return publicError(error); }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return publicError(new ApiError(403, '你没有权限执行此操作'));
  try { return Response.json(await createCustomer(await request.json() as CustomerInput), { status: 201 }); }
  catch (error) { return publicError(error); }
}
