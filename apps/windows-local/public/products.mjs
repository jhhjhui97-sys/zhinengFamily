import { formatMoney } from "./money.mjs";
import { makePhotoGlb, photoDimensions } from "./photo-model.mjs";

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
export function mountProducts({ api, onChanged = async () => {} }) {
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
  const formChanged = () => JSON.stringify(form()) !== baseline;
  const dirty = () =>
    formChanged() ||
    Boolean($("product-model-file").files?.length) ||
    Boolean($("product-photo-file").files?.length);
  const canLeave = () =>
    !dirty() || confirm("商品资料有未保存的修改，确定放弃吗？");
  const reset = () => {
    selected = null;
    $("product-model-file").value = "";
    $("product-photo-file").value = "";
    put(empty());
    baseline = JSON.stringify(form());
    $("product-detail").textContent =
      "选择商品查看详情，或新建在售商品。暂无与该 SKU 对应的真实 3D 模型。";
    note("");
  };
  function detail(product) {
    if (selected?.id !== product.id) {
      $("product-model-file").value = "";
      $("product-photo-file").value = "";
    }
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
      `${product.name} · ${product.sku}\n${product.brand} / ${product.category}\n${formatMoney(product.price)} · ${product.width_mm} × ${product.depth_mm} × ${product.height_mm} mm\n商品属性：${JSON.stringify(product.metadata)}\n${product.active_asset_id ? "已有本机 3D 模型" : "暂无与该 SKU 对应的真实 3D 模型。"}`;
  }
  async function list(nextOffset = offset) {
    let page;
    try {
      page = await api("products", {
        limit: 20,
        offset: nextOffset,
        search: $("products-search").value.trim(),
        category: $("products-category-filter").value.trim(),
      });
    } catch {
      throw Error("商品查询失败，仍显示上次结果；请重试。");
    }
    if (nextOffset > 0 && nextOffset >= page.total)
      return list(Math.max(0, Math.floor((page.total - 1) / 20) * 20));
    offset = nextOffset;
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
      const cell = document.createElement("td");
      for (const action of ["查看", "编辑", "删除"]) {
        const button = document.createElement("button");
        button.textContent = `${action} ${product.name}`;
        button.disabled = busy;
        button.onclick = async () => {
          await settled;
          return operate(async () => {
            if (action === "删除") return deleteProduct(product);
            if (!canLeave()) return;
            detail(await api("product", { id: product.id }));
            if (action === "编辑") $("product-name").focus();
            note("");
          });
        };
        cell.append(button);
      }
      row.append(cell);
      tbody.append(row);
    }
    $("products-empty").hidden = page.items.length > 0;
    $("products-empty").textContent =
      $("products-search").value.trim() ||
      $("products-category-filter").value.trim()
        ? "没有匹配的商品，请调整搜索或分类条件。"
        : "暂无在售商品，可在右侧新建。";
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
      "product-delete",
      "product-reset",
      "product-model-upload",
      "product-model-create",
      "product-photo-generate",
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
        "product-delete",
        "product-reset",
        "product-model-upload",
        "product-model-create",
        "product-photo-generate",
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
      await list(0);
      note("");
    });
  $("products-prev").onclick = () =>
    operate(async () => {
      await list(Math.max(0, offset - 20));
    });
  $("products-next").onclick = () =>
    operate(async () => {
      await list(offset + 20);
    });
  $("product-reset").onclick = () => {
    if (canLeave()) reset();
  };
  async function refreshAfterMutation(success, listFailure) {
    const warnings = [];
    try {
      await list();
    } catch {
      warnings.push(listFailure);
    }
    try {
      await onChanged();
    } catch {
      warnings.push("工作台目录刷新失败，请切回设计工作台重试。");
    }
    note(
      warnings.length ? `${success}${warnings.join(" ")}` : success,
      warnings.length > 0,
    );
  }
  async function deleteProduct(product) {
    if (
      !confirm(
        `确定删除商品 ${product.name}（${product.sku}）吗？商品将移出在售列表；已保存的场景、报价和模型保留。${selected?.id === product.id && dirty() ? "当前商品未保存的修改将放弃。" : ""}`,
      )
    )
      return;
    await api("product_delete", {
      id: product.id,
      base_revision: product.revision,
    });
    if (selected?.id === product.id) reset();
    await refreshAfterMutation(
      "商品已删除，历史资料仍保留。",
      "商品已删除，但列表刷新失败，请重试搜索。",
    );
  }
  $("product-delete").onclick = () =>
    operate(async () => {
      if (!selected) throw Error("请先选择要删除的商品。");
      await deleteProduct(selected);
    });
  $("product-create").onclick = () =>
    operate(async () => {
      const product = await api("product_create", validate(form()));
      detail(product);
      await refreshAfterMutation(
        "商品已保存在本机。",
        "商品已保存，但列表刷新失败，请重试搜索。",
      );
    });
  $("product-update").onclick = () =>
    operate(async () => {
      if (!selected) throw Error("请先选择要编辑的商品。");
      const product = await api("product_update", {
        id: selected.id,
        base_revision: selected.revision,
        ...validate(form()),
      });
      detail(product);
      await refreshAfterMutation(
        "商品资料已更新。",
        "商品已更新，但列表刷新失败，请重试搜索。",
      );
    });
  async function attachModel(payload) {
    let response;
    try {
      response = await fetch(`/api/product-models/${selected.id}`, {
        method: "POST",
        headers: {
          "content-type": "model/gltf-binary",
          "x-base-revision": String(selected.revision),
        },
        body: payload,
      });
    } catch {
      throw Error("本地模型服务暂时不可用，请重试。");
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 409)
        throw Error("商品信息已变化，请重新打开商品后重试；所选文件已保留。");
      throw Error(body?.error ?? "模型导入失败，请检查文件后重试。");
    }
    return body.data;
  }
  function modelFile() {
    const file = $("product-model-file").files?.[0];
    if (!file) throw Error("请先选择 GLB 模型文件。");
    if (file.size > 30 * 1024 * 1024) throw Error("模型文件不能超过 30 MiB。");
    return file;
  }
  $("product-model-create").onclick = () =>
    operate(async () => {
      const values = validate(form());
      const file = modelFile();
      let response;
      try {
        response = await fetch("/api/model-files", {
          method: "POST",
          headers: { "content-type": "model/gltf-binary" },
          body: file,
        });
      } catch {
        throw Error("本地模型服务暂时不可用，请重试；所选文件已保留。");
      }
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw Error(body?.error ?? "模型导入失败，请检查文件后重试。");
      const staged = body?.data;
      if (
        !staged ||
        !/^[0-9a-f]{64}$/i.test(staged.sha256) ||
        !Number.isSafeInteger(staged.byte_count) ||
        staged.byte_count !== file.size
      )
        throw Error("模型服务返回的文件资料不完整，请重试；所选文件已保留。");
      const product = await api("product_create_model", {
        ...values,
        sha256: staged.sha256,
        byte_count: staged.byte_count,
      });
      detail(product);
      $("product-model-file").value = "";
      await refreshAfterMutation(
        "模型已导入，并新建在售商品。",
        "商品和模型已保存，但列表刷新失败，请重试搜索。",
      );
    });
  $("product-model-upload").onclick = () =>
    operate(async () => {
      if (!selected) throw Error("请先选择已保存的商品。 ");
      if (formChanged())
        throw Error("商品资料有未保存的修改，请先更新商品，再导入模型。 ");
      const product = await attachModel(modelFile());
      detail(product);
      $("product-model-file").value = "";
      await refreshAfterMutation(
        "模型已导入本机，并关联当前商品。",
        "模型已保存，但列表刷新失败，请重试搜索。",
      );
    });
  $("product-photo-generate").onclick = () =>
    operate(async () => {
      if (!selected) throw Error("请先保存商品及真实尺寸。");
      if (formChanged()) throw Error("请先更新商品尺寸，再生成模型。");
      const file = $("product-photo-file").files?.[0];
      if (!file) throw Error("请先选择商品正面图片。");
      if (file.size > 5 * 1024 * 1024) throw Error("图片不能超过 5 MiB。");
      const imageBytes = new Uint8Array(await file.arrayBuffer());
      photoDimensions(imageBytes);
      let decoded;
      try {
        decoded = await createImageBitmap(file);
      } catch {
        throw Error("图片无法解码，请选择完整的 PNG 或 JPEG 文件。");
      } finally {
        decoded?.close();
      }
      const bytes = makePhotoGlb({
        width_mm: selected.width_mm,
        depth_mm: selected.depth_mm,
        height_mm: selected.height_mm,
        category: selected.category,
        imageBytes,
      });
      const product = await attachModel(bytes);
      detail(product);
      $("product-photo-file").value = "";
      await refreshAfterMutation(
        "尺寸近似模型已保存在本机，可用于商品摆放。",
        "模型已保存，但列表刷新失败，请重试搜索。",
      );
    });
  $("product-model-file").onchange = () => note("");
  $("product-photo-file").onchange = () => note("");
  return { open: () => operate(list), dirty, canLeave };
}
