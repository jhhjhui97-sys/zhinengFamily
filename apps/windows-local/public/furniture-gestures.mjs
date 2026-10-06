export function dragPose(start, from, to, mode) {
  if (mode === "move") {
    if (!from || !to) return start;
    return {
      x: Math.round(start.x + to.x - from.x),
      y: Math.round(start.y + to.y - from.y),
      rotation: start.rotation,
    };
  }
  if (mode === "rotate")
    return {
      ...start,
      rotation: (((start.rotation + (to - from) * 0.5) % 360) + 360) % 360,
    };
  throw Error("不支持的家具操作。");
}

export function mountFurnitureGestures({
  canvas,
  renderer,
  getScene,
  getSelectedId,
  canEdit,
  onSelect,
  onCommit,
  onHint,
  wallGap,
}) {
  let active = null;
  const finish = (commit) => {
    if (!active) return;
    const gesture = active;
    active = null;
    renderer.controls.enabled = true;
    if (canvas.hasPointerCapture(gesture.pointerId))
      canvas.releasePointerCapture(gesture.pointerId);
    if (
      commit &&
      JSON.stringify(gesture.pose) !== JSON.stringify(gesture.start)
    )
      onCommit(gesture.id, gesture.pose, gesture.start);
    else renderer.previewPose(gesture.id, gesture.start);
  };
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener(
    "pointerdown",
    (event) => {
      const picked = renderer.pickFurniture(event.clientX, event.clientY);
      if (picked) onSelect(picked);
      if (event.button === 0) return;
      if (event.button !== 1 && event.button !== 2) return;
      const scene = getScene(),
        id = picked ?? getSelectedId();
      const item = scene?.furniture_instances.find((value) => value.id === id);
      if (!item) return;
      if (!canEdit()) {
        onHint("请先应用输入框中的修改，再拖动家具。", true);
        return;
      }
      const mode = event.button === 1 ? "move" : "rotate";
      const point =
        mode === "move"
          ? renderer.floorPoint(
              event.clientX,
              event.clientY,
              scene.floors.find((floor) => floor.id === item.floor_id)
                ?.elevation_mm ?? 0,
            )
          : event.clientX;
      if (point === null) return;
      event.preventDefault();
      renderer.controls.enabled = false;
      canvas.setPointerCapture(event.pointerId);
      active = {
        pointerId: event.pointerId,
        id,
        mode,
        from: point,
        start: {
          x: item.position.x,
          y: item.position.y,
          rotation: item.rotation_deg,
        },
      };
      active.pose = active.start;
    },
    { capture: true },
  );
  canvas.addEventListener("pointermove", (event) => {
    if (!active || event.pointerId !== active.pointerId) return;
    const to =
      active.mode === "move"
        ? renderer.floorPoint(
            event.clientX,
            event.clientY,
            getScene().floors.find(
              (floor) =>
                floor.id ===
                getScene().furniture_instances.find(
                  (item) => item.id === active.id,
                )?.floor_id,
            )?.elevation_mm ?? 0,
          )
        : event.clientX;
    if (to === null) return;
    active.pose = dragPose(active.start, active.from, to, active.mode);
    renderer.previewPose(active.id, active.pose);
    const gap = wallGap(getScene(), active.id, active.pose);
    onHint(
      `X ${active.pose.x} mm · Y ${active.pose.y} mm · 旋转 ${Math.round(active.pose.rotation)}°` +
        (gap === null
          ? ""
          : ` · 距最近墙面约 ${Math.max(0, Math.round(gap))} mm`),
      false,
    );
  });
  canvas.addEventListener("pointerup", (event) => {
    if (active?.pointerId === event.pointerId) finish(true);
  });
  canvas.addEventListener("pointercancel", () => finish(false));
  return { cancel: () => finish(false) };
}
