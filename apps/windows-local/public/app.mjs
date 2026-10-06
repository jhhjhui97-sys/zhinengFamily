import { RoomRenderer } from "./renderer.mjs";
import {
  addFurniture,
  editFurniture,
  removeFurniture,
  nearestWallGapMm,
} from "./scene-tools.mjs";
import { mountFurnitureGestures } from "./furniture-gestures.mjs";
import { mountProducts } from "./products.mjs";
import { createCatalogRefresh } from "./catalog-refresh.mjs";
import { mountQuotes } from "./quotes.mjs";
import { mountOrders } from "./orders.mjs";
import { mountDxfImport } from "./dxf-import.mjs";
const $ = (id) => document.getElementById(id);
let active = null,
  baseline = 0,
  draft = null,
  saved = null,
  history = null,
  busy = false,
  libraryOffset = 0,
  historyOffset = 0,
  restoreIntent = null,
  furnitureFieldsBaseline = null,
  catalogItems = [],
  selectedCustomer = null,
  selectedProject = null,
  customerOffset = 0,
  customerTrashOffset = 0,
  customerTrashTotal = 0,
  projectOffset = 0,
  customerFormBaseline = null,
  projectFormBaseline = null;
const view = new RoomRenderer($("viewport"), $("render-status"));
function message(value, error = false) {
  $("message").textContent = value;
  $("message").classList.toggle("error", error);
}
function dirty() {
  return draft && JSON.stringify(draft) !== JSON.stringify(saved);
}
function pendingJson() {
  return draft && $("scene-json").value !== JSON.stringify(draft, null, 2);
}
function pendingFurniture() {
  return (
    draft &&
    furnitureFieldsBaseline &&
    ["furniture-x", "furniture-y", "furniture-rotation"].some(
      (id) => $(id).value !== furnitureFieldsBaseline[id],
    )
  );
}
function sceneUnsaved() {
  return Boolean(dirty() || pendingJson() || pendingFurniture());
}
function hasUnsavedChanges({ customer = true, project = true } = {}) {
  return (
    sceneUnsaved() ||
    (customer && JSON.stringify(customerForm()) !== customerFormBaseline) ||
    (project && JSON.stringify(projectForm()) !== projectFormBaseline)
  );
}
function refreshRevision() {
  $("revision").textContent = active
    ? (baseline ? `当前 v${baseline}` : "未保存") +
      (sceneUnsaved() ? " · 有未保存修改" : "")
    : "未保存";
}
function discard(options) {
  if (!orders.canLeave()) {
    message("订单操作尚未完成，请稍候再切换客户或项目。", true);
    return false;
  }
  return (
    !hasUnsavedChanges(options) || confirm("还有未保存的修改，确定放弃吗？")
  );
}
function sceneScope() {
  return selectedProject
    ? { customer_id: selectedCustomer.id, project_id: selectedProject.id }
    : {};
}
function clearScene() {
  dxfImport.reset();
  $("dxf-import").hidden = true;
  active = null;
  baseline = 0;
  draft = saved = history = restoreIntent = null;
  libraryOffset = historyOffset = 0;
  $("history-items").replaceChildren();
  $("history-json").textContent = "";
  $("history-json-panel").open = false;
  $("project-name").value = "";
  $("project-title").textContent = selectedProject?.name ?? "开始你的家居方案";
  quotes.clear();
  orders.clear();
  refreshDraft();
}
async function api(action, fields = {}) {
  let response;
  try {
    response = await fetch("/api/local", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...fields }),
    });
  } catch {
    throw Error("本地服务暂时不可用，请检查软件连接后重试。");
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw Error("本地服务暂时不可用，请重新打开软件。");
  }
  if (!response.ok) throw Error(body.error ?? "操作失败，请重试。");
  return body.data;
}
const refreshCatalog = createCatalogRefresh(() => api("catalog"), applyCatalog);
const productsView = mountProducts({ api, onChanged: loadCatalog });
const dxfImport = mountDxfImport({
  getActive: () => (selectedProject ? active : null),
  hasUnsavedChanges,
  setDraft: async (scene) => {
    const validated = await api("validate", { scene });
    draft = validated.scene;
    refreshDraft();
  },
  notify: message,
  run,
});
const orders = mountOrders({ api, notify: message, scope: sceneScope });
const quotes = mountQuotes({
  api,
  notify: message,
  scope: () => ({ ...sceneScope(), id: active?.id, scene_version: baseline }),
  hasUnsavedChanges,
  onQuoteShown: (quote) => {
    orders.hideDetail();
    orders.fromQuote(quote);
  },
  onQuoteCleared: () => {
    orders.fromQuote(null);
    orders.hideDetail();
  },
});
$("nav-design").onclick = async () => {
  if (!productsView.canLeave()) return;
  try {
    await loadCatalog();
  } catch (error) {
    message(error.message || "商品目录加载失败，请重试。", true);
    return;
  }
  $("products-page").hidden = true;
  $("design-page").hidden = false;
};
$("nav-products").onclick = () => {
  if (!discard()) return;
  $("design-page").hidden = true;
  $("products-page").hidden = false;
  productsView.open();
};
async function run(operation) {
  if (busy) return;
  busy = true;
  document.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    await operation();
  } catch (error) {
    message(error.message || "操作失败，请重试。", true);
  } finally {
    busy = false;
    document.querySelectorAll("button").forEach((b) => (b.disabled = false));
  }
}
function button(text, action) {
  const element = document.createElement("button");
  element.textContent = text;
  element.disabled = busy;
  element.addEventListener("click", () => run(action));
  return element;
}
function fields() {
  const item = draft?.furniture_instances.find(
    (x) => x.id === $("furniture-select").value,
  );
  $("furniture-x").value = item?.position.x ?? "";
  $("furniture-y").value = item?.position.y ?? "";
  $("furniture-rotation").value = item?.rotation_deg ?? "";
  $("dimensions").textContent = item
    ? `${item.width_mm} × ${item.depth_mm} × ${item.height_mm} mm`
    : "暂无家具";
  furnitureFieldsBaseline = Object.fromEntries(
    ["furniture-x", "furniture-y", "furniture-rotation"].map((id) => [
      id,
      $(id).value,
    ]),
  );
  furnitureFieldsBaseline.selection = $("furniture-select").value;
  view.selectFurniture(item?.id ?? null);
  refreshRevision();
}
function refreshDraft() {
  const selected = $("furniture-select").value;
  const selectedRoom = $("room-select").value;
  $("empty-view").hidden = Boolean(draft);
  $("scene-json").value = draft ? JSON.stringify(draft, null, 2) : "";
  $("furniture-select").replaceChildren();
  for (const item of draft?.furniture_instances ?? []) {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.metadata?.name ?? "沙发";
    $("furniture-select").append(option);
  }
  if (selected) $("furniture-select").value = selected;
  if (!$("furniture-select").value && $("furniture-select").options.length)
    $("furniture-select").selectedIndex = 0;
  $("room-select").replaceChildren();
  for (const room of draft?.rooms ?? []) {
    const option = document.createElement("option");
    option.value = room.id;
    option.textContent = room.name;
    $("room-select").append(option);
  }
  if (selectedRoom) $("room-select").value = selectedRoom;
  if (!$("room-select").value && $("room-select").options.length)
    $("room-select").selectedIndex = 0;
  fields();
  refreshRevision();
  $("scene-stats").textContent = draft
    ? `${draft.rooms.length} 个房间 · ${draft.walls.length} 段墙体 · ${draft.furniture_instances.length} 件家具 · 真实毫米比例`
    : "毫米为单位 · 真实比例";
  if (draft) view.show(draft);
  else view.clear();
}
function loadCatalog() {
  return refreshCatalog();
}
function applyCatalog(products) {
  const selected = $("catalog-select").value;
  catalogItems = products;
  view.configureCatalog(catalogItems);
  $("catalog-select").replaceChildren();
  for (const product of catalogItems) {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = `${product.sellable || product.asset_id ? "在售" : "演示"} · ${product.name}${product.model_kind === "dimensions" ? "（尺寸模型）" : ""}`;
    $("catalog-select").append(option);
  }
  if (selected && catalogItems.some((product) => product.id === selected))
    $("catalog-select").value = selected;
}
function customerForm() {
  return Object.fromEntries(
    [
      "name",
      "phone",
      "wechat",
      "source",
      "address",
      "budget",
      "status",
      "notes",
    ].map((key) => [key, $("customer-" + key).value.trim()]),
  );
}
function projectForm() {
  return {
    name: $("sales-project-name").value.trim(),
    address: $("sales-project-address").value.trim(),
    status: $("sales-project-status").value,
  };
}
customerFormBaseline = JSON.stringify(customerForm());
projectFormBaseline = JSON.stringify(projectForm());
function showCustomer(customer) {
  selectedCustomer = customer;
  selectedProject = null;
  $("selected-customer").textContent = customer.name;
  $("selected-project").textContent = "尚未选择项目";
  for (const [key, value] of Object.entries(customerForm()))
    $("customer-" + key).value = customer[key] ?? "";
  $("sales-project-name").value = "";
  $("sales-project-address").value = "";
  $("sales-project-status").value = "draft";
  customerFormBaseline = JSON.stringify(customerForm());
  projectFormBaseline = JSON.stringify(projectForm());
  $("scene-scope-label").textContent = "请先选择项目";
  clearScene();
}
function clearCustomerSelection() {
  selectedCustomer = selectedProject = null;
  $("selected-customer").textContent = "尚未选择客户";
  $("selected-project").textContent = "请先选择客户";
  for (const key of Object.keys(customerForm()))
    $("customer-" + key).value = "";
  $("customer-status").value = "new";
  $("sales-project-name").value = "";
  $("sales-project-address").value = "";
  $("sales-project-status").value = "draft";
  customerFormBaseline = JSON.stringify(customerForm());
  projectFormBaseline = JSON.stringify(projectForm());
  $("sales-project-items").replaceChildren();
  $("sales-project-count").textContent = "请先选择客户";
  $("scene-scope-label").textContent = "请先选择项目";
  clearScene();
}
async function customers() {
  const page = await api("customers", { limit: 20, offset: customerOffset });
  $("customer-count").textContent = `共 ${page.total} 位客户`;
  $("customer-items").replaceChildren();
  for (const item of page.items) {
    $("customer-items").append(
      button(item.name, async () => {
        if (!discard()) return;
        showCustomer(item);
        projectOffset = 0;
        await projects();
        await library();
        message(`已选择客户：${item.name}。`);
      }),
    );
  }
}
async function deletedCustomers() {
  if ($("customer-trash").hidden) return;
  const page = await api("deleted_customers", {
    limit: 20,
    offset: customerTrashOffset,
  });
  customerTrashTotal = page.total;
  $("customer-trash-count").textContent = `共 ${page.total} 位已移出客户`;
  $("customer-trash-prev").disabled = customerTrashOffset === 0;
  $("customer-trash-next").disabled = customerTrashOffset + 20 >= page.total;
  $("customer-trash-items").replaceChildren();
  for (const item of page.items) {
    $("customer-trash-items").append(
      button(`恢复 ${item.name}`, async () => {
        if (!discard()) return;
        const restored = await api("customer_restore", {
          id: item.id,
          base_revision: item.revision,
        });
        customerOffset = projectOffset = customerTrashOffset = 0;
        showCustomer(restored);
        await customers();
        await deletedCustomers();
        await projects();
        await library();
        message(`客户 ${restored.name} 及关联资料已恢复。`);
      }),
    );
  }
}
async function projects() {
  $("sales-project-items").replaceChildren();
  if (!selectedCustomer) {
    $("sales-project-count").textContent = "请先选择客户";
    return;
  }
  const page = await api("projects", {
    customer_id: selectedCustomer.id,
    limit: 20,
    offset: projectOffset,
  });
  $("sales-project-count").textContent = `共 ${page.total} 个项目`;
  for (const item of page.items) {
    $("sales-project-items").append(
      button(item.name, async () => {
        if (!discard()) return;
        selectedProject = item;
        $("selected-project").textContent = item.name;
        $("sales-project-name").value = item.name;
        $("sales-project-address").value = item.address ?? "";
        $("sales-project-status").value = item.status;
        projectFormBaseline = JSON.stringify(projectForm());
        $("scene-scope-label").textContent = "项目方案";
        clearScene();
        await library();
        await quotes.load();
        await orders.load();
        message(`已打开项目：${item.name}。`);
      }),
    );
  }
}
async function library() {
  const page = await api("list", {
    ...sceneScope(),
    limit: 20,
    offset: libraryOffset,
  });
  $("library-count").textContent = `共 ${page.total} 个`;
  $("library-items").replaceChildren();
  for (const item of page.items) {
    const element = button(item.name, async () => {
      if (!discard()) return;
      const current = await api("current", { ...sceneScope(), id: item.id });
      active = item;
      baseline = current?.revision ?? 0;
      draft = current?.scene ?? null;
      saved = structuredClone(draft);
      history = null;
      historyOffset = 0;
      $("history-json").textContent = "";
      $("history-json-panel").open = false;
      $("project-title").textContent = item.name;
      refreshDraft();
      await versions();
      message("已打开本地方案。");
    });
    $("library-items").append(element);
  }
}
async function versions() {
  if (!active) return;
  const list = await api("versions", {
    ...sceneScope(),
    id: active.id,
    limit: 20,
    offset: historyOffset,
  });
  $("history-items").replaceChildren();
  for (const version of list) {
    const element = button(`查看 v${version.revision}`, async () => {
      history = version;
      $("history-json").textContent = JSON.stringify(version.scene, null, 2);
      $("history-json-panel").open = true;
      message(`正在查看 v${version.revision}，当前修改未改变。`);
    });
    $("history-items").append(element);
  }
}
function adopt(version) {
  baseline = version.revision;
  draft = version.scene;
  saved = structuredClone(draft);
  history = null;
  $("history-json").textContent = "";
  $("history-json-panel").open = false;
  refreshDraft();
}
$("customer-create").onclick = () =>
  run(async () => {
    if (!discard({ customer: false })) return;
    const values = customerForm();
    if (!values.name) throw Error("请填写客户姓名。");
    const customer = await api("customer_create", values);
    customerOffset = projectOffset = 0;
    showCustomer(customer);
    await customers();
    await projects();
    await library();
    message(`客户 ${customer.name} 已保存在本机。`);
  });
