export function renderPosition(point, elevation = 0) {
  return [point.x / 1000, ((point.z ?? 0) + elevation) / 1000, -point.y / 1000];
}
export function editFurniture(scene, id, { x, y, z, rotation }) {
  const original = scene.furniture_instances.find((item) => item.id === id);
  if (!original) throw Error("找不到家具");
  z ??= original.position.z ?? 0;
  if (
    ![x, y, z, rotation].every(Number.isFinite) ||
    Math.abs(x) > 1000000 ||
    Math.abs(y) > 1000000 ||
    Math.abs(rotation) > 36000 ||
    z < 0 ||
    z > 1000000
  )
    throw Error("位置或角度不合法");
  const copy = structuredClone(scene),
    item = copy.furniture_instances.find((x) => x.id === id);
  if (!item) throw Error("找不到家具");
  item.position.x = x;
  item.position.y = y;
  item.position.z = z;
  item.rotation_deg = ((rotation % 360) + 360) % 360;
  validateFurniturePlacement(copy, item);
  return copy;
}
export function removeFurniture(scene, id) {
  const index = scene.furniture_instances.findIndex((item) => item.id === id);
  if (!id || index < 0) throw Error("找不到家具");
  const copy = structuredClone(scene);
  copy.furniture_instances.splice(index, 1);
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
const placementTolerance = 0.001;
function overlap(a, b, clearance = 0) {
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
    const margin =
      (clearance - placementTolerance) * Math.hypot(axis.x, axis.y);
    return (
      Math.max(...pa) + margin > Math.min(...pb) &&
      Math.max(...pb) + margin > Math.min(...pa)
    );
  });
}
function heightsOverlap(a, b) {
  const aBottom = a.position.z ?? 0,
    bBottom = b.position.z ?? 0;
  return (
    Math.min(
      aBottom + (a.height_mm ?? Infinity),
      bBottom + (b.height_mm ?? Infinity),
    ) -
      Math.max(aBottom, bBottom) >
    placementTolerance
  );
}
function validateFurniturePlacement(scene, item) {
  const floor = scene.floors?.find((value) => value.id === item.floor_id);
  if (
    (item.position.z ?? 0) < 0 ||
    (Number.isFinite(floor?.height_mm) &&
      Number.isFinite(item.height_mm) &&
      (item.position.z ?? 0) + item.height_mm >
        floor.height_mm + placementTolerance)
  )
    throw Error("家具高度不能低于地面或超出楼层高度。");
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
        heightsOverlap(item, other) &&
        overlap(corners, footprint(other)),
    )
  )
    throw Error("家具与其他家具碰撞，请调整位置。");
}
function projectionRange(points, axis) {
  const values = points.map((point) => point.x * axis.x + point.y * axis.y);
  return { min: Math.min(...values), max: Math.max(...values) };
}
function rangesOverlap(a, b) {
  return Math.min(a.max, b.max) - Math.max(a.min, b.min) > placementTolerance;
}
function furnitureAxes(item) {
  const angle = ((item.rotation_deg ?? 0) * Math.PI) / 180;
  return [
    { x: Math.cos(angle), y: Math.sin(angle) },
    { x: -Math.sin(angle), y: Math.cos(angle) },
  ];
}
function parallelFace(item, normal) {
  return furnitureAxes(item).some(
    (axis) =>
      Math.abs(Math.abs(axis.x * normal.x + axis.y * normal.y) - 1) < 1e-8,
  );
}
export function snapFurniturePose(
  scene,
  id,
  input,
  { thresholdMm = 50, mode = "all" } = {},
) {
  const original = scene.furniture_instances.find((item) => item.id === id);
  if (!original) throw Error("找不到家具");
  const pose = { ...input, z: input.z ?? original.position.z ?? 0 };
  if (
    ![pose.x, pose.y, pose.z, pose.rotation, thresholdMm].every(
      Number.isFinite,
    ) ||
    thresholdMm < 0 ||
    thresholdMm > 1000
  )
    throw Error("位置或吸附距离不合法。");
  const item = {
    ...original,
    position: { x: pose.x, y: pose.y, z: pose.z },
    rotation_deg: pose.rotation,
  };
  const corners = footprint(item),
    candidates = [];
  const add = (delta, normal, contact) => {
    const distance = Math.abs(delta);
    if (distance <= placementTolerance || distance > thresholdMm) return;
    const adjusted = normal
      ? { ...pose, x: pose.x + normal.x * delta, y: pose.y + normal.y * delta }
      : { ...pose, z: pose.z + delta };
    candidates.push({ pose: adjusted, contact, distance });
  };
  if (mode !== "move" && mode !== "rotate") {
    add(-pose.z, null, { kind: "floor", id: item.floor_id });
    const floor = scene.floors?.find((value) => value.id === item.floor_id);
    if (Number.isFinite(floor?.height_mm) && Number.isFinite(item.height_mm))
      add(floor.height_mm - item.height_mm - pose.z, null, {
        kind: "ceiling",
        id: item.floor_id,
      });
  }
  if (mode !== "height" && mode !== "rotate") {
    const room = scene.rooms?.find((value) => value.id === item.room_id);
    const orientation =
      Math.sign(
        (room?.boundary ?? []).reduce((area, point, index, boundary) => {
          const next = boundary[(index + 1) % boundary.length];
          return area + point.x * next.y - next.x * point.y;
        }, 0),
      ) || 1;
    for (let i = 0; i < (room?.boundary.length ?? 0); i++) {
      const a = room.boundary[i],
        b = room.boundary[(i + 1) % room.boundary.length];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (!length) continue;
      const normal = {
        x: (-orientation * (b.y - a.y)) / length,
        y: (orientation * (b.x - a.x)) / length,
      };
      if (!parallelFace(item, normal)) continue;
      const tangent = { x: -normal.y, y: normal.x };
      if (
        !rangesOverlap(
          projectionRange(corners, tangent),
          projectionRange([a, b], tangent),
        )
      )
        continue;
      const wall = a.x * normal.x + a.y * normal.y;
      add(wall - projectionRange(corners, normal).min, normal, {
        kind: "wall",
        id: room.id,
        edge: i,
      });
    }
  }
  for (const other of scene.furniture_instances) {
    if (
      other.id === id ||
      other.floor_id !== item.floor_id ||
      other.room_id !== item.room_id
    )
      continue;
    const otherCorners = footprint(other);
    if (
      mode !== "move" &&
      mode !== "rotate" &&
      overlap(corners, otherCorners)
    ) {
      if (Number.isFinite(other.height_mm))
        add((other.position.z ?? 0) + other.height_mm - pose.z, null, {
          kind: "furniture-top",
          id: other.id,
        });
      if (Number.isFinite(item.height_mm))
        add((other.position.z ?? 0) - item.height_mm - pose.z, null, {
          kind: "furniture-bottom",
          id: other.id,
        });
    }
    if (mode === "height" || mode === "rotate" || !heightsOverlap(item, other))
      continue;
    for (const normal of furnitureAxes(other)) {
      if (!parallelFace(item, normal)) continue;
      const tangent = { x: -normal.y, y: normal.x };
      if (
        !rangesOverlap(
          projectionRange(corners, tangent),
          projectionRange(otherCorners, tangent),
        )
      )
        continue;
      const moving = projectionRange(corners, normal),
        fixed = projectionRange(otherCorners, normal);
      add(fixed.min - moving.max, normal, {
        kind: "furniture-side",
        id: other.id,
      });
      add(fixed.max - moving.min, normal, {
        kind: "furniture-side",
        id: other.id,
      });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  for (const candidate of candidates) {
    try {
      editFurniture(scene, id, candidate.pose);
      return {
        pose: candidate.pose,
        snapped: true,
        contact: candidate.contact,
      };
    } catch {
      /* A nearby surface must not introduce another collision. */
    }
  }
  return { pose, snapped: false, contact: null };
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
    const dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy);
    if (
      length &&
      Math.abs(dx * (point.y - a.y) - dy * (point.x - a.x)) / length <=
        placementTolerance &&
      point.x >= Math.min(a.x, b.x) - placementTolerance &&
      point.x <= Math.max(a.x, b.x) + placementTolerance &&
      point.y >= Math.min(a.y, b.y) - placementTolerance &&
      point.y <= Math.max(a.y, b.y) + placementTolerance
    )
      return true;
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
  if (
    !heightsOverlap({ position: { z: 0 }, height_mm: product.height_mm }, item)
  )
    return false;
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
    metadata: {
      name: product.name,
      offline_catalog_only: product.sellable !== true && !product.asset_id,
      ...(product.model_kind === "dimensions"
        ? { model_kind: "dimensions" }
        : {}),
    },
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
  validateFurniturePlacement(copy, copy.furniture_instances.at(-1));
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
