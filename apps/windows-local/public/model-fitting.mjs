import { Box3, Group, Vector3 } from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";

export function fitFurnitureModel(source, item) {
  const model = clone(source),
    bounds = new Box3().setFromObject(model),
    size = bounds.getSize(new Vector3()),
    center = bounds.getCenter(new Vector3());
  if (
    bounds.isEmpty() ||
    ![...size.toArray(), ...center.toArray()].every(Number.isFinite) ||
    size.lengthSq() === 0
  )
    throw Error("模型没有有效尺寸，请检查导出的几何。");
  const shifted = new Group();
  shifted.add(model);
  shifted.position.set(-center.x, -bounds.min.y, -center.z);
  const normalized = new Group();
  normalized.add(shifted);
  normalized.scale.set(
    size.x > 0 ? item.width_mm / 1000 / size.x : 1,
    size.y > 0 ? item.height_mm / 1000 / size.y : 1,
    size.z > 0 ? item.depth_mm / 1000 / size.z : 1,
  );
  return normalized;
}