$("customer-edit").onclick = () =>
  run(async () => {
    if (!selectedCustomer) throw Error("请先选择要更新的客户。");
    const values = customerForm();
    if (!values.name) throw Error("请填写客户姓名。");
    const customer = await api("customer_update", {
      id: selectedCustomer.id,
      base_revision: selectedCustomer.revision,
      ...values,
    });
    selectedCustomer = customer;
    customerFormBaseline = JSON.stringify(customerForm());
    $("selected-customer").textContent = customer.name;
    await customers();
    message(`客户 ${customer.name} 已更新。`);
  });
$("customer-delete").onclick = () =>
  run(async () => {
    if (!selectedCustomer) throw Error("请先选择要移出的客户。");
    if (!discard()) return;
    const customer = selectedCustomer;
    if (
      !confirm(
        `确定移出客户 ${customer.name} 吗？关联的项目、方案、报价和订单会从常规列表隐藏，可从“已移出客户”恢复。`,
      )
    )
      return;
    await api("customer_delete", {
      id: customer.id,
      base_revision: customer.revision,
    });
    customerOffset = projectOffset = 0;
    clearCustomerSelection();
    await customers();
    await deletedCustomers();
    await library();
    message(`客户 ${customer.name} 已移出，可随时恢复。`);
  });
