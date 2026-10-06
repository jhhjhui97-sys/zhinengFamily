import { normalizeFinish } from "./finish-catalog.mjs";

function edgeCoverage(room, wall, start, end) {
  if (room.floor_id !== wall.floor_id) return null;
  const dx = wall.end.x - wall.start.x,
    dy = wall.end.y - wall.start.y;
  const length = Math.hypot(dx, dy);
  if (!length) return null;
  const tolerance = Math.max(5, (wall.thickness_mm ?? 0) / 2 + 5);
  const ex = end.x - start.x,
    ey = end.y - start.y,
    edgeLength = Math.hypot(ex, ey);
  if (!edgeLength || Math.abs(dx * ey - dy * ex) > length * edgeLength * 0.001)
    return null;
  const gap =
    Math.abs(ex * (wall.start.y - start.y) - ey * (wall.start.x - start.x)) /
    edgeLength;
  if (gap > tolerance) return null;
  const a =
    ((wall.start.x - start.x) * ex + (wall.start.y - start.y) * ey) /
    edgeLength;
  const b =
    ((wall.end.x - start.x) * ex + (wall.end.y - start.y) * ey) / edgeLength;
  const low = Math.max(0, Math.min(a, b)),
    high = Math.min(edgeLength, Math.max(a, b));
  return high - low > 1
    ? { low, high, direction: Math.sign(dx * ex + dy * ey) }
    : null;
}

function matchingEdge(room, wall) {
  for (let index = 0; index < room.boundary.length; index++) {
    const start = room.boundary[index],
      end = room.boundary[(index + 1) % room.boundary.length];
    const coverage = edgeCoverage(room, wall, start, end);
    if (coverage) return coverage;
  }
  return null;
}

export function roomWalls(scene, roomId) {
  const room = scene.rooms.find((value) => value.id === roomId);
  if (!room) throw Error("找不到装修房间。");
  return scene.walls.filter((wall) => matchingEdge(room, wall));
}

export function missingRoomWallEdges(scene, roomId) {
  const room = scene.rooms.find((value) => value.id === roomId);
  if (!room) throw Error("找不到装修房间。");
  const missing = [];
  for (let index = 0; index < room.boundary.length; index++) {
    const start = room.boundary[index],
      end = room.boundary[(index + 1) % room.boundary.length];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (!length) continue;
    const covered = scene.walls
      .map((wall) => edgeCoverage(room, wall, start, end))
      .filter(Boolean)
      .sort((a, b) => a.low - b.low);
    const at = (distance) => ({
      x: start.x + ((end.x - start.x) * distance) / length,
      y: start.y + ((end.y - start.y) * distance) / length,
    });
    let cursor = 0;
    for (const interval of covered) {
      if (interval.low - cursor > 1)
        missing.push({ start: at(cursor), end: at(interval.low) });
      cursor = Math.max(cursor, interval.high);
    }
    if (length - cursor > 1)
      missing.push({ start: at(cursor), end: at(length) });
  }
  return missing;
}

function targetRoom(scene, target) {
  if (!target || !["wall", "floor"].includes(target.surface))
    throw Error("请选择墙面或地面。");
  const room = scene.rooms.find((value) => value.id === target.roomId);
  if (!room) throw Error("找不到装修房间。");
  if (target.wallId) {
    if (target.surface === "floor") throw Error("地面装修按房间选择。");
    const wall = scene.walls.find((value) => value.id === target.wallId);
    if (!wall || !matchingEdge(room, wall))
      throw Error("这面墙不属于所选房间。");
  }
  return room;
}

function finishRecord(room) {
  const record = room.metadata?.surface_finishes;
  if (record && record.version !== 1) throw Error("不支持的装修记录版本。");
  return record;
}

export function setSurfaceFinish(scene, target, input) {
  const room = targetRoom(scene, target),
    finish = normalizeFinish(input, target.surface);
  finishRecord(room);
  const copy = structuredClone(scene),
    changed = copy.rooms.find((value) => value.id === room.id);
  changed.metadata ??= {};
  const record = (changed.metadata.surface_finishes ??= { version: 1 });
  if (target.wallId)
    record.wall_overrides = {
      ...record.wall_overrides,
      [target.wallId]: finish,
    };
  else record[target.surface === "wall" ? "walls" : "floor"] = finish;
  return copy;
}

export function clearSurfaceFinish(scene, target) {
  const room = targetRoom(scene, target);
  finishRecord(room);
  const copy = structuredClone(scene),
    changed = copy.rooms.find((value) => value.id === room.id);
  const record = changed.metadata?.surface_finishes;
  if (!record) return copy;
  if (target.wallId) {
    delete record.wall_overrides?.[target.wallId];
    if (!Object.keys(record.wall_overrides ?? {}).length)
      delete record.wall_overrides;
  } else delete record[target.surface === "wall" ? "walls" : "floor"];
  if (Object.keys(record).length === 1)
    delete changed.metadata.surface_finishes;
  return copy;
}

