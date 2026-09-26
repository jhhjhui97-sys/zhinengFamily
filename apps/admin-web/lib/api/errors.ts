export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

export function errorMessage(status: number, details?: unknown): string {
  switch (status) {
    case 401: return '登录信息已失效，请重新登录';
    case 403: return '你没有权限执行此操作';
    case 404: return '请求的数据不存在';
    case 409: return '数据状态已发生变化，请刷新后重试';
    case 422: {
      if (Array.isArray(details)) {
        const field = details.find(item => item && typeof item === 'object' && Array.isArray(item.loc))?.loc?.at(-1);
        if (field === 'merchant_id') return '商家 ID 格式不正确';
        if (field === 'email') return '邮箱格式不正确';
        if (field === 'password') return '请输入有效密码';
      }
      return '提交的信息有误，请检查后重试';
    }
    default: return '服务暂时不可用，请稍后重试';
  }
}

export function publicError(error: unknown): Response {
  const status = error instanceof ApiError ? error.status : 503;
  const response = Response.json({ error: error instanceof ApiError ? error.message : errorMessage(status) }, { status });
  if (status === 401) response.headers.append('Set-Cookie', 'admin_access_token=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict');
  return response;
}
