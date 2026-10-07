import { Box3, LoadingManager } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

function displayable(scene) {
  if (!scene) return false;
  let geometry = false;
  scene.traverse((node) => {
    if (
      (node.isMesh || node.isLine || node.isPoints) &&
      node.geometry?.getAttribute("position")?.count > 0 &&
      (!node.isInstancedMesh || node.count > 0)
    )
      geometry = true;
  });
  if (!geometry) return false;
  const box = new Box3().setFromObject(scene);
  return (
    !box.isEmpty() &&
    box.max.distanceToSquared(box.min) > 0 &&
    [...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)
  );
}

export function createFurnitureLoader(
  renderer = null,
  manager = new LoadingManager(),
) {
  const draco = new DRACOLoader(manager)
    .setDecoderPath("/vendor/three/examples/jsm/libs/draco/gltf/")
    .setWorkerLimit(2);
  const ktx2 = renderer
    ? new KTX2Loader(manager)
        .setTranscoderPath("/vendor/three/examples/jsm/libs/basis/")
        .setWorkerLimit(2)
        .detectSupport(renderer)
    : null;
  const loader = new GLTFLoader(manager)
    .setDRACOLoader(draco)
    .setMeshoptDecoder(MeshoptDecoder);
  if (ktx2) loader.setKTX2Loader(ktx2);
  let disposed = false;
  return {
    async loadAsync(url) {
      if (disposed) throw Error("模型加载器已关闭，请重新打开设计工作台。");
      const result = await loader.loadAsync(url);
      const scene = [result.scene, ...(result.scenes ?? [])].find(displayable);
      if (!scene) throw Error("GLB 中没有可显示的网格几何，请检查导出的场景。");
      result.scene = scene;
      return result;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      draco.dispose();
      ktx2?.dispose();
    },
  };
}
