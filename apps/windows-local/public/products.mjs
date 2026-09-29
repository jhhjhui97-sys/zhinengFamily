import { formatMoney } from "./money.mjs";

const $ = (id) => document.getElementById(id);
const fields = [
  "category",
  "brand",
  "name",
  "sku",
  "price",
  "width",
  "depth",
  "height",
  "metadata",
];
const empty = () => ({
  category: "",
  brand: "",
  name: "",
  sku: "",
  price: "",
  width: "",
  depth: "",
  height: "",
  metadata: "",
});
function finiteJson(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(finiteJson);
  if (value && typeof value === "object")
    return Object.values(value).every(finiteJson);
  return true;
}
function form() {
  return Object.fromEntries(
    fields.map((key) => [key, $("product-" + key).value]),
  );
}
function put(values) {
  for (const key of fields) $("product-" + key).value = values[key] ?? "";
}
function validate(values) {
  for (const key of ["category", "brand", "name", "sku"]) {
    if (!values[key].trim()) throw Error("请填写商品分类、品牌、名称和 SKU。");
  }
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(values.price))
    throw Error("价格须为最多两位小数的有效金额。");
  const dimensions = [values.width, values.depth, values.height].map(Number);
  if (dimensions.some((n) => !Number.isFinite(n) || n <= 0))
    throw Error("尺寸必须大于 0 mm。");
  let metadata;
  try {
    metadata = values.metadata.trim() ? JSON.parse(values.metadata) : {};
  } catch {
    throw Error("商品属性不是合法 JSON。");
  }
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object")
    throw Error("商品属性 JSON 顶层必须是对象。");
  if (!finiteJson(metadata)) throw Error("商品属性 JSON 包含非法数值。");
  return {
    category: values.category.trim(),
    brand: values.brand.trim(),
    name: values.name.trim(),
    sku: values.sku.trim(),
    price: values.price,
    width_mm: dimensions[0],
    depth_mm: dimensions[1],
    height_mm: dimensions[2],
    metadata,
  };
}
export function mountProducts({ api }) {
  let selected = null,
    baseline = JSON.stringify(empty()),
    offset = 0,
    total = 0,
    busy = false,
    settled = Promise.resolve();
  const note = (message, error = false) => {
    $("product-message").textContent = message;
    $("product-message").classList.toggle("error", error);
  };
  const dirty = () => JSON.stringify(form()) !== baseline;
  const canLeave = () =>
    !dirty() || confirm("商品资料有未保存的修改，确定放弃吗？");
  const reset = () => {
    selected = null;
    put(empty());
    baseline = JSON.stringify(form());
    $("product-detail").textContent =
      "选择商品查看详情，或新建在售商品。暂无与该 SKU 对应的真实 3D 模型。";
    note("");
  };
  function detail(product) {
    selected = product;
    put({
      ...product,
      width: product.width_mm,
      depth: product.depth_mm,
      height: product.height_mm,
      metadata: JSON.stringify(product.metadata, null, 2),
    });
    baseline = JSON.stringify(form());
    $("product-detail").textContent =
      `${product.name} · ${product.sku}\n${product.brand} / ${product.category}\n${formatMoney(product.price)} · ${product.width_mm} × ${product.depth_mm} × ${product.height_mm} mm\n商品属性：${JSON.stringify(product.metadata)}\n暂无与该 SKU 对应的真实 3D 模型。`;
  }
  async function list() {
    const page = await api("products", {
      limit: 20,
      offset,
      search: $("products-search").value.trim(),
      category: $("products-category-filter").value.trim(),
    });
    total = page.total;
    const tbody = $("products-items");
    tbody.replaceChildren();
    for (const product of page.items) {
      const row = document.createElement("tr");
      for (const value of [
        product.name,
        `${product.brand} / ${product.category}`,
        product.sku,
        formatMoney(product.price),
        `${product.width_mm} × ${product.depth_mm} × ${product.height_mm} mm`,
      ]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }
      const cell = document.createElement("td"),
        button = document.createElement("button");
      button.textContent = `查看 ${product.name}`;
      button.disabled = busy;
      button.onclick = async () => {
        await settled;
        return operate(async () => {
          if (!canLeave()) return;
          detail(await api("product", { id: product.id }));
          note("");
        });
      };
      cell.append(button);
      row.append(cell);
      tbody.append(row);
    }
    $("products-empty").hidden = total > 0;
    $("products-count").textContent = total
      ? `显示 ${offset + 1}–${offset + page.items.length} / 共 ${total} 件`
      : "共 0 件商品";
    $("products-prev").disabled = offset === 0;
    $("products-next").disabled = offset + page.items.length >= total;
  }
  async function operate(fn) {
    if (busy) return;
    busy = true;
    let resolveSettled;
    settled = new Promise((resolve) => {
      resolveSettled = resolve;
    });
    for (const id of [
      "product-create",
      "product-update",
      "product-reset",
      "products-search-button",
      "products-prev",
      "products-next",
    ])
      $(id).disabled = true;
    try {
      await fn();
    } catch (error) {
      const text = error?.message ?? "";
      note(
        text.includes("场景已被其他操作更新")
          ? "商品信息已变化，你的修改已保留。请刷新后重试。"
          : text || "本地资料服务暂时不可用，请稍后重试。",
        true,
      );
    } finally {
      busy = false;
      for (const id of [
        "product-create",
        "product-update",
        "product-reset",
        "products-search-button",
      ])
        $(id).disabled = false;
      $("products-prev").disabled = offset === 0;
      $("products-next").disabled = offset + 20 >= total;
      $("products-items")
        .querySelectorAll("button")
        .forEach((button) => {
          button.disabled = false;
        });
      resolveSettled();
    }
  }
  $("products-search-button").onclick = () =>
    operate(async () => {
      offset = 0;
      await list();
      note("");
    });
  $("products-prev").onclick = () =>
    operate(async () => {
      offset = Math.max(0, offset - 20);
      await list();
    });
  $("products-next").onclick = () =>
    operate(async () => {
      offset += 20;
      await list();
    });
  $("product-reset").onclick = () => {
    if (canLeave()) reset();
  };
  $("product-create").onclick = () =>
    operate(async () => {
      const product = await api("product_create", validate(form()));
      await list();
      detail(product);
      note("商品已保存在本机。");
    });
  $("product-update").onclick = () =>
    operate(async () => {
      if (!selected) throw Error("请先选择要编辑的商品。");
      const product = await api("product_update", {
        id: selected.id,
        base_revision: selected.revision,
        ...validate(form()),
      });
      await list();
      detail(product);
      note("商品资料已更新。");
    });
  return { open: () => operate(list), dirty, canLeave };
}
