export function dragPose(start, from, to, mode) {
  if (mode === "move") {
    if (!from || !to) return start;
    return {
      ...start,
      x: Math.round(start.x + to.x - from.x),
      y: Math.round(start.y + to.y - from.y),
      rotation: start.rotation,
    };
  }
  if (mode === "height")
    return { ...start, z: Math.round((start.z ?? 0) + to - from) };
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
  snapPose,
  isSnappingEnabled = () => false,
}) {
  let active = null;
  const worldPoint = (event, mode, scene, item, anchor = item.position) => {
    const elevation =
      scene.floors.find((floor) => floor.id === item.floor_id)?.elevation_mm ??
      0;
    if (mode === "height")
      return (
        renderer.heightPoint?.(
          event.clientX,
          event.clientY,
          elevation,
          anchor,
        ) ?? null
      );
    if (mode === "move")
      return renderer.floorPoint(
        event.clientX,
        event.clientY,
        elevation + (anchor.z ?? 0),
      );
    return event.clientX;
  };
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
      const mode =
        event.button === 1 ? (event.shiftKey ? "height" : "move") : "rotate";
      const point = worldPoint(event, mode, scene, item);
      if (point === null) {
        onHint("当前视角无法拖动高度，请切换斜视视角或输入离地高度。", true);
        return;
      }
      event.preventDefault();
      renderer.controls.enabled = false;
      canvas.setPointerCapture(event.pointerId);
      active = {
        pointerId: event.pointerId,
        id,
        mode,
        from: point,
        anchorPosition: { ...item.position },
        start: {
          x: item.position.x,
          y: item.position.y,
          z: item.position.z ?? 0,
          rotation: item.rotation_deg,
        },
      };
      active.pose = active.start;
    },
    { capture: true },
  );
  canvas.addEventListener("pointermove", (event) => {
    if (!active || event.pointerId !== active.pointerId) return;
    const scene = getScene(),
      item = scene?.furniture_instances.find((value) => value.id === active.id);
    if (!item) return finish(false);
    const to = worldPoint(
      event,
      active.mode,
      scene,
      item,
      active.anchorPosition,
    );
    if (to === null) return;
    active.pose = dragPose(active.start, active.from, to, active.mode);
    let contact = null;
    if (
      snapPose &&
      active.mode !== "rotate" &&
      isSnappingEnabled() &&
      !event.altKey
    ) {
      const snapped = snapPose(scene, active.id, active.pose, {
        mode: active.mode,
      });
      active.pose = snapped.pose;
      contact = snapped.snapped ? snapped.contact : null;
    }
    renderer.previewPose(active.id, active.pose);
    const gap = wallGap(getScene(), active.id, active.pose);
    onHint(
      `X ${Math.round(active.pose.x)} mm · Y ${Math.round(active.pose.y)} mm · 离地 ${Math.round(active.pose.z)} mm · 旋转 ${Math.round(active.pose.rotation)}°` +
        (gap === null
          ? ""
          : ` · 距最近墙面约 ${Math.max(0, Math.round(gap))} mm`) +
        (contact ? " · 已自动贴合相邻平面" : ""),
      false,
    );
  });
  canvas.addEventListener("pointerup", (event) => {
    if (active?.pointerId === event.pointerId) finish(true);
  });
  canvas.addEventListener("pointercancel", () => finish(false));
  return { cancel: () => finish(false) };
}
