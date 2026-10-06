import test from "node:test";
import assert from "node:assert/strict";
import { mountProducts } from "../public/products.mjs";

// The controller's only DOM needs are fields, list rows, buttons, and messages.
// Keep those boundary objects small so these tests can run without WebGL/Edge.
class Element {
  constructor(tag = "div") {
    this.tag = tag;
    this.value = "";
    this.files = [];
    this.children = [];
    this.disabled = false;
    this.classList = { toggle() {} };
    this.textContent = "";
  }
  append(...elements) {
    this.children.push(...elements);
  }
  replaceChildren(...elements) {
    this.children = elements;
  }
  querySelectorAll(tag) {
    return this.children.flatMap((element) => [
      ...(element.tag === tag ? [element] : []),
      ...element.querySelectorAll(tag),
    ]);
  }
  focus() {
    this.focused = true;
  }
}
const fields = {
  category: "chair",
  brand: "门店品牌",
  name: "尺寸椅",
  sku: "CHAIR-1",
  price: "1200.00",
  width: "800",
  depth: "700",
  height: "900",
  metadata: '{"color":"浅灰"}',
};
function fixture(t, initial = []) {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const old = {
    document: globalThis.document,
    confirm: globalThis.confirm,
    fetch: globalThis.fetch,
  };
  globalThis.document = {
    getElementById: get,
    createElement: (tag) => new Element(tag),
  };
  globalThis.confirm = () => true;
  t.after(() => Object.assign(globalThis, old));
  const products = new Map(
    initial.map((product) => [product.id, structuredClone(product)]),
  );
  let catalog = [],
    refreshFails = false,
    uploads = 0;
  const api = async (action, values = {}) => {
    if (action === "products") {
      const items = [...products.values()].filter(
        (product) =>
          !product.deleted &&
          (!values.search ||
            product.name.includes(values.search) ||
            product.sku.includes(values.search)),
      );
      return {
        total: items.length,
        items: structuredClone(
          items.slice(values.offset, values.offset + values.limit),
        ),
      };
    }
    if (action === "product") return structuredClone(products.get(values.id));
    if (action === "product_delete") {
      const product = products.get(values.id);
      if (values.base_revision !== product.revision)
        throw Error("场景已被其他操作更新");
      product.deleted = true;
      return structuredClone(product);
    }
    if (action === "product_create" || action === "product_create_model") {
      if ([...products.values()].some((product) => product.sku === values.sku))
        throw Error("SKU 已存在");
      const product = {
        ...values,
        id: `product-${products.size + 1}`,
        revision: 1,
        active_asset_id: action === "product_create_model" ? "asset-new" : null,
      };
      products.set(product.id, product);
      return structuredClone(product);
    }
    if (action === "product_update") {
      const product = products.get(values.id);
      Object.assign(product, values, { revision: product.revision + 1 });
      return structuredClone(product);
    }
    throw Error(`Unexpected action ${action}`);
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/model-files");
    assert.equal(options.headers["content-type"], "model/gltf-binary");
    uploads++;
    if (options.body.invalid)
      return {
        ok: false,
        status: 400,
        json: async () => ({ error: "GLB 文件不合法" }),
      };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        status: 200,
        data: { sha256: "a".repeat(64), byte_count: options.body.size },
      }),
    };
  };
  const controller = mountProducts({
    api,
    onChanged: async () => {
      if (refreshFails) throw Error("目录暂时不可用");
      catalog = [...products.values()]
        .filter((product) => !product.deleted)
        .map((product) => ({ ...product }));
    },
  });
  const fill = (values = fields) => {
    for (const [key, value] of Object.entries(values))
      get(`product-${key}`).value = value;
  };
  const click = async (id) => {
    assert.equal(
      typeof get(id).onclick,
      "function",
      `${id} must provide an action`,
    );
    await get(id).onclick();
  };
  const rowButton = (label) =>
    get("products-items")
      .querySelectorAll("button")
      .find((button) => button.textContent === label);
  return {
    get,
    api,
    products,
    controller,
    fill,
    click,
    rowButton,
    catalog: () => catalog,
    uploads: () => uploads,
    failRefresh: () => {
      refreshFails = true;
    },
  };
}

