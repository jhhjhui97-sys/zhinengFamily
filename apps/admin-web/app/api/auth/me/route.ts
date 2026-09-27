import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/api/auth';
import { AUTH_COOKIE } from '@/lib/api/config';
import { ApiError, publicError } from '@/lib/api/errors';

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return publicError(new ApiError(401, '登录信息已失效，请重新登录'));
    return NextResponse.json(user);
  } catch (error) {
    const response = NextResponse.json({ error: error instanceof ApiError ? error.message : '服务暂时不可用，请稍后重试' }, { status: error instanceof ApiError ? error.status : 503 });
    if (error instanceof ApiError && error.status === 401) response.cookies.delete(AUTH_COOKIE);
    return response;
  }
}
