import test from "node:test";
import assert from "node:assert/strict";
import {
  renderPosition,
  editFurniture,
  addFurniture,
  wallSegments,
  nearestWallGapMm,
} from "../public/scene-tools.mjs";
import * as sceneTools from "../public/scene-tools.mjs";
import { RoomRenderer } from "../public/renderer.mjs";
import * as THREE from "three";
test("RH_Z_UP millimetres map to right handed Y up metres", () =>
  assert.deepEqual(
    renderPosition({ x: 1000, y: 2000, z: 3000 }, 500),
    [1, 3.5, -2],
  ));
const fixture = {
  floors: [{ id: "floor", elevation_mm: 0 }],
  furniture_instances: [
    {
      id: "one",
      position: { x: 1000, y: 2000, z: 0 },
      rotation_deg: 0,
      width_mm: 2400,
      depth_mm: 950,
      height_mm: 850,
      metadata: { keep: "是" },
    },
  ],
};
test("removing one furniture instance preserves other objects and leaves the source unchanged", () => {
  const source = {
    ...fixture,
    metadata: { retained: true },
    furniture_instances: [
      ...fixture.furniture_instances,
      { id: "two", metadata: { name: "保留的家具" }, position: { x: 2, y: 3 } },
    ],
  };
  const snapshot = structuredClone(source);
  const removed = sceneTools.removeFurniture(source, "one");
  assert.deepEqual(source, snapshot);
  assert.deepEqual(removed.furniture_instances, [
    snapshot.furniture_instances[1],
  ]);
  assert.deepEqual(removed.floors, snapshot.floors);
  assert.deepEqual(removed.metadata, { retained: true });
  removed.furniture_instances[0].metadata.name = "新名称";
  assert.equal(source.furniture_instances[1].metadata.name, "保留的家具");
});
test("removing absent or empty furniture ids rejects without changing the scene", () => {
  const snapshot = structuredClone(fixture);
  for (const id of ["missing", "", null])
    assert.throws(() => sceneTools.removeFurniture(fixture, id), /找不到家具/);
  assert.deepEqual(fixture, snapshot);
});
test("dimension products retain sellable provenance and saved dimensions after catalogue edits", async () => {
  const product = {
    id: "dimension-product",
    name: "尺寸椅子",
    sellable: true,
    model_kind: "dimensions",
    asset_id: null,
    model: null,
    width_mm: 800,
    depth_mm: 700,
    height_mm: 900,
  };
  const source = {
    furniture_instances: [],
    rooms: [
      {
        id: "room",
        floor_id: "floor",
        boundary: [
          { x: 0, y: 0 },
          { x: 4000, y: 0 },
          { x: 4000, y: 4000 },
          { x: 0, y: 4000 },
        ],
      },
    ],
  };
  const item = addFurniture(source, product, "room", "dimension-instance")
    .furniture_instances[0];
  assert.equal(item.metadata.offline_catalog_only, false);
  assert.equal(item.metadata.model_kind, "dimensions");
  const renderer = Object.assign(Object.create(RoomRenderer.prototype), {
    catalog: new Map([[product.id, { ...product, width_mm: 1200 }]]),
    resources: [],
  });
  const model = await renderer.furnitureModel(item);
  const size = new THREE.Box3()
    .setFromObject(model)
    .getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - 0.8) < 1e-6);
  assert.ok(Math.abs(size.y - 0.9) < 1e-6);
  assert.ok(Math.abs(size.z - 0.7) < 1e-6);
  renderer.catalog.clear();
  const historical = await renderer.furnitureModel(item);
  assert.ok(Math.abs(new THREE.Box3().setFromObject(historical).min.y) < 1e-6);
  const disposed = [];
  for (const resource of renderer.resources)
    resource.addEventListener("dispose", () => disposed.push(resource));
  Object.assign(renderer, {
    renderSerial: 0,
    furniture: new Map(),
    content: new THREE.Group(),
    renderer: { domElement: { dataset: {} } },
    status: {},
    removeSelectionHelper() {},
    scheduleFrame() {},
  });
  renderer.clear();
  assert.equal(disposed.length, 4);
  assert.equal(renderer.resources.length, 0);
});
test("furniture edit validates finite bounds and retains metadata without source mutation", () => {
  const updated = editFurniture(fixture, "one", {
    x: 3000,
    y: 1000,
    rotation: 90,
  });
  assert.equal(updated.furniture_instances[0].position.x, 3000);
  assert.equal(fixture.furniture_instances[0].position.x, 1000);
  assert.equal(updated.furniture_instances[0].metadata.keep, "是");
});
test("invalid furniture edits reject NaN Infinity negative limits and missing id", () => {
  for (const x of [NaN, Infinity, -1e8])
    assert.throws(() =>
      editFurniture(fixture, "one", { x, y: 1000, rotation: 0 }),
    );
  assert.throws(() =>
    editFurniture(fixture, "missing", { x: 0, y: 0, rotation: 0 }),
  );
});
test("furniture movement and rotation stay in its room without overlapping another item", () => {
  const scene = {
    rooms: [
      {
        id: "room",
        floor_id: "floor",
        boundary: [
          { x: 0, y: 0 },
          { x: 4000, y: 0 },
          { x: 4000, y: 4000 },
          { x: 0, y: 4000 },
        ],
      },
    ],
    furniture_instances: [
      {
        id: "one",
        room_id: "room",
        position: { x: 1000, y: 1000, z: 0 },
        width_mm: 800,
        depth_mm: 800,
        rotation_deg: 0,
      },
      {
        id: "two",
        room_id: "room",
        position: { x: 3000, y: 3000, z: 0 },
        width_mm: 800,
        depth_mm: 800,
        rotation_deg: 0,
      },
    ],
  };
  assert.throws(
    () => editFurniture(scene, "one", { x: 3700, y: 1000, rotation: 0 }),
    /房间/,
  );
  assert.throws(
    () => editFurniture(scene, "one", { x: 3000, y: 3000, rotation: 0 }),
    /碰撞/,
  );
  assert.throws(
    () => editFurniture(scene, "one", { x: 500, y: 500, rotation: 45 }),
    /房间/,
  );
  const moved = editFurniture(scene, "one", { x: 2000, y: 1000, rotation: 45 });
  assert.equal(moved.furniture_instances[0].rotation_deg, 45);
  assert.equal(scene.furniture_instances[0].rotation_deg, 0);
  assert.equal(Math.round(nearestWallGapMm(moved, "one")), 434);
});
test("catalog furniture enters a selected room with valid scene fields without changing the source", () => {
  const scene = {
    ...fixture,
    rooms: [
      {
        id: "room",
        floor_id: "floor",
        boundary: [
          { x: 0, y: 0 },
          { x: 4000, y: 0 },
          { x: 4000, y: 4000 },
          { x: 0, y: 4000 },
        ],
      },
    ],
  };
  const chair = {
    id: "40000000-0000-4000-8000-000000000003",
    name: "真实织物椅",
    width_mm: 800,
    depth_mm: 800,
    height_mm: 900,
  };
  const copy = addFurniture(
    scene,
    chair,
    "room",
    "40000000-0000-4000-8000-000000000101",
  );
  assert.equal(scene.furniture_instances.length, 1);
  assert.equal(copy.furniture_instances.length, 2);
  assert.deepEqual(copy.furniture_instances[1].position, {
    x: 2000,
    y: 2000,
    z: 0,
  });
  assert.equal(copy.furniture_instances[1].product_id, chair.id);
  assert.equal(copy.furniture_instances[1].floor_id, "floor");
  assert.equal(copy.furniture_instances[1].metadata.name, chair.name);
  const occupied = structuredClone(scene);
  occupied.furniture_instances[0].room_id = "room";
  const placed = addFurniture(
    occupied,
    chair,
    "room",
    "40000000-0000-4000-8000-000000000102",
  );
  const position = placed.furniture_instances[1].position;
  assert.ok(position.x >= chair.width_mm / 2);
  assert.ok(position.x <= 4000 - chair.width_mm / 2);
  assert.ok(position.y >= chair.depth_mm / 2);
  assert.ok(position.y <= 4000 - chair.depth_mm / 2);
  assert.ok(
    Math.abs(position.x - 1000) >= (2400 + chair.width_mm) / 2 + 100 ||
      Math.abs(position.y - 2000) >= (950 + chair.depth_mm) / 2 + 100,
  );
  assert.throws(() => addFurniture(scene, chair, "other", "id"));
});

