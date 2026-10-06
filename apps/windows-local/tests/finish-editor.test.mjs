import test from "node:test";
import assert from "node:assert/strict";
import { mountFinishEditor } from "../public/finish-editor.mjs";

function fixture(t, initialScene) {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) {
      const select = [
        "finish-room",
        "finish-surface",
        "finish-wall",
        "finish-preset",
        "finish-pattern",
        "finish-layout",
      ].includes(id);
      let value = "";
      const element = {
        children: [],
        hidden: false,
        get value() {
          return value;
        },
        set value(next) {
          value =
            select && !this.children.some((item) => item.value === String(next))
              ? ""
              : String(next);
        },
        append(...items) {
          this.children.push(...items);
          if (select && !value) value = this.children[0]?.value ?? "";
        },
        replaceChildren() {
          this.children = [];
          if (select) value = "";
        },
      };
      if (id === "finish-surface")
        element.append(
          ...["floor", "wall", "single"].map((value) => ({ value })),
        );
      elements.set(id, element);
    }
    return elements.get(id);
  };
  const old = globalThis.document;
  globalThis.document = { getElementById: get, createElement: () => ({}) };
  t.after(() => (globalThis.document = old));
  const oldConfirm = globalThis.confirm;
  let accepted = true;
  globalThis.confirm = () => accepted;
  t.after(() => (globalThis.confirm = oldConfirm));
  let scene = initialScene ?? {
    scene_id: "one",
    rooms: [
      {
        id: "r",
        name: "客厅",
        floor_id: "f",
        boundary: [
          { x: 0, y: 0 },
          { x: 4000, y: 0 },
          { x: 4000, y: 4000 },
          { x: 0, y: 4000 },
        ],
        metadata: {},
      },
    ],
    walls: [],
  };
  let reject = false,
    editable = true,
    notice = "",
    changes = 0;
  const editor = mountFinishEditor({
    getScene: () => scene,
    canEdit: () => editable,
    apply: async (candidate) => {
      if (reject) throw Error("校验失败");
      scene = candidate;
    },
    notify: (message) => (notice = message),
    onPending: () => changes++,
    run: async (fn) => {
      try {
        await fn();
      } catch (error) {
        notice = error.message;
      }
    },
  });
  editor.refresh();
  return {
    get,
    editor,
    scene: () => scene,
    notice: () => notice,
    changes: () => changes,
    reject: () => (reject = true),
    replaceScene: (value) => (scene = value),
    confirm: (value) => (accepted = value),
    editable: (value) => (editable = value),
  };
}
test("finish editor applies colour, physical sizes and craft records as a draft", async (t) => {
  const ui = fixture(t);
  ui.get("finish-color").value = "#bb4422";
  ui.get("finish-color").oninput();
  ui.get("finish-width").value = "800";
  ui.get("finish-layers").value = "找平层|20|水泥砂浆\n饰面|10|瓷砖";
  assert.equal(ui.editor.pending(), true);
  await ui.get("finish-apply").onclick();
  const record = ui.scene().rooms[0].metadata.surface_finishes.floor;
  assert.equal(record.color, "#bb4422");
  assert.equal(record.width_mm, 800);
  assert.deepEqual(record.layers, [
    { name: "找平层", thickness_mm: 20, note: "水泥砂浆" },
    { name: "饰面", thickness_mm: 10, note: "瓷砖" },
  ]);
  assert.equal(ui.editor.pending(), false);
  assert.match(ui.notice(), /保存新版本/);
});
test("finish editor validation failures preserve inputs and scene", async (t) => {
  const ui = fixture(t),
    before = structuredClone(ui.scene());
  ui.get("finish-layers").value = "错误层|不是数字|";
  ui.get("finish-layers").oninput();
  await ui.get("finish-apply").onclick();
  assert.deepEqual(ui.scene(), before);
  assert.equal(ui.editor.pending(), true);
  assert.match(ui.notice(), /厚度/);
  ui.get("finish-layers").value = "饰面|2|";
  ui.reject();
  await ui.get("finish-apply").onclick();
  assert.equal(ui.editor.pending(), true);
  assert.equal(ui.get("finish-layers").value, "饰面|2|");
  assert.deepEqual(ui.scene(), before);
});
test("refresh preserves pending finishes and clear returns selected surface to default", async (t) => {
  const ui = fixture(t);
  ui.get("finish-color").value = "#123456";
  ui.get("finish-color").oninput();
  ui.editor.refresh();
  assert.equal(ui.get("finish-color").value, "#123456");
  await ui.get("finish-apply").onclick();
  await ui.get("finish-clear").onclick();
  assert.equal(ui.scene().rooms[0].metadata.surface_finishes, undefined);
});

test("choosing a preset stays pending until it is applied or discarded", async (t) => {
  const ui = fixture(t);
  ui.get("finish-preset").value = "floor-wood";
  ui.get("finish-preset").onchange();
  assert.equal(ui.editor.pending(), true);
  assert.equal(ui.get("finish-width").value, "1200");
  ui.editor.refresh();
  assert.equal(ui.get("finish-preset").value, "floor-wood");
  ui.get("finish-discard").onclick();
  assert.equal(ui.get("finish-preset").value, "floor-porcelain");
  assert.equal(ui.editor.pending(), false);
});

