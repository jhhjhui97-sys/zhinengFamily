import { sceneRequest } from '@/lib/api/scenes';
import { publicError } from '@/lib/api/errors';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; version: string }> }) {
  const { id, version } = await params;
  try { return Response.json(await sceneRequest(id, `/versions/${encodeURIComponent(version)}`)); } catch (error) { return publicError(error); }
}
