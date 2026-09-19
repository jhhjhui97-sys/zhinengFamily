import { NextResponse } from 'next/server';
import { AUTH_COOKIE } from '@/lib/api/config';
import { ApiError, publicError } from '@/lib/api/errors';
import { sameOrigin } from '@/lib/api/origin';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return publicError(new ApiError(403, '你没有权限执行此操作'));
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(AUTH_COOKIE);
  return response;
}
