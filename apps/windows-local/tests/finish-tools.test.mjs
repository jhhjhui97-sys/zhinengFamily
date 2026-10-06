import test from "node:test";
import assert from "node:assert/strict";
import { Matrix3, Vector2 } from "three";
import { finishOptions, normalizeFinish } from "../public/finish-catalog.mjs";
import {
  setSurfaceFinish,
  clearSurfaceFinish,
  finishForSurface,
  roomWalls,
  wallFinishSides,
  missingRoomWallEdges,
  finishRenderSpec,
  finishTextureData,
  sampleFinishPixel,
} from "../public/finish-tools.mjs";

function scene() {
  return {
    metadata: { customer_note: "保留" },
    rooms: [
      {
        id: "a",
        floor_id: "f",
        name: "南房间",
        boundary: [
          { x: 0, y: 0 },
          { x: 4000, y: 0 },
          { x: 4000, y: 3000 },
          { x: 0, y: 3000 },
        ],
        metadata: { source_layer: "ROOM" },
      },
      {
        id: "b",
        floor_id: "f",
        name: "北房间",
        boundary: [
          { x: 0, y: 3000 },
          { x: 4000, y: 3000 },
          { x: 4000, y: 6000 },
          { x: 0, y: 6000 },
        ],
        metadata: {},
      },
    ],
    walls: [
      {
        id: "south",
        floor_id: "f",
        start: { x: 0, y: 0 },
        end: { x: 4000, y: 0 },
        thickness_mm: 200,
      },
      {
        id: "shared",
        floor_id: "f",
        start: { x: 0, y: 3000 },
        end: { x: 4000, y: 3000 },
        thickness_mm: 200,
      },
      {
        id: "north",
        floor_id: "f",
        start: { x: 0, y: 6000 },
        end: { x: 4000, y: 6000 },
        thickness_mm: 200,
      },
      {
        id: "upstairs",
        floor_id: "other",
        start: { x: 0, y: 0 },
        end: { x: 4000, y: 0 },
        thickness_mm: 200,
      },
      {
        id: "unrelated",
        floor_id: "f",
        start: { x: 8000, y: 0 },
        end: { x: 8000, y: 3000 },
        thickness_mm: 200,
      },
    ],
    furniture_instances: [
      { id: "chair", position: { x: 1000, y: 1000, z: 0 } },
    ],
  };
}

test("floor finish saves a complete custom recipe without changing another room or geometry", () => {
  const original = scene();
  const before = JSON.stringify(original);
  const updated = setSurfaceFinish(
    original,
    { roomId: "a", surface: "floor" },
    {
      preset_id: "custom-floor",
      name: "客户石英地面",
      category: "客户特殊工艺",
      pattern: "stone",
      color: "#ABCDEF",
      width_mm: 800,
      height_mm: 400,
      layout: "staggered",
      grout_mm: 3,
      angle_deg: 30,
      thickness_mm: 12,
      substrate: "水泥砂浆找平",
      process_note: "客户指定做法",
      layers: [{ name: "找平层", thickness_mm: 25, note: "现场确认" }],
    },
  );
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(updated.rooms[1], original.rooms[1]);
  assert.deepEqual(updated.walls, original.walls);
  assert.deepEqual(updated.furniture_instances, original.furniture_instances);
  assert.equal(updated.rooms[0].metadata.source_layer, "ROOM");
  const saved = JSON.parse(JSON.stringify(updated));
  const finish = finishForSurface(saved, { roomId: "a", surface: "floor" });
  assert.equal(finish.name, "客户石英地面");
  assert.equal(finish.color, "#abcdef");
  assert.equal(finish.width_mm, 800);
  assert.equal(finish.process_note, "客户指定做法");
  assert.deepEqual(finish.layers, [
    { name: "找平层", thickness_mm: 25, note: "现场确认" },
  ]);
  assert.equal(
    finishForSurface(saved, { roomId: "b", surface: "floor" }),
    null,
  );
});