$("customer-trash-toggle").onclick = () =>
  run(async () => {
    $("customer-trash").hidden = !$("customer-trash").hidden;
    customerTrashOffset = 0;
    await deletedCustomers();
  });
$("customer-trash-prev").onclick = () =>
  run(async () => {
    if (customerTrashOffset === 0) return;
    customerTrashOffset = Math.max(0, customerTrashOffset - 20);
    await deletedCustomers();
  });
$("customer-trash-next").onclick = () =>
  run(async () => {
    if (customerTrashOffset + 20 >= customerTrashTotal) return;
    customerTrashOffset += 20;
    await deletedCustomers();
  });
$("sales-project-create").onclick = () =>
  run(async () => {
    if (!selectedCustomer) throw Error("请先选择客户，再创建设计项目。");
    if (!discard({ project: false })) return;
    const values = projectForm();
    if (!values.name) throw Error("请填写项目名称。");
    const project = await api("project_create", {
      customer_id: selectedCustomer.id,
      ...values,
    });
    selectedProject = project;
    projectFormBaseline = JSON.stringify(projectForm());
    projectOffset = 0;
    $("selected-project").textContent = project.name;
    $("scene-scope-label").textContent = "项目方案";
    clearScene();
    await projects();
    await library();
    await quotes.load();
    await orders.load();
    message(`项目 ${project.name} 已建立，可以新建方案。`);
  });