test("repeated large furniture stays inside a small room and rejects when no floor space remains", () => {
  let scene = {
    furniture_instances: [],
    rooms: [
      {
        id: "bedroom",
        floor_id: "floor",
        boundary: [
          { x: 0, y: 4000 },
          { x: 4000, y: 4000 },
          { x: 4000, y: 8000 },
          { x: 0, y: 8000 },
        ],
      },
    ],
  };
  const sofa = {
    id: "40000000-0000-4000-8000-000000000004",
    name: "丝绒沙发",
    width_mm: 2200,
    depth_mm: 900,
    height_mm: 820,
  };
  let added = 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    let candidate;
    try {
      candidate = addFurniture(scene, sofa, "bedroom", `item-${attempt}`);
    } catch (error) {
      assert.match(error.message, /没有足够空间/);
      assert.equal(scene.furniture_instances.length, added);
      assert.ok(added > 0);
      return;
    }
    scene = candidate;
    added++;
    const item = scene.furniture_instances.at(-1);
    assert.ok(item.position.x - item.width_mm / 2 >= 0);
    assert.ok(item.position.x + item.width_mm / 2 <= 4000);
    assert.ok(item.position.y - item.depth_mm / 2 >= 4000);
    assert.ok(item.position.y + item.depth_mm / 2 <= 8000);
    for (const earlier of scene.furniture_instances.slice(0, -1)) {
      const xOverlap =
        Math.abs(item.position.x - earlier.position.x) <
        (item.width_mm + earlier.width_mm) / 2 + 100;
      const yOverlap =
        Math.abs(item.position.y - earlier.position.y) <
        (item.depth_mm + earlier.depth_mm) / 2 + 100;
      assert.ok(
        !(xOverlap && yOverlap),
        "furniture footprints must not overlap",
      );
    }
  }
  assert.fail("a small bedroom cannot hold twenty velvet sofas");
});