test("editing a saved recipe hydrates and preserves metallic and transparent properties", async (t) => {
  const ui = fixture(t);
  const value = {
    preset_id: "floor-porcelain",
    name: "客户指定饰面",
    category: "定制",
    pattern: "stone",
    color: "#abcdef",
    accent_color: "#654321",
    grout_color: "#102030",
    roughness: 0.23,
    metalness: 0.81,
    opacity: 0.37,
    layout: "staggered",
    width_mm: 800,
    height_mm: 400,
    angle_deg: 27,
    grout_mm: 2,
    thickness_mm: 12,
    substrate: "原基层",
    process_note: "特殊工艺记录",
    layers: [{ name: "基层", thickness_mm: 20, note: "现场备注|附加\n文字" }],
  };
  const stored = structuredClone(ui.scene());
  stored.rooms[0].metadata.surface_finishes = { version: 1, floor: value };
  ui.replaceScene(stored);
  ui.editor.refresh({ force: true });
  assert.equal(ui.get("finish-metalness").value, "0.81");
  assert.equal(ui.get("finish-opacity").value, "0.37");
  assert.equal(ui.get("finish-category").value, "定制");
  assert.equal(ui.get("finish-note").value, "特殊工艺记录");
  ui.get("finish-color").value = "#123456";
  await ui.get("finish-apply").onclick();
  const saved = ui.scene().rooms[0].metadata.surface_finishes.floor;
  assert.equal(saved.color, "#123456");
  assert.equal(saved.metalness, 0.81);
  assert.equal(saved.opacity, 0.37);
  assert.deepEqual(saved.layers, [
    { name: "基层", thickness_mm: 20, note: "现场备注|附加\n文字" },
  ]);
});

test("empty numeric values are rejected without replacing valid scene data", async (t) => {
  const ui = fixture(t),
    before = structuredClone(ui.scene());
  for (const name of [
    "angle",
    "grout",
    "roughness",
    "metalness",
    "opacity",
    "thickness",
  ]) {
    const previous = ui.get(`finish-${name}`).value;
    ui.get(`finish-${name}`).value = " ";
    await ui.get("finish-apply").onclick();
    assert.deepEqual(ui.scene(), before, name);
    assert.equal(ui.get(`finish-${name}`).value, " ");
    assert.equal(ui.editor.pending(), true);
    assert.match(ui.notice(), /填写|数字|数值/);
    ui.get(`finish-${name}`).value = previous;
  }
});

test("refreshing the options preserves the chosen room and saved recipe", async (t) => {
  const ui = fixture(t),
    document = structuredClone(ui.scene());
  document.rooms.push({
    ...structuredClone(document.rooms[0]),
    id: "second",
    name: "卧室",
    metadata: {
      surface_finishes: {
        version: 1,
        floor: { preset_id: "floor-wood", color: "#887766" },
      },
    },
  });
  ui.replaceScene(document);
  ui.editor.refresh({ force: true });
  ui.get("finish-room").value = "second";
  ui.get("finish-room").onchange();
  assert.equal(ui.get("finish-room").value, "second");
  assert.equal(ui.get("finish-color").value, "#887766");
  ui.editor.refresh();
  assert.equal(ui.get("finish-room").value, "second");
});

test("canceling target changes restores selection and unapplied form inputs", async (t) => {
  const ui = fixture(t);
  ui.get("finish-color").value = "#123456";
  ui.confirm(false);
  ui.get("finish-surface").value = "wall";
  ui.get("finish-surface").onchange();
  assert.equal(ui.get("finish-surface").value, "floor");
  assert.equal(ui.get("finish-color").value, "#123456");
  assert.equal(ui.editor.pending(), true);
});

test("forced replacement clears pending inputs and hydrates the adopted scene", async (t) => {
  const ui = fixture(t);
  ui.get("finish-color").value = "#123456";
  const other = structuredClone(ui.scene());
  other.scene_id = "two";
  other.rooms[0].id = "replacement";
  other.rooms[0].metadata = {
    surface_finishes: {
      version: 1,
      floor: { preset_id: "floor-carpet", color: "#445566" },
    },
  };
  ui.replaceScene(other);
  ui.editor.refresh({ force: true });
  assert.equal(ui.get("finish-room").value, "replacement");
  assert.equal(ui.get("finish-color").value, "#445566");
  assert.equal(ui.editor.pending(), false);
});

test("a roomless valid scene hides the editor without attempting to load a missing room", (t) => {
  const ui = fixture(t);
  ui.replaceScene({ scene_id: "empty", rooms: [], walls: [] });
  assert.doesNotThrow(() => ui.editor.refresh({ force: true }));
  assert.equal(ui.get("finish-panel").hidden, true);
  assert.equal(ui.editor.pending(), false);
});

test("a rejected clear or blocked edit preserves the pending form and original scene", async (t) => {
  const ui = fixture(t),
    before = structuredClone(ui.scene());
  ui.get("finish-color").value = "#123456";
  ui.reject();
  await ui.get("finish-clear").onclick();
  assert.equal(ui.get("finish-color").value, "#123456");
  assert.equal(ui.editor.pending(), true);
  assert.deepEqual(ui.scene(), before);
  ui.editable(false);
  await ui.get("finish-apply").onclick();
  assert.match(ui.notice(), /家具|高级/);
  assert.deepEqual(ui.scene(), before);
});
