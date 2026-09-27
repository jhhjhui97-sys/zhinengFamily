import { createProject, listProjects } from '@/lib/api/projects';
import { ApiError, publicError } from '@/lib/api/errors';
import { sameOrigin } from '@/lib/api/origin';
import type { ProjectInput } from '@/lib/api/types';

export async function GET(request: Request) {
  try { const url = new URL(request.url); return Response.json(await listProjects({ limit: Number(url.searchParams.get('limit') ?? 20), offset: Number(url.searchParams.get('offset') ?? 0) })); }
  catch (error) { return publicError(error); }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return publicError(new ApiError(403, '你没有权限执行此操作'));
  try { return Response.json(await createProject(await request.json() as ProjectInput), { status: 201 }); }
  catch (error) { return publicError(error); }
}