test("a wall override affects only the chosen room side and clearing returns its room recipe", () => {
  let document = setSurfaceFinish(
    scene(),
    { roomId: "a", surface: "wall" },
    { preset_id: "wall-paint", color: "#112233" },
  );
  document = setSurfaceFinish(
    document,
    { roomId: "b", surface: "wall" },
    { preset_id: "wall-wallpaper", color: "#665544" },
  );
  document = setSurfaceFinish(
    document,
    { roomId: "a", surface: "wall", wallId: "shared" },
    { preset_id: "wall-wood-panel", color: "#887766" },
  );
  const restored = JSON.parse(JSON.stringify(document));
  assert.equal(
    finishForSurface(restored, {
      roomId: "a",
      surface: "wall",
      wallId: "south",
    }).color,
    "#112233",
  );
  const sides = wallFinishSides(restored, "shared");
  assert.equal(sides.left.roomId, "b");
  assert.equal(sides.left.finish.color, "#665544");
  assert.equal(sides.right.roomId, "a");
  assert.equal(sides.right.finish.color, "#887766");
  document = clearSurfaceFinish(document, {
    roomId: "a",
    surface: "wall",
    wallId: "shared",
  });
  assert.equal(
    wallFinishSides(document, "shared").right.finish.color,
    "#112233",
  );
  document = clearSurfaceFinish(document, { roomId: "a", surface: "wall" });
  assert.equal(wallFinishSides(document, "shared").right.finish, null);
  assert.equal(
    wallFinishSides(document, "shared").left.finish.color,
    "#665544",
  );
});

test("wall selection uses collinear room edges, allows a half-thickness offset and rejects foreign walls", () => {
  const document = scene();
  document.walls[0].start.y = document.walls[0].end.y = -100;
  assert.deepEqual(
    roomWalls(document, "a").map((wall) => wall.id),
    ["south", "shared"],
  );
  const before = JSON.stringify(document);
  assert.throws(
    () =>
      setSurfaceFinish(
        document,
        { roomId: "a", surface: "wall", wallId: "north" },
        { preset_id: "wall-paint" },
      ),
    /墙/,
  );
  assert.throws(
    () =>
      setSurfaceFinish(
        document,
        { roomId: "a", surface: "floor", wallId: "south" },
        { preset_id: "floor-porcelain" },
      ),
    /地面/,
  );
  assert.equal(JSON.stringify(document), before);
});

test("reversing the shared wall reverses its left and right room materials", () => {
  let document = setSurfaceFinish(
    scene(),
    { roomId: "a", surface: "wall" },
    { preset_id: "wall-paint" },
  );
  document = setSurfaceFinish(
    document,
    { roomId: "b", surface: "wall" },
    { preset_id: "wall-stone" },
  );
  [document.walls[1].start, document.walls[1].end] = [
    document.walls[1].end,
    document.walls[1].start,
  ];
  assert.equal(wallFinishSides(document, "shared").left.roomId, "a");
  assert.equal(wallFinishSides(document, "shared").right.roomId, "b");
});

test("malformed recipes are rejected before a scene is mutated", () => {
  const invalid = [
    { width_mm: 0 },
    { width_mm: Infinity },
    { grout_mm: -1 },
    { grout_mm: 600 },
    { color: "url(https://example.com)" },
    { roughness: 2 },
    { metalness: NaN },
    { opacity: -1 },
    { pattern: "unknown" },
    { layout: "unknown" },
    { layers: [{ name: "", thickness_mm: 20 }] },
    { layers: [{ name: "找平", thickness_mm: -20 }] },
  ];
  for (const value of invalid) {
    const document = scene(),
      before = JSON.stringify(document);
    assert.throws(() =>
      setSurfaceFinish(
        document,
        { roomId: "a", surface: "floor" },
        { preset_id: "floor-porcelain", ...value },
      ),
    );
    assert.equal(JSON.stringify(document), before);
  }
  assert.throws(
    () => normalizeFinish({ preset_id: "wall-paint" }, "floor"),
    /地面|类型/,
  );
});

test("catalog selection provides independent editable recipes for both surfaces", () => {
  const floor = finishOptions("floor");
  const wall = finishOptions("wall");
  assert.ok(floor.some((value) => value.id === "custom-floor"));
  assert.ok(wall.some((value) => value.id === "custom-wall"));
  const recipe = normalizeFinish({ preset_id: "floor-porcelain" }, "floor");
  floor.find((value) => value.id === "floor-porcelain").color = "#000000";
  assert.equal(
    normalizeFinish({ preset_id: "floor-porcelain" }, "floor").color,
    recipe.color,
  );
  assert.equal(
    finishRenderSpec(normalizeFinish({ preset_id: "wall-metal" }, "wall"))
      .metalness,
    0.9,
  );
  assert.equal(
    finishRenderSpec(normalizeFinish({ preset_id: "wall-glass" }, "wall"))
      .roughness,
    0.08,
  );
});

