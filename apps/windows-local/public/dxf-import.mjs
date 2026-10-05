import {
  buildDxfScene,
  calibrateMmPerUnit,
  suggestMmPerUnit,
} from "./dxf-scene.mjs";

const $ = (id) => document.getElementById(id);
const svg = (tag) =>
  document.createElementNS("http://www.w3.org/2000/svg", tag);

export function mountDxfImport({
  getActive,
  hasUnsavedChanges,
  setDraft,
  notify,
  run,
}) {
  let file = null;
  let analysis = null;
  let selectedSegment = null;
  let calibratedScale = null;
  const preview = $("dxf-preview");
  const roomLayer = $("dxf-room-layer");
  const wallLayer = $("dxf-wall-layer");
  const summary = $("dxf-summary");
  const suggestion = $("dxf-unit-suggestion");
  const scale = $("dxf-scale");
  const confirmUnits = $("dxf-confirm-units");
  const actualLength = $("dxf-length");

  function reset(clearFile = true) {
    file = analysis = selectedSegment = calibratedScale = null;
    if (clearFile) $("dxf-file").value = "";
    roomLayer.replaceChildren();
    wallLayer.replaceChildren();
    preview.replaceChildren();
    summary.textContent = suggestion.textContent = scale.textContent = "";
    confirmUnits.checked = false;
    actualLength.value = "";
  }

  function showScale() {
    calibratedScale = null;
    if (selectedSegment && actualLength.value.trim()) {
      try {
        calibratedScale = calibrateMmPerUnit(
          selectedSegment,
          Number(actualLength.value),
        );
      } catch (error) {
        scale.textContent = error.message;
        return;
      }
    }
    scale.textContent = calibratedScale
      ? `校准比例：1 图纸单位 = ${calibratedScale} mm`
      : selectedSegment
        ? `已选线长 ${Math.hypot(selectedSegment.end.x - selectedSegment.start.x, selectedSegment.end.y - selectedSegment.start.y).toFixed(3)} 图纸单位，请输入实际毫米长度。`
        : "可点击预览中的直线进行尺寸校准。";
  }

  function drawPreview() {
    preview.replaceChildren();
    if (!analysis) return;
    const roomPaths = analysis.closedPaths.filter(
      (path) => path.layer === roomLayer.value,
    );
    const lines = analysis.segments.filter(
      (segment) => !wallLayer.value || segment.layer === wallLayer.value,
    );
    const roomEdges = roomPaths.flatMap((path) =>
      path.points.map((start, i) => ({
        start,
        end: path.points[(i + 1) % path.points.length],
      })),
    );
    const points = [
      ...roomPaths.flatMap((path) => path.points),
      ...lines.flatMap((line) => [line.start, line.end]),
    ];
    if (!points.length) return;
    const xs = points.map((point) => point.x),
      ys = points.map((point) => point.y);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const width = Math.max(maxX - minX, 1),
      height = Math.max(maxY - minY, 1);
    const project = (point) => ({
      x: ((point.x - minX) / width) * 760 + 20,
      y: 420 - ((point.y - minY) / height) * 380,
    });
    preview.setAttribute("viewBox", "0 0 800 440");
    for (const path of roomPaths) {
      const polygon = svg("polygon");
      polygon.setAttribute(
        "points",
        path.points
          .map((p) => {
            const v = project(p);
            return `${v.x},${v.y}`;
          })
          .join(" "),
      );
      polygon.setAttribute("class", "dxf-room");
      preview.append(polygon);
    }
    for (const line of [...roomEdges, ...lines]) {
      const start = project(line.start),
        end = project(line.end);
      const element = svg("line");
      for (const [key, value] of Object.entries({
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
      }))
        element.setAttribute(key, String(value));
      element.setAttribute("class", "dxf-line");
      element.addEventListener("click", () => {
        preview
          .querySelectorAll(".dxf-selected")
          .forEach((node) => node.classList.remove("dxf-selected"));
        element.classList.add("dxf-selected");
        selectedSegment = line;
        showScale();
      });
      preview.append(element);
    }
  }

  async function upload(route, bytes) {
    let response;
    try {
      response = await fetch(route, {
        method: "POST",
        headers: { "content-type": "application/dxf" },
        body: bytes,
      });
    } catch {
      throw Error("本地 DXF 服务暂时不可用，请重试。");
    }
    const result = await response.json();
    if (!response.ok) throw Error(result.error || "DXF 文件处理失败。");
    return result.data;
  }

  $("dxf-open").onclick = () => {
    if (!getActive()) return notify("请先新建或打开方案。", true);
    $("dxf-import").hidden = !$("dxf-import").hidden;
  };
  $("dxf-file").onchange = async () => {
    const selected = $("dxf-file").files[0] ?? null;
    reset(false);
    file = selected;
    if (!file) return;
    try {
      if (!/\.dxf$/i.test(file.name) || file.size > 8 * 1024 * 1024)
        throw Error("请选择不超过 8 MiB 的 DXF 文件。");
      const bytes = await file.arrayBuffer();
      analysis = await upload("/api/dxf/analyze", bytes);
      for (const layer of analysis.layers) {
        const roomOption = new Option(layer, layer);
        roomLayer.append(roomOption);
        wallLayer.append(new Option(layer, layer));
      }
      wallLayer.prepend(new Option("按房间轮廓生成", ""));
      wallLayer.value = "";
      roomLayer.value = analysis.closedPaths[0]?.layer ?? "";
      const suggested = suggestMmPerUnit(analysis.unitsCode);
      suggestion.textContent = suggested
        ? `图纸单位建议：1 图纸单位 = ${suggested} mm。请核对后勾选确认；或点选线段校准。`
        : "图纸单位不明，必须点选线段并输入实际毫米长度。";
      summary.textContent = `${analysis.closedPaths.length} 个闭合轮廓 · ${analysis.segments.length} 条直线 · ${analysis.skipped} 个不支持实体`;
      drawPreview();
      showScale();
    } catch (error) {
      analysis = null;
      notify(error.message || "DXF 解析失败。", true);
    }
  };
  roomLayer.onchange = drawPreview;
  wallLayer.onchange = drawPreview;
  actualLength.oninput = showScale;
  $("dxf-import-button").onclick = () =>
    run(async () => {
      if (!getActive() || !analysis || !file)
        throw Error("请先选择并预览 DXF 户型。");
      if (
        hasUnsavedChanges() &&
        !confirm("当前方案有未保存修改，确定用 DXF 草稿替换吗？")
      )
        return;
      const mmPerUnit =
        calibratedScale ??
        (confirmUnits.checked ? suggestMmPerUnit(analysis.unitsCode) : null);
      if (!mmPerUnit) throw Error("请确认图纸单位，或用已知线段校准尺寸。");
      const scene = buildDxfScene(analysis, {
        roomLayer: roomLayer.value,
        wallLayer: wallLayer.value,
        mmPerUnit,
        sourceSha256: analysis.sha256,
      });
      const bytes = await file.arrayBuffer();
      const archived = await upload("/api/dxf/archive", bytes);
      if (archived.sha256 !== analysis.sha256)
        throw Error("源文件与预览不一致，请重新选择 DXF。");
      await setDraft(scene);
      $("dxf-import").hidden = true;
      notify(
        `已从 ${file.name} 生成 3D 草稿，墙厚和层高为估算值，请保存新版本。`,
      );
    });
  return { reset };
}
