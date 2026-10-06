import test from "node:test";
import assert from "node:assert/strict";
import { Vector2 } from "three";
import { createFinishMaterial } from "../public/finish-materials.mjs";
import { normalizeFinish } from "../public/finish-catalog.mjs";
test("finish material uses physical texture repeat, single opacity, and disposable resources", () => {
  const resources = [],
    finish = normalizeFinish(
      {
        preset_id: "floor-porcelain",
        width_mm: 800,
        height_mm: 400,
        opacity: 0.5,
      },
      "floor",
    );
  const material = createFinishMaterial(finish, resources);
  assert.equal(material.color.getHex(), 0xffffff);
  assert.equal(material.opacity, 0.5);
  assert.equal(material.transparent, true);
  assert.ok(material.map.repeat.x > 0 && material.map.repeat.y > 0);
  assert.equal(material.map.image.data[3], 255);
  assert.equal(resources.length, 2);
  const events = [];
  for (const resource of resources) {
    resource.addEventListener("dispose", () => events.push(1));
    resource.dispose();
  }
  assert.equal(events.length, 2);
});
test("non-square finish direction rotates physical coordinates before texture repetition", () => {
  const finish = normalizeFinish(
    {
      preset_id: "floor-porcelain",
      width_mm: 600,
      height_mm: 400,
      angle_deg: 90,
    },
    "floor",
  );
  const material = createFinishMaterial(finish, []);
  material.map.updateMatrix();
  const first = new Vector2(0.6, 0).applyMatrix3(material.map.matrix),
    second = new Vector2(0.4, 0).applyMatrix3(material.map.matrix);
  assert.ok(Math.abs((Math.abs(first.y) % 1) - 0.5) < 1e-6);
  assert.ok(Math.abs(Math.abs(second.y) % 1) < 1e-6);
});
