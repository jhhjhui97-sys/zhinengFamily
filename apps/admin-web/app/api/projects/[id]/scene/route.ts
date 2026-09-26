import { sceneBody, sceneRequest } from '@/lib/api/scenes';
import { ApiError, publicError } from '@/lib/api/errors';
import { sameOrigin } from '@/lib/api/origin';
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  try { return Response.json(await sceneRequest((await params).id)); } catch (error) { return publicError(error); }
}
export async function PUT(request: Request, { params }: Context) {
  if (!sameOrigin(request)) return publicError(new ApiError(403, '你没有权限执行此操作'));
  try { return Response.json(await sceneRequest((await params).id, '', 'PUT', await sceneBody(request))); } catch (error) { return publicError(error); }
}
