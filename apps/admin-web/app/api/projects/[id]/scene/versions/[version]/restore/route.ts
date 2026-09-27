import { sceneBody, sceneRequest } from '@/lib/api/scenes';
import { ApiError, publicError } from '@/lib/api/errors';
import { sameOrigin } from '@/lib/api/origin';
export async function POST(request: Request, { params }: { params: Promise<{ id: string; version: string }> }) {
  if (!sameOrigin(request)) return publicError(new ApiError(403, '你没有权限执行此操作'));
  const { id, version } = await params;
  try { return Response.json(await sceneRequest(id, `/versions/${encodeURIComponent(version)}/restore`, 'POST', await sceneBody(request))); } catch (error) { return publicError(error); }
}
