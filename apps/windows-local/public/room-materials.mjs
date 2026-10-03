import * as THREE from "three";

const ROOM_ASSETS = "/assets/room";

async function loadSet(loader, name, metres, anisotropy, diffuse = true) {
  const parts = diffuse
    ? ["diffuse", "normal", "roughness"]
    : ["normal", "roughness"];
  const paths = parts.map((part) => `${ROOM_ASSETS}/${name}-${part}.jpg`);
  const results = await Promise.allSettled(
    paths.map((path) => loader.loadAsync(path)),
  );
  const loaded = results.filter((result) => result.status === "fulfilled");
  if (loaded.length !== parts.length) {
    for (const result of loaded) result.value.dispose();
    return null;
  }
  const textures = results.map((result) => result.value);
  const [map, normalMap, roughnessMap] = diffuse
    ? textures
    : [null, ...textures];
  if (map) map.colorSpace = THREE.SRGBColorSpace;
  for (const texture of textures) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1 / metres, 1 / metres);
    texture.anisotropy = anisotropy;
  }
  return map ? { map, normalMap, roughnessMap } : { normalMap, roughnessMap };
}

export async function loadRoomTextures(renderer) {
  const loader = new THREE.TextureLoader();
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const [floor, wall] = await Promise.all([
    loadSet(loader, "wood-floor", 1.7, anisotropy),
    loadSet(loader, "white-plaster", 1, anisotropy, false),
  ]);
  return { floor, wall, complete: Boolean(floor && wall) };
}

function disposeRoomTextures(sets) {
  for (const set of [sets?.floor, sets?.wall])
    for (const texture of Object.values(set ?? {})) texture.dispose();
}

export class RoomTextureCache {
  constructor(load) {
    this.load = load;
    this.promise = null;
    this.textures = null;
    this.disposed = false;
  }

  get() {
    if (this.disposed) return Promise.resolve(null);
    this.promise ??= this.load().then((textures) => {
      if (this.disposed) {
        disposeRoomTextures(textures);
        return null;
      }
      this.textures = textures;
      return textures;
    });
    return this.promise;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    disposeRoomTextures(this.textures);
    this.textures = null;
  }
}

export function tileWallGeometry(geometry, width, height, depth) {
  const faces = [
    [depth, height],
    [depth, height],
    [width, depth],
    [width, depth],
    [width, height],
    [width, height],
  ];
  const uv = geometry.getAttribute("uv");
  for (let face = 0; face < faces.length; face++) {
    const [u, v] = faces[face];
    for (let vertex = 0; vertex < 4; vertex++) {
      const index = face * 4 + vertex;
      uv.setXY(index, uv.getX(index) * u, uv.getY(index) * v);
    }
  }
  uv.needsUpdate = true;
  return geometry;
}
