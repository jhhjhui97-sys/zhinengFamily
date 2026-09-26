import 'server-only';
import { authToken } from './auth';
import { ApiError } from './errors';
import { serverRequest } from './server';
import { validateMetadata } from '../product-metadata';

export async function sceneRequest<T>(id: string, suffix = '', method = 'GET', body?: unknown): Promise<T> {
  const token = await authToken();
  if (!token) throw new ApiError(401, '登录信息已失效，请重新登录');
  return serverRequest<T>(`/projects/${encodeURIComponent(id)}/scene${suffix}`, { token, method, body });
}
export async function sceneBody(request: Request): Promise<unknown> {
  let value: unknown;
  try { value = await request.json(); } catch { throw new ApiError(422, '场景请求必须是合法 JSON'); }
  if (validateMetadata(value)) throw new ApiError(422, '场景请求不能包含非有限数值，且必须是 JSON 对象');
  return value;
}
