import { RoomRenderer } from "./renderer.mjs";
import { addFurniture, editFurniture } from "./scene-tools.mjs";
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
  catalogItems = [];
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
function hasUnsavedChanges() {
  return Boolean(dirty() || pendingJson() || pendingFurniture());
}
function refreshRevision() {
  $("revision").textContent = active
    ? (baseline ? `当前 v${baseline}` : "未保存") +
      (hasUnsavedChanges() ? " · 有未保存修改" : "")
    : "未保存";
}
function discard() {
  return !hasUnsavedChanges() || confirm("还有未保存的修改，确定放弃吗？");
}
async function api(action, fields = {}) {
  const response = await fetch("/api/local", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, ...fields }),
  });
  let body;
  try {
    body = await response.json();
  } catch {
    throw Error("本地服务暂时不可用，请重新打开软件。");
  }
  if (!response.ok) throw Error(body.error ?? "操作失败，请重试。");
  return body.data;
}
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
async function loadCatalog() {
  catalogItems = await api("catalog");
  view.configureCatalog(catalogItems);
  $("catalog-select").replaceChildren();
  for (const product of catalogItems) {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = product.name;
    $("catalog-select").append(option);
  }
}
async function library() {
  const page = await api("list", { limit: 20, offset: libraryOffset });
  $("library-count").textContent = `共 ${page.total} 个`;
  $("library-items").replaceChildren();
  for (const item of page.items) {
    const element = button(item.name, async () => {
      if (!discard()) return;
      const current = await api("current", { id: item.id });
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
$("new").onclick = () =>
  run(async () => {
    if (!discard()) return;
    const name = $("project-name").value.trim();
    if (!name) {
      message("请填写方案名称。", true);
      return;
    }
    const created = await api("create", { name });
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
    draft = (await api("sample", { id: active.id })).scene;
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
$("furniture-select").onchange = () => {
  if (pendingFurniture() && !confirm("位置输入尚未应用，确定放弃吗？")) {
    $("furniture-select").value = furnitureFieldsBaseline.selection;
    return;
  }
  fields();
};
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
  if (hasUnsavedChanges()) {
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
    await loadCatalog();
  } catch (error) {
    message(`演示家具目录暂不可用：${error.message}`, true);
  }
  await library();
});
