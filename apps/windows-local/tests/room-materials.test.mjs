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

test("wall finishes keep their global horizontal phase on both sides across a door opening", () => {
  const left = new THREE.BoxGeometry(1, 2.8, 0.2);
  const right = new THREE.BoxGeometry(2.1, 2.8, 0.2);
  tileWallGeometry(left, 1, 2.8, 0.2, { x: 0, y: 0 });
  tileWallGeometry(right, 2.1, 2.8, 0.2, { x: 1.9, y: 0 });
  const a = left.getAttribute("uv"),
    b = right.getAttribute("uv");
  assert.equal(a.getX(16), 0);
  assert.equal(a.getX(17), 1);
  assert.ok(Math.abs(b.getX(16) - 1.9) < 1e-6);
  assert.equal(b.getX(17), 4);
  assert.equal(a.getX(20), -1);
  assert.equal(a.getX(21), 0);
  assert.equal(b.getX(20), -4);
  assert.ok(Math.abs(b.getX(21) + 1.9) < 1e-6);
  left.dispose();
  right.dispose();
});

test("window header and sill pieces retain physical horizontal and vertical texture coordinates", () => {
  const side = new THREE.BoxGeometry(1, 2.8, 0.2);
  const header = new THREE.BoxGeometry(0.9, 0.6, 0.2);
  const sill = new THREE.BoxGeometry(0.9, 0.8, 0.2);
  tileWallGeometry(side, 1, 2.8, 0.2, { x: 0, y: 0 });
  tileWallGeometry(header, 0.9, 0.6, 0.2, { x: 1, y: 2.2 });
  tileWallGeometry(sill, 0.9, 0.8, 0.2, { x: 1, y: 0 });
  const a = side.getAttribute("uv"),
    b = header.getAttribute("uv"),
    c = sill.getAttribute("uv");
  assert.equal(b.getX(16), a.getX(17));
  assert.equal(b.getX(21), a.getX(20));
  assert.equal(c.getX(16), b.getX(16));
  assert.equal(c.getX(21), b.getX(21));
  assert.ok(Math.abs(b.getY(16) - 2.8) < 1e-6);
  assert.ok(Math.abs(b.getY(18) - 2.2) < 1e-6);
  assert.ok(Math.abs(b.getY(22) - 2.2) < 1e-6);
  assert.equal(c.getY(18), 0);
  assert.ok(Math.abs(c.getY(16) - 0.8) < 1e-6);
  side.dispose();
  header.dispose();
  sill.dispose();
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