export function finishForSurface(scene, target) {
  const room = targetRoom(scene, target),
    record = finishRecord(room);
  const override =
    target.wallId && Object.hasOwn(record?.wall_overrides ?? {}, target.wallId)
      ? record.wall_overrides[target.wallId]
      : null;
  const value =
    override ?? record?.[target.surface === "wall" ? "walls" : "floor"];
  return value ? normalizeFinish(value, target.surface) : null;
}

export function wallFinishSides(scene, wallId) {
  const wall = scene.walls.find((value) => value.id === wallId);
  if (!wall) throw Error("找不到装修墙面。");
  const sides = { left: null, right: null };
  for (const room of scene.rooms) {
    const edge = matchingEdge(room, wall);
    if (!edge) continue;
    const area = room.boundary.reduce((sum, p, i) => {
      const next = room.boundary[(i + 1) % room.boundary.length];
      return sum + p.x * next.y - next.x * p.y;
    }, 0);
    const side = edge.direction * Math.sign(area) > 0 ? "left" : "right";
    sides[side] ??= {
      roomId: room.id,
      finish: finishForSurface(scene, {
        roomId: room.id,
        surface: "wall",
        wallId,
      }),
    };
  }
  return sides;
}

const modulo = (value, scale) => ((value % scale) + scale) % scale;
const fraction = (value) => value - Math.floor(value);
const noise = (x, y) => fraction(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
const rgb = (hex) =>
  [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
const mix = (a, b, amount) =>
  a.map((channel, i) =>
    Math.round(
      Math.max(0, Math.min(255, channel * (1 - amount) + b[i] * amount)),
    ),
  );

function tileCoordinate(finish, x, y) {
  const width = finish.width_mm,
    height = finish.height_mm;
  let u = x,
    v = y,
    index = Math.floor(x / width) + Math.floor(y / height),
    turn = false;
  if (finish.layout === "staggered")
    u += (modulo(Math.floor(y / height), 2) * width) / 2;
  if (finish.layout === "herringbone") {
    const length = Math.max(width, height),
      short = Math.min(width, height);
    const px = (x + y) / Math.SQRT2,
      py = (y - x) / Math.SQRT2;
    const baseRow = Math.floor((px + py) / (2 * length));
    // Rectangles repeat along (short,-short) and (length,length).
    // This tessellation preserves arbitrary plank proportions, including 600x400.
    for (let row = baseRow - 2; row <= baseRow + 1; row++) {
      const column = Math.ceil((length * row - py) / short - 1e-9);
      const localU = px - short * column - length * row;
      const localV = py + short * column - length * row;
      if (
        localU >= -1e-7 &&
        localU < length &&
        localV >= -1e-7 &&
        localV < short
      )
        return {
          u: Math.max(0, localU),
          v: Math.max(0, localV),
          index: modulo(column + row, 2),
          turn: false,
          edge: Math.min(localU, length - localU, localV, short - localV),
        };
      const verticalColumn = Math.floor(
        (px - length * row - length + short) / short + 1e-9,
      );
      const verticalU = py + short * verticalColumn - length * row - short;
      const verticalV =
        px - short * verticalColumn - length * row - length + short;
      if (
        verticalU >= -1e-7 &&
        verticalU < length &&
        verticalV >= -1e-7 &&
        verticalV < short
      )
        return {
          u: Math.max(0, verticalU),
          v: Math.max(0, verticalV),
          index: modulo(verticalColumn + row, 2),
          turn: true,
          edge: Math.min(
            verticalU,
            length - verticalU,
            verticalV,
            short - verticalV,
          ),
        };
    }
    throw Error("人字铺纹理坐标无法解析。");
  }
  if (finish.layout === "basketweave") {
    const span = Math.max(width, height),
      bx = Math.floor(x / span),
      by = Math.floor(y / span);
    turn = modulo(bx + by, 2) === 1;
    u = turn ? y : x;
    v = turn ? -x : y;
    index = bx + by;
  } else if (finish.layout === "chevron") {
    const row = Math.floor(y / height);
    turn = modulo(row, 2) === 1;
    u += (turn ? -1 : 1) * modulo(y, height);
    index = Math.floor(u / width) + row;
  }
  const localU = modulo(u, width),
    localV = modulo(v, height);
  let edge = Math.min(localU, width - localU, localV, height - localV);
  if (finish.layout === "hexagon") {
    const stepX = width * 0.75,
      stepY = height;
    const column = Math.round(x / stepX),
      row = Math.round((y - (modulo(column, 2) * height) / 2) / stepY);
    const px = Math.abs(x - column * stepX),
      py = Math.abs(y - (row * stepY + (modulo(column, 2) * height) / 2));
    edge = Math.min(
      height / 2 - py,
      width / 2 - px - (py * width) / (2 * height),
    );
    index = column + row;
  }
  return { u: localU, v: localV, index, turn, edge };
}

export function sampleFinishPixel(finish, uMm, vMm) {
  if (![uMm, vMm].every(Number.isFinite)) throw Error("纹理坐标不合法。");
  const angle = (finish.angle_deg * Math.PI) / 180;
  const x = uMm * Math.cos(angle) + vMm * Math.sin(angle),
    y = -uMm * Math.sin(angle) + vMm * Math.cos(angle);
  const tile = tileCoordinate(finish, x, y);
  const tiled = finish.layout !== "continuous";
  const alpha = 255; // Material opacity owns transparency; color maps stay opaque.
  if (tiled && tile.edge < finish.grout_mm / 2)
    return [...rgb(finish.grout_color), alpha];
  const base = rgb(finish.color),
    accent = rgb(finish.accent_color);
  const fine = noise(Math.floor(x / 2), Math.floor(y / 2));
  const sx =
      tile.u /
      (finish.layout === "herringbone"
        ? Math.max(finish.width_mm, finish.height_mm)
        : finish.width_mm),
    sy =
      tile.v /
      (finish.layout === "herringbone"
        ? Math.min(finish.width_mm, finish.height_mm)
        : finish.height_mm);
  let amount = 0;
  switch (finish.pattern) {
    case "plaster":
      amount = 0.03 + fine * 0.08;
      break;
    case "wood": {
      const grain = Math.sin(sy * 160 + Math.sin(sx * 15) * 1.3) * 0.5 + 0.5;
      amount = grain * 0.32 + noise(tile.index, 4) * 0.1;
      break;
    }
    case "stone": {
      const vein = Math.abs(
        Math.sin(sx * 11 + sy * 7 + Math.sin(sy * 16) * 1.5),
      );
      amount = vein < 0.09 ? 0.52 : fine * 0.055;
      break;
    }
    case "terrazzo": {
      const spot = noise(Math.floor(x / 10), Math.floor(y / 10));
      amount = spot > 0.74 ? 0.55 + spot * 0.35 : fine * 0.07;
      break;
    }
    case "wallpaper": {
      const stripe = Math.cos(sx * Math.PI * 8),
        motif = Math.sin(sx * Math.PI * 4) * Math.sin(sy * Math.PI * 4);
      amount = stripe > 0.85 || motif > 0.65 ? 0.65 : 0.03;
      break;
    }
    case "fabric":
      amount =
        (Math.sin(x * 2.5) > 0 ? 0.15 : 0.04) +
        (Math.sin(y * 2.5) > 0 ? 0.12 : 0.02);
      break;
    case "concrete":
      amount =
        noise(Math.floor(x / 25), Math.floor(y / 25)) * 0.12 + fine * 0.06;
      break;
    case "metal":
      amount = Math.sin(sy * 500) * 0.025 + 0.035;
      break;
    case "glass":
      amount = 0;
      break;
    case "carpet":
      amount = fine * 0.33 + noise(Math.floor(x / 8), Math.floor(y / 8)) * 0.1;
      break;
    case "brick":
      amount = noise(tile.index, 7) * 0.24 + fine * 0.12;
      break;
    case "mosaic":
      amount =
        noise(
          Math.floor(x / finish.width_mm),
          Math.floor(y / finish.height_mm),
        ) * 0.75;
      break;
    case "slat":
      amount = sx > 0.72 ? 0.92 : sx * 0.22;
      break;
    case "tile":
      amount = fine * 0.025;
      break;
  }
  if (finish.layout === "checkerboard" && modulo(tile.index, 2))
    amount = Math.max(amount, 0.7);
  return [...mix(base, accent, amount), alpha];
}

export function finishTextureData(input, size = 128) {
  if (!Number.isInteger(size) || size < 8 || size > 512)
    throw Error("纹理尺寸不合法。");
  const finish = normalizeFinish(input, input.surface);
  const unrotated = { ...finish, angle_deg: 0 };
  const factor = [
    "staggered",
    "checkerboard",
    "herringbone",
    "basketweave",
    "chevron",
    "hexagon",
  ].includes(finish.layout)
    ? 2
    : 1;
  const span = Math.max(finish.width_mm, finish.height_mm);
  const repeatWidth =
    finish.layout === "herringbone"
      ? Math.min(finish.width_mm, finish.height_mm) * Math.SQRT2 * 2
      : finish.layout === "basketweave"
        ? span * 2
        : finish.width_mm * factor;
  const repeatHeight =
    finish.layout === "herringbone"
      ? span * Math.SQRT2 * 2
      : finish.layout === "basketweave"
        ? span * 2
        : finish.height_mm * factor;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const value = sampleFinishPixel(
        unrotated,
        (x * repeatWidth) / size,
        (y * repeatHeight) / size,
      );
      data.set(value, (y * size + x) * 4);
    }
  return {
    data,
    width: size,
    height: size,
    repeat_width_mm: repeatWidth,
    repeat_height_mm: repeatHeight,
    angle_deg: finish.angle_deg,
  };
}

export function finishRenderSpec(input) {
  const finish = normalizeFinish(input, input.surface);
  return {
    color: finish.color,
    roughness: finish.roughness,
    metalness: finish.metalness,
    opacity: finish.opacity,
    transparent: finish.opacity < 1,
    texture: finishTextureData(finish),
  };
}
