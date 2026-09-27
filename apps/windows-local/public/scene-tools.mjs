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
