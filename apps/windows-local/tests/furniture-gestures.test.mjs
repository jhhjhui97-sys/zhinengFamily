import test from "node:test";
import assert from "node:assert/strict";
import { dragPose } from "../public/furniture-gestures.mjs";

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
