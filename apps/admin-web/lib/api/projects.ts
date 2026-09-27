import 'server-only';
import { authToken } from './auth';
import { ApiError } from './errors';
import { serverRequest } from './server';
import type { DesignProject, PageResult, ProjectInput } from './types';

async function token() {
  const value = await authToken();
  if (!value) throw new ApiError(401, '登录信息已失效，请重新登录');
  return value;
}

export async function listProjects(params: { limit: number; offset: number }) {
  const query = new URLSearchParams({ limit: String(params.limit), offset: String(params.offset) });
  return serverRequest<PageResult<DesignProject>>(`/projects?${query}`, { token: await token() });
}
export async function getProject(id: string) { return serverRequest<DesignProject>(`/projects/${encodeURIComponent(id)}`, { token: await token() }); }
export async function createProject(input: ProjectInput) { return serverRequest<DesignProject>('/projects', { method: 'POST', body: input, token: await token() }); }
export async function updateProject(id: string, input: Partial<ProjectInput>) { return serverRequest<DesignProject>(`/projects/${encodeURIComponent(id)}`, { method: 'PATCH', body: input, token: await token() }); }
