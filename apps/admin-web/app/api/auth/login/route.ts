import { NextResponse } from 'next/server';
import { loginToApi } from '@/lib/api/auth';
import { AUTH_COOKIE, cookieOptions } from '@/lib/api/config';
import { ApiError, publicError } from '@/lib/api/errors';
import { sameOrigin } from '@/lib/api/origin';
import type { LoginInput } from '@/lib/api/types';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return publicError(new ApiError(403, '你没有权限执行此操作'));
  try {
    const input = await request.json() as LoginInput;
    if (!input || typeof input.merchant_id !== 'string' || typeof input.email !== 'string' || typeof input.password !== 'string') {
      return publicError(new ApiError(422, '请填写商家 ID、邮箱和密码'));
    }
    const token = await loginToApi(input);
    if (!token.access_token || token.token_type.toLowerCase() !== 'bearer' || !Number.isFinite(token.expires_in) || token.expires_in <= 0) {
      return publicError(new ApiError(503, '服务暂时不可用，请稍后重试'));
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(AUTH_COOKIE, token.access_token, { ...cookieOptions, maxAge: token.expires_in });
    return response;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return publicError(new ApiError(401, '账号或密码错误，请重试'));
    return publicError(error);
  }
}