test("product creates and edits refresh the design catalogue immediately", async (t) => {
  const ui = fixture(t);
  ui.fill();
  await ui.click("product-create");
  assert.equal(ui.catalog().length, 1);
  assert.equal(ui.catalog()[0].sku, "CHAIR-1");
  await ui.rowButton("编辑 尺寸椅").onclick();
  assert.equal(ui.get("product-name").focused, true);
  ui.get("product-name").value = "更新椅";
  await ui.click("product-update");
  assert.equal(ui.catalog()[0].name, "更新椅");
  assert.match(ui.get("product-message").textContent, /已更新/);
});
test("last-page product deletion returns to a valid page and preserves unrelated edits", async (t) => {
  const products = Array.from({ length: 21 }, (_, index) => ({
    id: `p${index}`,
    category: "chair",
    brand: "品牌",
    name: `椅${index}`,
    sku: `SKU${index}`,
    price: "1.00",
    width_mm: 500,
    depth_mm: 500,
    height_mm: 500,
    metadata: {},
    revision: 1,
  }));
  const ui = fixture(t, products);
  await ui.controller.open();
  await ui.rowButton("查看 椅0").onclick();
  ui.get("product-name").value = "未保存的名称";
  await ui.click("products-next");
  await ui.rowButton("删除 椅20").onclick();
  assert.match(ui.get("products-count").textContent, /1–20 \/ 共 20/);
  assert.equal(ui.get("products-prev").disabled, true);
  assert.equal(ui.get("product-name").value, "未保存的名称");
  assert.equal(
    ui.catalog().some((product) => product.id === "p20"),
    false,
  );
});
test("stale or cancelled product deletion keeps the product and form", async (t) => {
  const ui = fixture(t);
  ui.fill();
  await ui.click("product-create");
  globalThis.confirm = () => false;
  await ui.click("product-delete");
  assert.equal(ui.catalog().length, 1);
  globalThis.confirm = () => true;
  ui.products.get("product-1").revision++;
  ui.get("product-name").value = "未保存修改";
  await ui.click("product-delete");
  assert.equal(ui.products.get("product-1").deleted, undefined);
  assert.equal(ui.get("product-name").value, "未保存修改");
  assert.match(ui.get("product-message").textContent, /修改已保留/);
});
test("model import creates a distinct product from the current form while retaining an existing selection", async (t) => {
  const ui = fixture(t);
  ui.fill();
  await ui.click("product-create");
  ui.fill({ ...fields, name: "模型椅", sku: "CHAIR-MODEL" });
  ui.get("product-model-file").files = [{ size: 100 }];
  await ui.click("product-model-create");
  assert.equal(ui.products.size, 2);
  assert.equal(ui.products.get("product-1").name, "尺寸椅");
  const imported = ui.products.get("product-2");
  assert.equal(imported.active_asset_id, "asset-new");
  assert.equal(imported.sha256, "a".repeat(64));
  assert.equal(imported.byte_count, 100);
  assert.equal(ui.catalog().length, 2);
  assert.equal(ui.get("product-model-file").value, "");
});
test("invalid details and failed model staging keep the selected file and create no product", async (t) => {
  const ui = fixture(t);
  ui.fill({ ...fields, width: "0" });
  const file = { size: 100, invalid: true };
  ui.get("product-model-file").files = [file];
  await ui.click("product-model-create");
  assert.equal(ui.uploads(), 0);
  assert.equal(ui.products.size, 0);
  assert.match(ui.get("product-message").textContent, /尺寸/);
  ui.fill();
  await ui.click("product-model-create");
  assert.equal(ui.products.size, 0);
  assert.equal(ui.get("product-model-file").files[0], file);
  assert.match(ui.get("product-message").textContent, /GLB/);
});
test("duplicate SKU model create keeps the existing product and the chosen file", async (t) => {
  const ui = fixture(t);
  ui.fill();
  await ui.click("product-create");
  const file = { size: 100 };
  ui.get("product-model-file").files = [file];
  await ui.click("product-model-create");
  assert.equal(ui.products.size, 1);
  assert.equal(ui.products.get("product-1").active_asset_id, null);
  assert.equal(ui.get("product-model-file").files[0], file);
  assert.match(ui.get("product-message").textContent, /SKU/);
});
test("catalogue refresh failure reports a saved product without losing its details", async (t) => {
  const ui = fixture(t);
  ui.failRefresh();
  ui.fill();
  await ui.click("product-create");
  assert.equal(ui.products.size, 1);
  assert.equal(ui.get("product-name").value, "尺寸椅");
  assert.match(ui.get("product-message").textContent, /目录刷新失败/);
});
