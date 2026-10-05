const unitFactors = { 4: 1, 5: 10, 6: 1000 };
const finitePoint = (point) =>
  point && Number.isFinite(point.x) && Number.isFinite(point.y);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rounded = (value) => Math.round(value * 1000) / 1000;

export function suggestMmPerUnit(unitsCode) {
  return unitFactors[unitsCode] ?? null;
}

export function calibrateMmPerUnit(segment, actualLengthMm) {
  const length =
    finitePoint(segment?.start) && finitePoint(segment?.end)
      ? distance(segment.start, segment.end)
      : 0;
  if (
    !Number.isFinite(actualLengthMm) ||
    actualLengthMm <= 0 ||
    !Number.isFinite(length) ||
    length <= 0
  )
    throw Error("请选择非零线段并填写实际毫米长度。");
  const scale = actualLengthMm / length;
  if (!Number.isFinite(scale) || scale < 0.001 || scale > 1_000_000)
    throw Error("校准比例超出合理范围，请检查实际长度。");
  return Math.round(scale * 1_000_000_000) / 1_000_000_000;
}

function signedArea(points) {
  return points.reduce((area, point, index) => {
    const next = points[(index + 1) % points.length];
    return area + point.x * next.y - next.x * point.y;
  }, 0);
}

function orientation(a, b, c) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function crosses(a, b, c, d) {
  const ab1 = orientation(a, b, c),
    ab2 = orientation(a, b, d),
    cd1 = orientation(c, d, a),
    cd2 = orientation(c, d, b);
  return ab1 * ab2 < 0 && cd1 * cd2 < 0;
}

function validBoundary(points) {
  if (
    points.length < 3 ||
    new Set(points.map((p) => `${p.x},${p.y}`)).size !== points.length
  )
    return false;
  if (Math.abs(signedArea(points)) < 0.001) return false;
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    if (distance(a, b) < 0.001) return false;
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue;
      if (crosses(a, b, points[j], points[(j + 1) % points.length]))
        return false;
    }
  }
  return true;
}

function edgeKey(a, b) {
  const first = `${a.x},${a.y}`,
    second = `${b.x},${b.y}`;
  return [first, second].sort().join("|");
}

export function buildDxfScene(analysis, options) {
  const {
    roomLayer,
    wallLayer,
    mmPerUnit,
    sourceSha256,
    wallThicknessMm = 200,
    floorHeightMm = 2800,
    id = () => crypto.randomUUID(),
  } = options;
  if (!Number.isFinite(mmPerUnit) || mmPerUnit < 0.001 || mmPerUnit > 1_000_000)
    throw Error("请先确认或校准 DXF 比例。");
  if (
    !Number.isFinite(wallThicknessMm) ||
    wallThicknessMm <= 0 ||
    !Number.isFinite(floorHeightMm) ||
    floorHeightMm <= 0
  )
    throw Error("墙厚或层高无效。");
  if (!/^[a-f0-9]{64}$/.test(sourceSha256 || ""))
    throw Error("DXF 来源校验值无效。");
  const sourceRooms =
    analysis?.closedPaths?.filter((path) => path.layer === roomLayer) ?? [];
  if (!sourceRooms.length) throw Error("所选图层没有闭合房间轮廓。");
  const sourcePoints = sourceRooms.flatMap((path) => path.points);
  if (!sourcePoints.every(finitePoint)) throw Error("房间轮廓坐标无效。");
  const origin = {
    x: Math.min(...sourcePoints.map((p) => p.x)),
    y: Math.min(...sourcePoints.map((p) => p.y)),
  };
  const convert = (point) => ({
    x: rounded((point.x - origin.x) * mmPerUnit),
    y: rounded((point.y - origin.y) * mmPerUnit),
  });
  const floorId = id();
  const rooms = sourceRooms.map((path, index) => {
    let boundary = path.points.map(convert);
    if (!validBoundary(boundary))
      throw Error(`第 ${index + 1} 个房间轮廓无效。`);
    if (signedArea(boundary) < 0) boundary = boundary.reverse();
    return {
      id: id(),
      floor_id: floorId,
      name: `房间 ${index + 1}`,
      boundary,
      metadata: {},
    };
  });
  const sourceWalls = wallLayer
    ? analysis.segments.filter((segment) => segment.layer === wallLayer)
    : rooms.flatMap((room) =>
        room.boundary.map((start, index) => ({
          start,
          end: room.boundary[(index + 1) % room.boundary.length],
          layer: roomLayer,
        })),
      );
  if (!sourceWalls.length) throw Error("所选墙体图层没有可用直线。");
  const seen = new Set(),
    walls = [];
  for (const source of sourceWalls) {
    if (!finitePoint(source.start) || !finitePoint(source.end))
      throw Error("墙体坐标无效。");
    const start = wallLayer ? convert(source.start) : source.start;
    const end = wallLayer ? convert(source.end) : source.end;
    if (distance(start, end) < 0.001) continue;
    const key = edgeKey(start, end);
    if (seen.has(key)) continue;
    seen.add(key);
    walls.push({
      id: id(),
      floor_id: floorId,
      start,
      end,
      thickness_mm: wallThicknessMm,
      height_mm: floorHeightMm,
      metadata: {},
    });
  }
  if (!walls.length) throw Error("没有可用墙体。");
  return {
    schema_version: "1.0.0",
    scene_id: id(),
    units: "mm",
    coordinate_system: "RH_Z_UP",
    floors: [
      {
        id: floorId,
        name: "一层",
        elevation_mm: 0,
        height_mm: floorHeightMm,
        metadata: {},
      },
    ],
    rooms,
    walls,
    doors: [],
    windows: [],
    columns: [],
    beams: [],
    electrical_points: [],
    plumbing_points: [],
    furniture_instances: [],
    metadata: {
      source_format: "dxf",
      source_sha256: sourceSha256,
      source_units_code: analysis.unitsCode,
      mm_per_dxf_unit: mmPerUnit,
      source_origin: origin,
      estimated_wall_thickness_mm: wallThicknessMm,
      estimated_floor_height_mm: floorHeightMm,
    },
  };
}
