import test from "node:test";
import assert from "node:assert/strict";
import {
  suggestMmPerUnit,
  calibrateMmPerUnit,
  buildDxfScene,
} from "../public/dxf-scene.mjs";

const ids = () => {
  let n = 0;
  return () => `10000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
};
const polygon = (points) => ({ layer: "ROOM", points });
const rectangle = (x1, y1, x2, y2) =>
  polygon([
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 },
  ]);
const analysis = {
  unitsCode: 4,
  sha256: "a".repeat(64),
  segments: [
    {
      layer: "WALL",
      start: { x: 10, y: 20 },
      end: { x: 14.2, y: 20 },
    },
  ],
  closedPaths: [rectangle(10, 20, 14.2, 23)],
};
const options = {
  roomLayer: "ROOM",
  wallLayer: "WALL",
  mmPerUnit: 1000,
  sourceSha256: "a".repeat(64),
  wallThicknessMm: 200,
  floorHeightMm: 2800,
};

test("suggests units but requires explicit calibration for unitless drawings", () => {
  assert.equal(suggestMmPerUnit(4), 1);
  assert.equal(suggestMmPerUnit(5), 10);
  assert.equal(suggestMmPerUnit(6), 1000);
  assert.equal(suggestMmPerUnit(0), null);
  assert.equal(calibrateMmPerUnit(analysis.segments[0], 4200), 1000);
  assert.throws(() => calibrateMmPerUnit(analysis.segments[0], 0), /长度/);
});

test("builds millimeter SceneModel with normalized origin and selected wall layer", () => {
  const scene = buildDxfScene(analysis, { ...options, id: ids() });
  assert.equal(scene.schema_version, "1.0.0");
  assert.equal(scene.coordinate_system, "RH_Z_UP");
  assert.deepEqual(scene.rooms[0].boundary, [
    { x: 0, y: 0 },
    { x: 4200, y: 0 },
    { x: 4200, y: 3000 },
    { x: 0, y: 3000 },
  ]);
  assert.equal(scene.walls.length, 1);
  assert.deepEqual(scene.walls[0].end, { x: 4200, y: 0 });
  assert.equal(scene.walls[0].thickness_mm, 200);
  assert.equal(scene.floors[0].height_mm, 2800);
  assert.equal(scene.metadata.source_sha256, "a".repeat(64));
  assert.deepEqual(scene.doors, []);
});

test("derives and deduplicates shared room boundary walls", () => {
  const sample = {
    ...analysis,
    segments: [],
    closedPaths: [rectangle(0, 0, 4, 3), rectangle(4, 0, 8, 3)],
  };
  const scene = buildDxfScene(sample, {
    ...options,
    wallLayer: "",
    mmPerUnit: 1000,
    id: ids(),
  });
  assert.equal(scene.rooms.length, 2);
  assert.equal(scene.walls.length, 7);
});

test("rejects missing rooms, unconfirmed scale and intersecting boundaries", () => {
  const make = (sample, opts = options) =>
    buildDxfScene(sample, { ...opts, id: ids() });
  assert.throws(() => make({ ...analysis, closedPaths: [] }), /闭合房间/);
  assert.throws(() => make(analysis, { ...options, mmPerUnit: null }), /比例/);
  assert.throws(
    () =>
      make({
        ...analysis,
        closedPaths: [
          polygon([
            { x: 0, y: 0 },
            { x: 4, y: 4 },
            { x: 0, y: 4 },
            { x: 4, y: 0 },
          ]),
        ],
      }),
    /房间轮廓/,
  );
});

test("rejects room boundaries that touch another edge or exceed the UI geometry budget", () => {
  const make = (points) =>
    buildDxfScene(
      { ...analysis, closedPaths: [polygon(points)] },
      { ...options, id: ids() },
    );
  assert.throws(
    () =>
      make([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 2, y: 4 },
        { x: 2, y: 0 },
        { x: 0, y: 4 },
      ]),
    /房间轮廓/,
  );
  assert.throws(
    () =>
      make([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 2, y: 0 },
        { x: 0, y: 4 },
      ]),
    /房间轮廓/,
  );
  const many = Array.from({ length: 1001 }, (_, i) => ({
    x: Math.cos((i * 2 * Math.PI) / 1001) * 10,
    y: Math.sin((i * 2 * Math.PI) / 1001) * 10,
  }));
  assert.throws(() => make(many), /顶点过多/);
});