test("a second living-room chair is placed beside the sofa instead of hidden behind it", () => {
  const scene = {
    rooms: [
      {
        id: "living",
        floor_id: "floor",
        boundary: [
          { x: 0, y: 0 },
          { x: 8000, y: 0 },
          { x: 8000, y: 4000 },
          { x: 0, y: 4000 },
        ],
      },
    ],
    furniture_instances: [
      {
        id: "sofa",
        room_id: "living",
        position: { x: 4000, y: 2000, z: 0 },
        width_mm: 2400,
        depth_mm: 950,
        rotation_deg: 90,
      },
    ],
  };
  const chair = {
    id: "40000000-0000-4000-8000-000000000003",
    name: "椅子",
    width_mm: 800,
    depth_mm: 800,
    height_mm: 900,
  };
  const placed = addFurniture(
    scene,
    chair,
    "living",
    "new-chair",
  ).furniture_instances.at(-1);
  assert.ok(placed.position.x < 3200);
  assert.ok(placed.position.y < 1200);
});
test("wall openings create header sill and side segments instead of sealed wall", () => {
  const segments = wallSegments(
    {
      id: "wall",
      start: { x: 0, y: 0 },
      end: { x: 4000, y: 0 },
      height_mm: 2800,
    },
    [
      {
        wall_id: "wall",
        offset_mm: 1000,
        width_mm: 1000,
        height_mm: 1200,
        sill_height_mm: 900,
      },
    ],
  );
  assert.equal(segments.length, 4);
  assert.ok(segments.some((x) => x.start === 1000 && x.bottom === 2100));
  assert.ok(segments.some((x) => x.start === 1000 && x.top === 900));
  assert.ok(
    !segments.some(
      (x) => x.start < 2000 && x.end > 1000 && x.bottom < 2100 && x.top > 900,
    ),
  );
});