$("sales-project-edit").onclick = () =>
  run(async () => {
    if (!selectedProject) throw Error("请先选择要更新的项目。");
    const values = projectForm();
    if (!values.name) throw Error("请填写项目名称。");
    const project = await api("project_update", {
      id: selectedProject.id,
      base_revision: selectedProject.revision,
      ...values,
    });
    selectedProject = project;
    projectFormBaseline = JSON.stringify(projectForm());
    $("selected-project").textContent = project.name;
    if (!active) $("project-title").textContent = project.name;
    await projects();
    message(`项目 ${project.name} 已更新。`);
  });
$("legacy").onclick = () =>
  run(async () => {
    if (!discard()) return;
    selectedProject = null;
    $("selected-project").textContent = "正在查看旧方案";
    $("sales-project-name").value = "";
    $("sales-project-address").value = "";
    $("sales-project-status").value = "draft";
    projectFormBaseline = JSON.stringify(projectForm());
    $("scene-scope-label").textContent = "旧方案";
    clearScene();
    await library();
    message("正在查看迁移前的旧方案；原资料未改变。");
  });
$("customer-prev").onclick = () =>
  run(async () => {
    customerOffset = Math.max(0, customerOffset - 20);
    await customers();
  });
$("customer-next").onclick = () =>
  run(async () => {
    customerOffset += 20;
    await customers();
  });
