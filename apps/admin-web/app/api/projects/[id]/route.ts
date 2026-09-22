import { getProject, updateProject } from '@/lib/api/projects';
import { ApiError, publicError } from '@/lib/api/errors';
import { sameOrigin } from '@/lib/api/origin';
import type { ProjectInput } from '@/lib/api/types';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { return Response.json(await getProject((await params).id)); } catch (error) { return publicError(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return publicError(new ApiError(403, '你没有权限执行此操作'));
  try { return Response.json(await updateProject((await params).id, await request.json() as Partial<ProjectInput>)); }
  catch (error) { return publicError(error); }
}
