import test from "node:test";
import assert from "node:assert/strict";
import {
  dragPose,
  mountFurnitureGestures,
} from "../public/furniture-gestures.mjs";
import { snapFurniturePose } from "../public/scene-tools.mjs";

test("middle-button drag moves furniture in millimetres along the floor", () => {
  const pose = dragPose(
    { x: 1200, y: 2300, rotation: 0 },
    { x: 500, y: 800 },
    { x: 750, y: 600 },
    "move",
  );
  assert.deepEqual(pose, { x: 1450, y: 2100, rotation: 0 });
});

test("right-button drag rotates by half a degree per horizontal pixel", () => {
  assert.deepEqual(
    dragPose({ x: 1000, y: 2000, rotation: 15 }, 10, 50, "rotate"),
    { x: 1000, y: 2000, rotation: 35 },
  );
});
test("planar drag keeps an elevated furniture base instead of dropping it", () => {
  assert.deepEqual(
    dragPose(
      { x: 1200, y: 2300, z: 850, rotation: 20 },
      { x: 500, y: 800 },
      { x: 750, y: 600 },
      "move",
    ),
    { x: 1450, y: 2100, z: 850, rotation: 20 },
  );
});
test("height drag changes only the furniture base elevation in millimetres", () => {
  assert.deepEqual(
    dragPose({ x: 1200, y: 2300, z: 850, rotation: 20 }, 200, 600, "height"),
    { x: 1200, y: 2300, z: 1250, rotation: 20 },
  );
});
function gestureHarness({ snap = false } = {}) {
  const scene = {
    floors: [{ id: "floor", elevation_mm: 1000, height_mm: 2800 }],
    rooms: [
      {
        id: "room",
        floor_id: "floor",
        boundary: [
          { x: 0, y: 0 },
          { x: 6000, y: 0 },
          { x: 6000, y: 6000 },
          { x: 0, y: 6000 },
        ],
      },
    ],
    furniture_instances: [
      {
        id: "table",
        room_id: "room",
        floor_id: "floor",
        position: { x: 2000, y: 2000, z: 0 },
        width_mm: 1200,
        depth_mm: 800,
        height_mm: 800,
        rotation_deg: 0,
      },
      {
        id: "screen",
        room_id: "room",
        floor_id: "floor",
        position: { x: 4000, y: 2000, z: 0 },
        width_mm: 400,
        depth_mm: 300,
        height_mm: 500,
        rotation_deg: 0,
      },
    ],
  };
  const canvas = new EventTarget(),
    captures = new Set(),
    previews = [],
    commits = [],
    heightInputs = [];
  Object.assign(canvas, {
    setPointerCapture: (id) => captures.add(id),
    hasPointerCapture: (id) => captures.has(id),
    releasePointerCapture: (id) => captures.delete(id),
  });
  const renderer = {
    controls: { enabled: true },
    pickFurniture: () => "screen",
    floorPoint: (x, y) => ({ x, y }),
    heightPoint: (x, y, elevation, anchor) => {
      heightInputs.push({ elevation, anchor });
      return 600 - y;
    },
    previewPose: (id, pose) => previews.push({ id, pose }),
  };
  const gestures = mountFurnitureGestures({
    canvas,
    renderer,
    getScene: () => scene,
    getSelectedId: () => "screen",
    canEdit: () => true,
    onSelect() {},
    onCommit: (id, pose) => commits.push({ id, pose }),
    onHint() {},
    wallGap: () => null,
    snapPose: snapFurniturePose,
    isSnappingEnabled: () => snap,
  });
  const dispatch = (type, values) => {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, {
      pointerId: 5,
      clientX: 4000,
      clientY: 2000,
      button: 1,
      ...values,
    });
    canvas.dispatchEvent(event);
  };
  return {
    scene,
    renderer,
    gestures,
    dispatch,
    commits,
    previews,
    captures,
    heightInputs,
  };
}
test("Shift plus middle button uses world height and commits a three-axis pose", () => {
  const harness = gestureHarness();
  harness.scene.furniture_instances[1].position.z = 850;
  harness.dispatch("pointerdown", { clientY: 400, shiftKey: true });
  assert.equal(harness.renderer.controls.enabled, false);
  harness.dispatch("pointermove", { clientY: 100 });
  harness.dispatch("pointerup", {});
  assert.deepEqual(harness.commits, [
    { id: "screen", pose: { x: 4000, y: 2000, z: 1150, rotation: 0 } },
  ]);
  assert.deepEqual(harness.heightInputs[0], {
    elevation: 1000,
    anchor: { x: 4000, y: 2000, z: 850 },
  });
  assert.equal(harness.renderer.controls.enabled, true);
  assert.equal(harness.captures.size, 0);
});
test("enabled face snapping previews and commits contact while Alt preserves free movement", () => {
  for (const altKey of [false, true]) {
    const harness = gestureHarness({ snap: true });
    harness.dispatch("pointerdown", {});
    harness.dispatch("pointermove", { clientX: 2827, altKey });
    harness.dispatch("pointerup", {});
    assert.deepEqual(harness.commits[0].pose, {
      x: altKey ? 2827 : 2800,
      y: 2000,
      z: 0,
      rotation: 0,
    });
    assert.deepEqual(harness.previews[0].pose, harness.commits[0].pose);
  }
});
test("cancelling an elevated gesture restores its original height without committing", () => {
  const harness = gestureHarness();
  harness.scene.furniture_instances[1].position.z = 850;
  harness.dispatch("pointerdown", { clientY: 400, shiftKey: true });
  harness.dispatch("pointermove", { clientY: 100 });
  harness.dispatch("pointercancel", {});
  assert.deepEqual(harness.commits, []);
  assert.deepEqual(harness.previews.at(-1).pose, {
    x: 4000,
    y: 2000,
    z: 850,
    rotation: 0,
  });
  assert.equal(harness.renderer.controls.enabled, true);
});