$("sales-project-prev").onclick = () =>
  run(async () => {
    projectOffset = Math.max(0, projectOffset - 20);
    await projects();
  });
$("sales-project-next").onclick = () =>
  run(async () => {
    projectOffset += 20;
    await projects();
  });
$("new").onclick = () =>
  run(async () => {
    if (!discard()) return;
    const name = $("project-name").value.trim();
    if (!name) {
      message("请填写方案名称。", true);
      return;
    }
    const created = await api("create", { ...sceneScope(), name });
    active = { id: created.id, name };
    baseline = 0;
    draft = saved = null;
    history = null;
    historyOffset = 0;
    $("history-json").textContent = "";
    $("history-json-panel").open = false;
    $("project-title").textContent = name;
    refreshDraft();
    await library();
    await versions();
    message("方案已建立，请载入两室一厅示例。");
  });
$("sample").onclick = () =>
  run(async () => {
    if (!active) {
      message("请先新建或打开方案。", true);
      return;
    }
    if (!discard()) return;
    draft = (await api("sample", { ...sceneScope(), id: active.id })).scene;
    refreshDraft();
    message("示例已载入，尚未保存。");
  });
$("save").onclick = () =>
  run(async () => {
    if (!active || !draft) {
      message("请先载入或编辑场景。", true);
      return;
    }
    if (pendingJson() || pendingFurniture()) {
      message("请先应用输入框中的修改，再保存新版本。", true);
      return;
    }
    if (!dirty()) {
      message("当前内容已保存，无需再次保存。");
      return;
    }
    const version = await api("save", {
      ...sceneScope(),
      id: active.id,
      base_revision: baseline,
      scene: draft,
    });
    adopt(version);
    await versions();
    await library();
    message(`已保存 v${baseline}，资料在本机。`);
  });
$("add-furniture").onclick = () =>
  run(async () => {
    if (!draft) {
      message("请先载入场景，再放入家具。", true);
      return;
    }
    if (pendingJson() || pendingFurniture()) {
      message("请先应用输入框中的修改，再放入家具。", true);
      return;
    }
    const product = catalogItems.find(
      (item) => item.id === $("catalog-select").value,
    );
    const id = crypto.randomUUID();
    const candidate = addFurniture(draft, product, $("room-select").value, id);
    const validated = await api("validate", { scene: candidate });
    draft = validated.scene;
    refreshDraft();
    $("furniture-select").value = id;
    fields();
    message(`${product.name}已放入场景，请调整位置并保存新版本。`);
  });
$("apply-position").onclick = () =>
  run(async () => {
    if (!draft) {
      message("请先载入场景。", true);
      return;
    }
    if (pendingJson()) {
      message("请先应用高级场景 JSON，再调整家具位置。", true);
      return;
    }
    const x = Number($("furniture-x").value),
      y = Number($("furniture-y").value),
      rotation = Number($("furniture-rotation").value);
    if (
      [
        $("furniture-x").value,
        $("furniture-y").value,
        $("furniture-rotation").value,
      ].some((x) => x.trim() === "")
    )
      throw Error("请填写完整的位置与角度。");
    const candidate = editFurniture(draft, $("furniture-select").value, {
      x,
      y,
      rotation,
    });
    await api("validate", { scene: candidate });
    draft = candidate;
    refreshDraft();
    message("家具位置已更新，请保存新版本。");
  });
$("remove-furniture").onclick = () =>
  run(async () => {
    if (!draft) throw Error("请先载入场景。");
    if (pendingJson() || pendingFurniture())
      throw Error("请先应用输入框中的修改，再删除家具。");
    const id = $("furniture-select").value;
    const item = draft.furniture_instances.find(
      (furniture) => furniture.id === id,
    );
    if (!item) throw Error("请先选择要删除的家具。");
    if (
      !confirm(
        `确定从当前草稿删除 ${item.metadata?.name ?? "当前家具"} 吗？请保存新版本，之前保存的版本仍保留。`,
      )
    )
      return;
    const candidate = removeFurniture(draft, id);
    const validated = await api("validate", { scene: candidate });
    draft = validated.scene;
    refreshDraft();
    message("当前家具已从草稿删除，请保存新版本；之前保存的版本仍保留。");
  });