test("tile grout and staggered rows are rendered at their actual millimetre positions", () => {
  const straight = normalizeFinish(
    {
      preset_id: "floor-porcelain",
      color: "#f0e0d0",
      grout_color: "#102030",
      width_mm: 600,
      height_mm: 300,
      grout_mm: 4,
      layout: "straight",
    },
    "floor",
  );
  const staggered = normalizeFinish(
    { ...straight, layout: "staggered" },
    "floor",
  );
  assert.deepEqual(sampleFinishPixel(straight, 1, 450), [16, 32, 48, 255]);
  assert.notDeepEqual(sampleFinishPixel(straight, 300, 150), [16, 32, 48, 255]);
  assert.notDeepEqual(sampleFinishPixel(staggered, 1, 450), [16, 32, 48, 255]);
  assert.deepEqual(sampleFinishPixel(staggered, 301, 450), [16, 32, 48, 255]);
});

test("specification, direction, seam width and laying pattern change real texture pixels", () => {
  const recipe = normalizeFinish(
    {
      preset_id: "floor-porcelain",
      color: "#f0e0d0",
      grout_color: "#102030",
      width_mm: 600,
      height_mm: 400,
      grout_mm: 4,
      layout: "straight",
    },
    "floor",
  );
  assert.deepEqual(sampleFinishPixel(recipe, 601, 150), [16, 32, 48, 255]);
  assert.notDeepEqual(
    sampleFinishPixel({ ...recipe, angle_deg: 90 }, 601, 150),
    [16, 32, 48, 255],
  );
  assert.notDeepEqual(
    sampleFinishPixel({ ...recipe, width_mm: 800 }, 601, 150),
    [16, 32, 48, 255],
  );
  assert.deepEqual(
    sampleFinishPixel({ ...recipe, grout_mm: 20 }, 606, 150),
    [16, 32, 48, 255],
  );
  const data = finishTextureData(recipe, 48);
  assert.notDeepEqual(
    finishTextureData({ ...recipe, layout: "herringbone" }, 48).data,
    data.data,
  );
  assert.notDeepEqual(
    finishTextureData({ ...recipe, layout: "checkerboard" }, 48).data,
    data.data,
  );
});

test("procedural textures have bounded RGBA buffers and distinct visual families", () => {
  const outputs = [
    "floor-porcelain",
    "floor-wood",
    "floor-terrazzo",
    "floor-carpet",
    "wall-wallpaper",
    "wall-brick",
  ].map((id) => {
    const finish = normalizeFinish(
      { preset_id: id },
      id.startsWith("wall") ? "wall" : "floor",
    );
    const output = finishTextureData(finish, 32);
    assert.ok(output.data instanceof Uint8Array);
    assert.equal(output.data.byteLength, 32 * 32 * 4);
    assert.equal(output.width, 32);
    assert.equal(output.height, 32);
    assert.ok(output.repeat_width_mm > 0 && output.repeat_height_mm > 0);
    return output.data;
  });
  for (let index = 1; index < outputs.length; index++)
    assert.notDeepEqual(outputs[0], outputs[index]);
  assert.throws(() =>
    finishTextureData(
      normalizeFinish({ preset_id: "floor-porcelain" }, "floor"),
      8192,
    ),
  );
});

test("herringbone planks meet at right angles with the selected full length and short width", () => {
  const finish = normalizeFinish(
    {
      preset_id: "floor-herringbone",
      grout_color: "#102030",
      width_mm: 600,
      height_mm: 150,
      grout_mm: 4,
    },
    "floor",
  );
  const point = (x, y) =>
    sampleFinishPixel(finish, (x - y) / Math.SQRT2, (x + y) / Math.SQRT2);
  assert.deepEqual(point(300, 1), [16, 32, 48, 255]);
  assert.notDeepEqual(point(300, 75), [16, 32, 48, 255]);
  assert.deepEqual(point(599, 75), [16, 32, 48, 255]);
  assert.notDeepEqual(point(525, 450), [16, 32, 48, 255]);
  assert.deepEqual(point(451, 450), [16, 32, 48, 255]);
});

