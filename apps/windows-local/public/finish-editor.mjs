import {
  finishOptions,
  normalizeFinish,
  FINISH_PATTERNS,
  FINISH_LAYOUTS,
} from "./finish-catalog.mjs";
import {
  roomWalls,
  finishForSurface,
  setSurfaceFinish,
  clearSurfaceFinish,
} from "./finish-tools.mjs";

const properties = {
  name: "name",
  category: "category",
  pattern: "pattern",
  color: "color",
  accent: "accent_color",
  groutcolor: "grout_color",
  layout: "layout",
  width: "width_mm",
  height: "height_mm",
  angle: "angle_deg",
  grout: "grout_mm",
  roughness: "roughness",
  metalness: "metalness",
  opacity: "opacity",
  thickness: "thickness_mm",
  substrate: "substrate",
  note: "process_note",
};
const numericProperties = new Set([
  "width",
  "height",
  "angle",
  "grout",
  "roughness",
  "metalness",
  "opacity",
  "thickness",
]);

export function mountFinishEditor({
  getScene,
  canEdit,
  apply,
  notify,
  run,
  onPending = () => {},
}) {
  const $ = (name) => document.getElementById(`finish-${name}`);
  let baseline = null,
    selection = null,
    hydrated = null,
    layerValue = "";
  const target = () => ({
    roomId: $("room").value,
    surface: $("surface").value === "floor" ? "floor" : "wall",
    ...($("surface").value === "single" ? { wallId: $("wall").value } : {}),
  });
  const form = () =>
    Object.fromEntries(
      ["preset", ...Object.keys(properties), "layers"].map((key) => [
        key,
        $(key).value,
      ]),
    );
  const pending = () =>
    Boolean(baseline && JSON.stringify(form()) !== baseline);
  const options = (element, values) => {
    const previousValue = element.value;
    element.replaceChildren();
    for (const value of values) {
      const item = document.createElement("option");
      item.value = value.id;
      item.textContent = value.name;
      element.append(item);
    }
    element.value = values.some((value) => value.id === previousValue)
      ? previousValue
      : (values[0]?.id ?? "");
  };
  const load = (finish, { captureBaseline = true } = {}) => {
    const value = normalizeFinish(
      finish ?? {
        preset_id:
          target().surface === "floor" ? "floor-porcelain" : "wall-paint",
      },
      target().surface,
    );
    $("preset").value = value.preset_id;
    for (const [key, property] of Object.entries(properties))
      $(key).value = String(value[property]);
    $("layers").value = value.layers
      .map((layer) => `${layer.name}|${layer.thickness_mm}|${layer.note}`)
      .join("\n");
    hydrated = value;
    layerValue = $("layers").value;
    if (captureBaseline) baseline = JSON.stringify(form());
    selection = {
      room: $("room").value,
      surface: $("surface").value,
      wall: $("wall").value,
    };
    onPending();
  };
  const refresh = ({ force = false } = {}) => {
    const scene = getScene();
    $("panel").hidden = !scene?.rooms?.length;
    if (!scene?.rooms?.length) {
      baseline = null;
      selection = null;
      hydrated = null;
      layerValue = "";
      onPending();
      return;
    }
    if (pending() && !force) return;
    options($("room"), scene.rooms);
    if (!$("surface").value) $("surface").value = "floor";
    const walls = roomWalls(scene, $("room").value);
    options(
      $("wall"),
      walls.map((wall, index) => ({
        id: wall.id,
        name: `墙面 ${index + 1} · ${Math.round(Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y))} mm`,
      })),
    );
    $("wall-row").hidden = $("surface").value !== "single";
    $("outline-note").textContent =
      target().surface === "wall"
        ? "缺少墙体的房间边界显示装修示意；有墙体的位置保留门窗洞口。"
        : "";
    options($("preset"), finishOptions(target().surface));
    load(
      target().wallId || $("surface").value !== "single"
        ? finishForSurface(scene, target())
        : null,
    );
  };
  const changeTarget = () => {
    if (pending() && !confirm("装修输入尚未应用，确定放弃吗？")) {
      for (const key of ["room", "surface", "wall"])
        $(key).value = selection[key];
      return;
    }
    baseline = null;
    refresh({ force: true });
  };
  for (const key of ["room", "surface", "wall"]) $(key).onchange = changeTarget;
  options($("pattern"), FINISH_PATTERNS);
  options($("layout"), FINISH_LAYOUTS);
  // A preset choice is still an unapplied edit, even if its fields are untouched.
  $("preset").onchange = () => {
    load({ preset_id: $("preset").value }, { captureBaseline: false });
  };
  for (const key of [...Object.keys(properties), "layers"])
    $(key).oninput = onPending;
  const ensureEditable = () => {
    if (!getScene()) throw Error("请先载入场景。");
    if (!$("room").value) throw Error("当前场景暂无可装修的房间。");
    if (!canEdit()) throw Error("请先应用家具位置或高级场景输入，再调整装修。");
    if ($("surface").value === "single" && !$("wall").value)
      throw Error("这个房间暂无已识别的单面墙，请选择整房墙面。");
  };
  $("apply").onclick = () =>
    run(async () => {
      ensureEditable();
      const input = { ...hydrated, preset_id: $("preset").value };
      for (const [key, property] of Object.entries(properties)) {
        const value = $(key).value;
        if (
          numericProperties.has(key) &&
          (!value.trim() || !Number.isFinite(Number(value)))
        )
          throw Error("请填写有效的装修数值。");
        input[property] = numericProperties.has(key) ? Number(value) : value;
      }
      input.layers =
        $("layers").value === layerValue
          ? structuredClone(hydrated.layers)
          : $("layers")
              .value.split(/\r?\n/)
              .filter((line) => line.trim())
              .map((line) => {
                const [name, thickness, ...notes] = line.split("|");
                if (!thickness?.trim() || !Number.isFinite(Number(thickness)))
                  throw Error(
                    "每层工艺须填写有效厚度，格式：名称|厚度mm|说明。",
                  );
                return {
                  name: name.trim(),
                  thickness_mm: Number(thickness),
                  note: notes.join("|").trim(),
                };
              });
      await apply(setSurfaceFinish(getScene(), target(), input));
      baseline = null;
      refresh({ force: true });
      notify("装修已应用到草稿，请保存新版本。");
    });
  $("clear").onclick = () =>
    run(async () => {
      ensureEditable();
      await apply(clearSurfaceFinish(getScene(), target()));
      baseline = null;
      refresh({ force: true });
      notify("所选表面的装修已清除，请保存新版本。");
    });
  $("discard").onclick = () => {
    baseline = null;
    refresh({ force: true });
  };
  return { refresh, pending };
}