$("furniture-select").onchange = () => {
  if (pendingFurniture() && !confirm("位置输入尚未应用，确定放弃吗？")) {
    $("furniture-select").value = furnitureFieldsBaseline.selection;
    return;
  }
  fields();
};
mountFurnitureGestures({
  canvas: $("viewport").querySelector("canvas"),
  renderer: view,
  getScene: () => draft,
  getSelectedId: () => $("furniture-select").value,
  canEdit: () =>
    Boolean(draft && !busy && !pendingJson() && !pendingFurniture()),
  onSelect: (id) => {
    if (pendingFurniture()) return;
    $("furniture-select").value = id;
    fields();
  },
  onCommit: (id, pose, start) =>
    run(async () => {
      try {
        const candidate = editFurniture(draft, id, pose);
        const validated = await api("validate", { scene: candidate });
        draft = validated.scene;
        $("furniture-select").value = id;
        refreshDraft();
        $("gesture-hint").textContent = "家具已调整，请保存新版本。";
        message("家具已调整，请保存新版本。");
      } catch (error) {
        view.previewPose(id, start);
        throw error;
      }
    }),
  onHint: (text, error) => {
    $("gesture-hint").textContent = text;
    $("gesture-hint").classList.toggle("error", error);
  },
  wallGap: nearestWallGapMm,
});
$("apply-json").onclick = () =>
  run(async () => {
    if (pendingFurniture()) {
      message("请先更新家具位置，再应用高级场景 JSON。", true);
      return;
    }
    let candidate;
    try {
      candidate = JSON.parse($("scene-json").value);
    } catch {
      throw Error("输入不是合法 JSON，请检查后重试。");
    }
    const validated = await api("validate", { scene: candidate });
    draft = validated.scene;
    refreshDraft();
    message("场景已更新，请保存新版本。");
  });
$("restore").onclick = () => {
  if (busy || !history || !active) {
    message("请先查看一个历史版本。", true);
    return;
  }
  restoreIntent = {
    ...sceneScope(),
    id: active.id,
    base_revision: baseline,
    revision: history.revision,
  };
  $("restore-dialog").showModal();
};
$("cancel-restore").onclick = () => {
  $("restore-dialog").close();
  restoreIntent = null;
};
$("confirm-restore").onclick = () =>
  run(async () => {
    const intent = restoreIntent;
    $("restore-dialog").close();
    if (!intent) return;
    const version = await api("restore", intent);
    adopt(version);
    await versions();
    await library();
    restoreIntent = null;
    message(`已恢复为 v${baseline}，原版本仍保留。`);
  });
$("library-prev").onclick = () =>
  run(async () => {
    libraryOffset = Math.max(0, libraryOffset - 20);
    await library();
  });
$("library-next").onclick = () =>
  run(async () => {
    libraryOffset += 20;
    await library();
  });
$("history-prev").onclick = () =>
  run(async () => {
    historyOffset = Math.max(0, historyOffset - 20);
    await versions();
  });
$("history-next").onclick = () =>
  run(async () => {
    historyOffset += 20;
    await versions();
  });
$("interior").onclick = () => view.interior();
$("overview").onclick = () => view.overview();
$("capture").onclick = () => {
  if (!draft) {
    message("请先载入场景。", true);
    return;
  }
  const link = document.createElement("a");
  link.href = view.capture();
  link.download = `家居效果图-${Date.now()}.png`;
  link.click();
  message("已导出当前实际渲染画面。");
};
window.addEventListener("beforeunload", (e) => {
  if (hasUnsavedChanges() || productsView.dirty()) {
    e.preventDefault();
    e.returnValue = "";
  }
});
for (const id of [
  "scene-json",
  "furniture-x",
  "furniture-y",
  "furniture-rotation",
])
  $(id).addEventListener("input", refreshRevision);
window.addEventListener("pagehide", () => view.dispose());
run(async () => {
  try {
    try {
      await loadCatalog();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await loadCatalog();
    }
  } catch (error) {
    message(`家具目录暂不可用：${error.message}`, true);
  }
  await library();
  await customers();
});