test("texture opacity is applied once by the rendering material", () => {
  const finish = normalizeFinish(
    { preset_id: "wall-glass", opacity: 0.5 },
    "wall",
  );
  const spec = finishRenderSpec(finish);
  assert.equal(spec.opacity, 0.5);
  assert.equal(spec.transparent, true);
  assert.equal(spec.texture.data[3], 255);
});

test("missing-wall preview returns full room edges when no physical wall exists", () => {
  const document = scene();
  document.walls = [];
  assert.deepEqual(missingRoomWallEdges(document, "a"), [
    { start: { x: 0, y: 0 }, end: { x: 4000, y: 0 } },
    { start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 } },
    { start: { x: 4000, y: 3000 }, end: { x: 0, y: 3000 } },
    { start: { x: 0, y: 3000 }, end: { x: 0, y: 0 } },
  ]);
});

test("physical walls cover an entire room outline including their door and window openings", () => {
  const document = scene();
  document.walls.push(
    {
      id: "east",
      floor_id: "f",
      start: { x: 4000, y: 0 },
      end: { x: 4000, y: 3000 },
      thickness_mm: 200,
    },
    {
      id: "west",
      floor_id: "f",
      start: { x: 0, y: 3000 },
      end: { x: 0, y: 0 },
      thickness_mm: 200,
    },
  );
  document.doors = [{ wall_id: "south", offset_mm: 1000, width_mm: 800 }];
  document.windows = [{ wall_id: "shared", offset_mm: 1000, width_mm: 1200 }];
  assert.deepEqual(missingRoomWallEdges(document, "a"), []);
});

test("non-square rotated tiles preserve their real period without image-boundary seams", () => {
  const finish = normalizeFinish(
    {
      preset_id: "floor-porcelain",
      width_mm: 600,
      height_mm: 400,
      color: "#f0e0d0",
      grout_color: "#102030",
      grout_mm: 4,
      angle_deg: 90,
    },
    "floor",
  );
  const pixels = finishTextureData(finish, 120);
  assert.equal(pixels.angle_deg, 90);
  assert.deepEqual(
    pixels.data,
    finishTextureData({ ...finish, angle_deg: 0 }, 120).data,
  );
  const matrix = new Matrix3().setUvTransform(
    0,
    0,
    1000 / pixels.repeat_width_mm,
    1000 / pixels.repeat_height_mm,
    Math.PI / 2,
    0,
    0,
  );
  const at = (xMm, yMm) => {
    const uv = new Vector2(xMm / 1000, yMm / 1000).applyMatrix3(matrix);
    const wrap = (value) => ((value % 1) + 1) % 1;
    const x = Math.round(wrap(uv.x) * pixels.width) % pixels.width;
    const y = Math.round(wrap(uv.y) * pixels.height) % pixels.height;
    return [
      ...pixels.data.slice(
        (y * pixels.width + x) * 4,
        (y * pixels.width + x) * 4 + 4,
      ),
    ];
  };
  assert.deepEqual(at(400, 100), [16, 32, 48, 255]);
  assert.notDeepEqual(at(600, 100), [16, 32, 48, 255]);
  assert.deepEqual(at(800, 100), [16, 32, 48, 255]);
});

test("partial physical walls only leave their uncovered boundary portions in the preview", () => {
  const document = scene();
  document.walls[0].start = { x: 1000, y: -100 };
  document.walls[0].end = { x: 2500, y: -100 };
  const segments = missingRoomWallEdges(document, "a");
  assert.deepEqual(
    segments.filter((segment) => segment.start.y === 0 && segment.end.y === 0),
    [
      { start: { x: 0, y: 0 }, end: { x: 1000, y: 0 } },
      { start: { x: 2500, y: 0 }, end: { x: 4000, y: 0 } },
    ],
  );
  assert.equal(segments.length, 4);
  assert.ok(
    !segments.some(
      (segment) => segment.start.y === 3000 && segment.end.y === 3000,
    ),
  );
});
