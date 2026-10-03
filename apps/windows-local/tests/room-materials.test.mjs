import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { tileWallGeometry } from "../public/room-materials.mjs";

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
