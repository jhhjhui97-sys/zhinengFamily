import { parentPort } from "node:worker_threads";
import DxfParser from "dxf-parser";

const MAX_ENTITIES = 20_000;
const validPoint = (point) =>
  point &&
  Number.isFinite(point.x) &&
  Number.isFinite(point.y) &&
  Math.abs(point.x) <= 1e9 &&
  Math.abs(point.y) <= 1e9 &&
  (point.z == null || (Number.isFinite(point.z) && Math.abs(point.z) < 0.001));
const xy = (point) => ({ x: point.x, y: point.y });

function normalize(bytes) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw Error("请选择 UTF-8 文本 DXF 文件。");
  }
  if (
    text.includes("\0") ||
    text.startsWith("AutoCAD Binary DXF") ||
    !/\bSECTION\b/.test(text) ||
    !/\bEOF\s*$/.test(text)
  )
    throw Error("请选择有效的文本 DXF 文件。");

  const drawing = new DxfParser().parseSync(text);
  const entities = drawing?.entities;
  if (!Array.isArray(entities) || entities.length > MAX_ENTITIES)
    throw Error("DXF 图元过多或文件无效，请简化图纸。");

  const segments = [],
    closedPaths = [],
    layers = new Set();
  let skipped = 0;
  let primitiveCount = 0;
  const addSegment = (layer, start, end) => {
    if (!validPoint(start) || !validPoint(end)) {
      skipped++;
      return;
    }
    if (start.x === end.x && start.y === end.y) {
      skipped++;
      return;
    }
    segments.push({ layer, start: xy(start), end: xy(end) });
  };
  for (const entity of entities) {
    primitiveCount += Math.max(1, entity.vertices?.length ?? 1);
    if (primitiveCount > MAX_ENTITIES)
      throw Error("DXF 图元过多或文件无效，请简化图纸。");
    const layer = entity.layer || "0";
    layers.add(layer);
    if (entity.type === "LINE") {
      if (entity.vertices?.length === 2)
        addSegment(layer, entity.vertices[0], entity.vertices[1]);
      else skipped++;
      continue;
    }
    if (entity.type !== "LWPOLYLINE" && entity.type !== "POLYLINE") {
      skipped++;
      continue;
    }
    const points = entity.vertices;
    if (
      !Array.isArray(points) ||
      points.length < 2 ||
      entity.is3dPolyline ||
      entity.is3dPolygonMesh ||
      entity.isPolyfaceMesh ||
      points.some((point) => !validPoint(point) || point.bulge)
    ) {
      skipped++;
      continue;
    }
    if (entity.shape) {
      if (points.length < 3) {
        skipped++;
        continue;
      }
      closedPaths.push({ layer, points: points.map(xy) });
    } else {
      for (let i = 0; i + 1 < points.length; i++)
        addSegment(layer, points[i], points[i + 1]);
    }
  }
  if (!segments.length && !closedPaths.length)
    throw Error("DXF 中没有可用的二维直线或闭合轮廓。");
  return {
    unitsCode: Number.isInteger(drawing.header?.$INSUNITS)
      ? drawing.header.$INSUNITS
      : 0,
    layers: [...layers].sort((a, b) => a.localeCompare(b)),
    segments,
    closedPaths,
    skipped,
  };
}

parentPort.on("message", (bytes) => {
  try {
    parentPort.postMessage({ data: normalize(bytes) });
  } catch (error) {
    parentPort.postMessage({ error: error.message || "DXF 解析失败。" });
  }
});
