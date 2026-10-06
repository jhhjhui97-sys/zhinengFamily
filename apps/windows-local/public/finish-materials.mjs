import * as THREE from "three";
import { finishRenderSpec } from "./finish-tools.mjs";

export function createFinishMaterial(finish, resources) {
  const { texture: pixels, ...settings } = finishRenderSpec(finish);
  const texture = new THREE.DataTexture(
    pixels.data,
    pixels.width,
    pixels.height,
    THREE.RGBAFormat,
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    1000 / pixels.repeat_width_mm,
    1000 / pixels.repeat_height_mm,
  );
  texture.rotation = THREE.MathUtils.degToRad(pixels.angle_deg ?? 0);
  texture.center.set(0, 0);
  texture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({
    ...settings,
    color: 0xffffff,
    map: texture,
  });
  resources.push(texture, material);
  return material;
}
