export function renderPosition(point, elevation = 0) {
  return [point.x / 1000, ((point.z ?? 0) + elevation) / 1000, -point.y / 1000];
}
export function editFurniture(scene, id, { x, y, rotation }) {
  if (
    ![x, y, rotation].every(Number.isFinite) ||
    Math.abs(x) > 1000000 ||
    Math.abs(y) > 1000000 ||
    Math.abs(rotation) > 36000
  )
    throw Error("位置或角度不合法");
  const copy = structuredClone(scene),
    item = copy.furniture_instances.find((x) => x.id === id);
  if (!item) throw Error("找不到家具");
  item.position.x = x;
  item.position.y = y;
  item.rotation_deg = ((rotation % 360) + 360) % 360;
  validateFurniturePlacement(copy, item);
  return copy;
}
function footprint(item) {
  const angle = ((item.rotation_deg ?? 0) * Math.PI) / 180;
  const width = { x: Math.cos(angle), y: Math.sin(angle) };
  const depth = { x: -Math.sin(angle), y: Math.cos(angle) };
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) => ({
    x:
      item.position.x +
      ((sx * item.width_mm) / 2) * width.x +
      ((sy * item.depth_mm) / 2) * depth.x,
    y:
      item.position.y +
      ((sx * item.width_mm) / 2) * width.y +
      ((sy * item.depth_mm) / 2) * depth.y,
  }));
}
function overlap(a, b, clearance = 100) {
  const axes = [a, b].flatMap((points) =>
    [0, 1].map((i) => {
      const start = points[i],
        end = points[i + 1];
      return { x: end.y - start.y, y: start.x - end.x };
    }),
  );
  return axes.every((axis) => {
    const projection = (points) =>
      points.map((p) => p.x * axis.x + p.y * axis.y);
    const pa = projection(a),
      pb = projection(b);
    const margin = clearance * Math.hypot(axis.x, axis.y);
    return (
      Math.max(...pa) + margin > Math.min(...pb) &&
      Math.max(...pb) + margin > Math.min(...pa)
    );
  });
}
function validateFurniturePlacement(scene, item) {
  const room = scene.rooms?.find((value) => value.id === item.room_id);
  if (!room) return;
  const corners = footprint(item);
  if (!corners.every((corner) => insidePolygon(corner, room.boundary)))
    throw Error("家具不能超出房间边界。");
  for (let i = 0; i < corners.length; i++)
    for (let j = 0; j < room.boundary.length; j++)
      if (
        crossing(
          corners[i],
          corners[(i + 1) % 4],
          room.boundary[j],
          room.boundary[(j + 1) % room.boundary.length],
        )
      )
        throw Error("家具不能穿过房间边界。");
  if (
    scene.furniture_instances.some(
      (other) =>
        other.id !== item.id &&
        other.room_id === item.room_id &&
        overlap(corners, footprint(other)),
    )
  )
    throw Error("家具与其他家具碰撞，请调整位置。");
}
export function nearestWallGapMm(scene, id, pose = null) {
  const original = scene.furniture_instances.find((value) => value.id === id);
  const item =
    pose && original
      ? {
          ...original,
          position: { ...original.position, x: pose.x, y: pose.y },
          rotation_deg: pose.rotation,
        }
      : original;
  const room = scene.rooms?.find((value) => value.id === item?.room_id);
  if (!item || !room) return null;
  const angle = ((item.rotation_deg ?? 0) * Math.PI) / 180;
  let gap = Infinity;
  for (let i = 0; i < room.boundary.length; i++) {
    const a = room.boundary[i],
      b = room.boundary[(i + 1) % room.boundary.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!length) continue;
    const normal = { x: (b.y - a.y) / length, y: (a.x - b.x) / length };
    const fromCenter = Math.abs(
      (item.position.x - a.x) * normal.x + (item.position.y - a.y) * normal.y,
    );
    const radius =
      (item.width_mm / 2) *
        Math.abs(normal.x * Math.cos(angle) + normal.y * Math.sin(angle)) +
      (item.depth_mm / 2) *
        Math.abs(-normal.x * Math.sin(angle) + normal.y * Math.cos(angle));
    gap = Math.min(gap, fromCenter - radius);
  }
  return Number.isFinite(gap) ? gap : null;
}
function insidePolygon(point, boundary) {
  let inside = false;
  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const a = boundary[i],
      b = boundary[j];
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}
function crossing(a, b, c, d) {
  const side = (p, q, r) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}
