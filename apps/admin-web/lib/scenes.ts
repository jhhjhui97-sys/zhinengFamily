import apartment from './two-bedroom.json';
import { validateMetadata } from './product-metadata';
import type { JsonValue } from './api/types';

export type SceneDocument = Record<string, JsonValue>;
export interface SceneVersion {
  id: string; merchant_id: string; design_project_id: string; version: number;
  scene_data: SceneDocument; created_by: string; created_at: string;
}
export function exampleScene(): SceneDocument {
  const value = structuredClone(apartment);
  value.scene_id = crypto.randomUUID();
  return value;
}
export function sceneInputError(value: unknown): string | null {
  if (validateMetadata(value)) return '场景必须是合法 JSON 对象，且不能包含非有限数值';
  const scene = value as SceneDocument;
  if (scene.schema_version !== '1.0.0' || typeof scene.scene_id !== 'string' || scene.units !== 'mm' || scene.coordinate_system !== 'RH_Z_UP' || !Array.isArray(scene.floors) || scene.floors.length === 0) return '场景缺少必要协议字段，请载入示例或检查 JSON';
  return null; // FastAPI performs the complete authoritative Pydantic validation.
}
