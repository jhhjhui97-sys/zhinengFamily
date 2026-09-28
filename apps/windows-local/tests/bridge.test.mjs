import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
const root = resolve(import.meta.dirname, "../../..");
const bridge = join(root, ".local/windows-bridge/LocalBridge.exe");
const assets = join(root, "apps/unity-client/Assets/StreamingAssets");
function workspace(withCatalog = false) {
  const db = join(
    mkdtempSync(join(tmpdir(), "family-bridge-")),
    "local.sqlite",
  );
  return (input) => {
    const result = spawnSync(
      bridge,
      [
        db,
        join(assets, "scene.schema.json"),
        join(assets, "two-bedroom.json"),
        ...(withCatalog
          ? [join(root, "apps/windows-local/public/catalog.json")]
          : []),
      ],
      { input: JSON.stringify(input), encoding: "utf8", timeout: 10000 },
    );
    assert.equal(
      result.status,
      0,
      `bridge should execute: ${result.error?.code ?? result.stderr}`,
    );
    return JSON.parse(result.stdout.replace(/^\uFEFF/, ""));
  };
}
test("bundled catalog registers only curated products for local scene saves", () => {
  const w = workspace(true);
  const products = w({ action: "catalog" });
  assert.equal(products.status, 200);
  assert.equal(products.data.length, 4);
  const chair = products.data.find((p) => p.category === "chair");
  assert.ok(chair);
  const { id, scene } = sample(w);
  scene.furniture_instances.push({
    ...structuredClone(scene.furniture_instances[0]),
    id: "40000000-0000-4000-8000-000000000101",
    product_id: chair.id,
    width_mm: chair.width_mm,
    depth_mm: chair.depth_mm,
    height_mm: chair.height_mm,
    metadata: { name: chair.name },
  });
  assert.equal(w({ action: "save", id, base_revision: 0, scene }).status, 200);
  scene.furniture_instances[1].product_id =
    "99999999-0000-4000-8000-000000000001";
  assert.equal(w({ action: "save", id, base_revision: 1, scene }).status, 422);
});
function sample(w) {
  const created = w({ action: "create", name: "张先生 / 龙湖小区" });
  assert.equal(created.status, 200);
  const id = created.data.id;
  const scene = w({ action: "sample", id }).data.scene;
  return { id, scene };
}
test("create and sample use real local catalog and three rooms", () => {
  const w = workspace();
  const { id, scene } = sample(w);
  assert.equal(scene.scene_id, id);
  assert.equal(scene.rooms.length, 3);
  assert.equal(w({ action: "list" }).data.total, 1);
});
test("save v1 v2 restore v1 creates immutable v3 and survives process restart", () => {
  const w = workspace();
  const { id, scene } = sample(w);
  assert.equal(
    w({ action: "save", id, base_revision: 0, scene }).data.revision,
    1,
  );
  scene.rooms[0].name = "修改后的客厅";
  assert.equal(
    w({ action: "save", id, base_revision: 1, scene }).data.revision,
    2,
  );
  const restored = w({ action: "restore", id, base_revision: 2, revision: 1 });
  assert.equal(restored.data.revision, 3);
  assert.equal(restored.data.scene.rooms[0].name, "客厅");
  assert.deepEqual(
    w({ action: "versions", id }).data.map((v) => v.revision),
    [3, 2, 1],
  );
  assert.equal(w({ action: "current", id }).data.revision, 3);
});
test("stale base returns409 and retains saved contents", () => {
  const w = workspace();
  const { id, scene } = sample(w);
  w({ action: "save", id, base_revision: 0, scene });
  scene.rooms[0].name = "不能覆盖";
  assert.equal(w({ action: "save", id, base_revision: 0, scene }).status, 409);
  assert.equal(w({ action: "current", id }).data.scene.rooms[0].name, "客厅");
});
test("invalid SceneModel is rejected and no partial version written", () => {
  const w = workspace();
  const { id } = sample(w);
  assert.equal(
    w({ action: "save", id, base_revision: 0, scene: {} }).status,
    422,
  );
  assert.equal(w({ action: "current", id }).data, null);
  assert.equal(w({ action: "versions", id }).data.length, 0);
});
test("unregistered product cannot be saved", () => {
  const w = workspace();
  const { id, scene } = sample(w);
  scene.furniture_instances[0].product_id =
    "99999999-0000-4000-8000-000000000001";
  assert.equal(w({ action: "save", id, base_revision: 0, scene }).status, 422);
});
test("missing scene and version return404 without database details", () => {
  const w = workspace();
  const result = w({
    action: "current",
    id: "99999999-0000-4000-8000-000000000001",
  });
  assert.equal(result.status, 404);
  assert.doesNotMatch(JSON.stringify(result), /SQLite|Exception|SELECT/);
});
test("unknown action and client identity fields rejected", () => {
  const w = workspace();
  assert.equal(w({ action: "delete" }).status, 422);
  assert.equal(
    w({ action: "create", name: "测试", workspace_id: "other" }).status,
    422,
  );
});