function insideRoom(center, width, depth, boundary) {
  const corners = [
    { x: center.x - width / 2, y: center.y - depth / 2 },
    { x: center.x + width / 2, y: center.y - depth / 2 },
    { x: center.x + width / 2, y: center.y + depth / 2 },
    { x: center.x - width / 2, y: center.y + depth / 2 },
  ];
  if (!corners.every((point) => insidePolygon(point, boundary))) return false;
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < boundary.length; j++)
      if (
        crossing(
          corners[i],
          corners[(i + 1) % 4],
          boundary[j],
          boundary[(j + 1) % boundary.length],
        )
      )
        return false;
  return true;
}
function availableCoordinates(start, end) {
  if (end < start) return [];
  if (end === start) return [start];
  const steps = Math.min(24, Math.ceil((end - start) / 250));
  return Array.from({ length: steps + 1 }, (_, i) =>
    Math.round(start + ((end - start) * i) / steps),
  );
}
function collides(center, product, item) {
  const radians = ((item.rotation_deg ?? 0) * Math.PI) / 180;
  const halfWidth =
    (Math.abs(Math.cos(radians)) * item.width_mm +
      Math.abs(Math.sin(radians)) * item.depth_mm) /
    2;
  const halfDepth =
    (Math.abs(Math.sin(radians)) * item.width_mm +
      Math.abs(Math.cos(radians)) * item.depth_mm) /
    2;
  return (
    Math.abs(center.x - item.position.x) <
      product.width_mm / 2 + halfWidth + 100 &&
    Math.abs(center.y - item.position.y) <
      product.depth_mm / 2 + halfDepth + 100
  );
}
export function addFurniture(scene, product, roomId, instanceId) {
  const room = scene.rooms?.find((item) => item.id === roomId);
  if (!room || !product || !instanceId || !product.id)
    throw Error("请选择房间和家具后重试。");
  if (scene.furniture_instances.some((item) => item.id === instanceId))
    throw Error("家具标识重复，请重试。");
  const sizes = [product.width_mm, product.depth_mm, product.height_mm];
  if (!sizes.every((value) => Number.isFinite(value) && value > 0))
    throw Error("家具尺寸不合法。");
  const center = room.boundary.reduce(
    (point, corner) => ({ x: point.x + corner.x, y: point.y + corner.y }),
    { x: 0, y: 0 },
  );
  center.x /= room.boundary.length;
  center.y /= room.boundary.length;
  const occupied = scene.furniture_instances.filter(
    (item) => item.room_id === roomId,
  );
  const xs = room.boundary.map((point) => point.x);
  const ys = room.boundary.map((point) => point.y);
  const target = occupied.length
    ? {
        x:
          center.x +
          (occupied.length % 2 ? -1 : 1) *
            Math.min(1400, (Math.max(...xs) - Math.min(...xs)) / 3),
        y: center.y - Math.min(1400, (Math.max(...ys) - Math.min(...ys)) / 3),
      }
    : center;
  const choices = availableCoordinates(
    Math.min(...xs) + product.width_mm / 2 + 100,
    Math.max(...xs) - product.width_mm / 2 - 100,
  ).flatMap((x) =>
    availableCoordinates(
      Math.min(...ys) + product.depth_mm / 2 + 100,
      Math.max(...ys) - product.depth_mm / 2 - 100,
    ).map((y) => ({ x, y })),
  );
  choices.push({ x: Math.round(center.x), y: Math.round(center.y) });
  choices.sort(
    (a, b) =>
      (a.x - target.x) ** 2 +
        (a.y - target.y) ** 2 -
        (b.x - target.x) ** 2 -
        (b.y - target.y) ** 2 ||
      a.x - b.x ||
      a.y - b.y,
  );
  const position = choices.find(
    (candidate) =>
      insideRoom(
        candidate,
        product.width_mm,
        product.depth_mm,
        room.boundary,
      ) && occupied.every((item) => !collides(candidate, product, item)),
  );
  if (!position)
    throw Error(
      "这个房间没有足够空间放入该家具，请选择更大的房间或调整已有家具。",
    );
  const copy = structuredClone(scene);
  copy.furniture_instances.push({
    metadata: { name: product.name, offline_catalog_only: !product.asset_id },
    id: instanceId,
    floor_id: room.floor_id,
    room_id: room.id,
    product_id: product.id,
    asset_id: product.asset_id ?? null,
    position: { ...position, z: 0 },
    width_mm: product.width_mm,
    depth_mm: product.depth_mm,
    height_mm: product.height_mm,
    rotation_deg: 0,
  });
  return copy;
}
export function wallSegments(wall, openings) {
  const length = Math.hypot(
    wall.end.x - wall.start.x,
    wall.end.y - wall.start.y,
  );
  const cuts = openings
    .filter((x) => x.wall_id === wall.id)
    .sort((a, b) => a.offset_mm - b.offset_mm);
  const output = [];
  let cursor = 0;
  const add = (start, end, bottom, top) => {
    if (end > start && top > bottom) output.push({ start, end, bottom, top });
  };
  for (const cut of cuts) {
    const start = Math.max(cursor, Math.min(length, cut.offset_mm)),
      end = Math.min(length, start + cut.width_mm);
    add(cursor, start, 0, wall.height_mm);
    add(start, end, 0, cut.sill_height_mm);
    add(start, end, cut.sill_height_mm + cut.height_mm, wall.height_mm);
    cursor = end;
  }
  add(cursor, length, 0, wall.height_mm);
  return output;
}
