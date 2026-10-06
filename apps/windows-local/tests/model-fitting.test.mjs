import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { fitFurnitureModel } from "../public/model-fitting.mjs";
test("model fitting preserves root transforms and grounds real geometry at declared dimensions", () => {
  const source = new THREE.Group();
  source.add(new THREE.Mesh(new THREE.BoxGeometry(2, 3, 1)));
  source.position.set(4, 5, -6);
  source.scale.set(1, 2, 1);
  const result = fitFurnitureModel(source, {
    width_mm: 1675,
    height_mm: 1055,
    depth_mm: 300,
  });
  const bounds = new THREE.Box3().setFromObject(result),
    size = bounds.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - 1.675) < 1e-6);
  assert.ok(Math.abs(size.y - 1.055) < 1e-6);
  assert.ok(Math.abs(size.z - 0.3) < 1e-6);
  assert.ok(Math.abs(bounds.min.y) < 1e-6);
  assert.ok(Math.abs(bounds.min.x + bounds.max.x) < 1e-6);
  assert.deepEqual(source.position.toArray(), [4, 5, -6]);
});
test("flat models do not produce infinite transforms", () => {
  const source = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
  const result = fitFurnitureModel(source, {
    width_mm: 1000,
    height_mm: 1000,
    depth_mm: 10,
  });
  assert.ok(result.scale.toArray().every(Number.isFinite));
  assert.equal(new THREE.Box3().setFromObject(result).isEmpty(), false);
});
