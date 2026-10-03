import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  RoomTextureCache,
  tileWallGeometry,
} from "../public/room-materials.mjs";

test("wall plaster UVs keep a one-metre texture scale across wall lengths", () => {
  const geometry = new THREE.BoxGeometry(2.4, 2.6, 0.12);
  tileWallGeometry(geometry, 2.4, 2.6, 0.12);
  const uv = geometry.getAttribute("uv");
  assert.equal(uv.getX(16), 0);
  assert.ok(Math.abs(uv.getX(17) - 2.4) < 0.000001);
  assert.ok(Math.abs(uv.getY(16) - 2.6) < 0.000001);
  assert.ok(Math.abs(uv.getX(1) - 0.12) < 0.000001);
  geometry.dispose();
});

test("textures finishing after renderer disposal are released", async () => {
  let finishLoad;
  const disposed = [];
  const cache = new RoomTextureCache(
    () =>
      new Promise((resolve) => {
        finishLoad = resolve;
      }),
  );
  const loading = cache.get();
  cache.dispose();
  finishLoad({
    floor: { map: { dispose: () => disposed.push("floor") } },
    wall: { normalMap: { dispose: () => disposed.push("wall") } },
    complete: true,
  });
  assert.equal(await loading, null);
  assert.deepEqual(disposed, ["floor", "wall"]);
  cache.dispose();
  assert.deepEqual(disposed, ["floor", "wall"]);
});

test("textures loaded before renderer disposal are released once", async () => {
  let releases = 0;
  const textures = {
    floor: { map: { dispose: () => releases++ } },
    wall: null,
    complete: false,
  };
  const cache = new RoomTextureCache(async () => textures);
  assert.equal(await cache.get(), textures);
  cache.dispose();
  cache.dispose();
  assert.equal(releases, 1);
});
