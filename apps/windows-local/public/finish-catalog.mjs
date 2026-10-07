export const FINISH_PATTERNS = [
  ["solid", "纯色"],
  ["plaster", "涂料肌理"],
  ["tile", "瓷砖"],
  ["wood", "木纹"],
  ["stone", "石纹"],
  ["terrazzo", "水磨石"],
  ["wallpaper", "壁纸图案"],
  ["fabric", "织物"],
  ["concrete", "混凝土"],
  ["metal", "金属"],
  ["glass", "玻璃"],
  ["carpet", "地毯"],
  ["brick", "砖石"],
  ["mosaic", "马赛克"],
  ["slat", "格栅"],
].map(([id, name]) => ({ id, name }));

export const FINISH_LAYOUTS = [
  ["continuous", "连续面"],
  ["straight", "直铺"],
  ["staggered", "错缝铺"],
  ["herringbone", "人字铺"],
  ["chevron", "鱼骨铺"],
  ["checkerboard", "棋盘铺"],
  ["basketweave", "篮编铺"],
  ["hexagon", "六角铺"],
].map(([id, name]) => ({ id, name }));

const base = {
  color: "#d4ccc0",
  accent_color: "#a49b8d",
  grout_color: "#dad6cf",
  roughness: 0.65,
  metalness: 0,
  opacity: 1,
  pattern: "solid",
  layout: "continuous",
  width_mm: 600,
  height_mm: 600,
  angle_deg: 0,
  grout_mm: 0,
  thickness_mm: 1,
  substrate: "",
  process_note: "",
  layers: [],
};

function preset(id, surface, name, category, values) {
  return { ...base, id, surface, name, category, ...values };
}

const presets = [
  preset("wall-paint", "wall", "乳胶漆", "涂料", {
    color: "#f3eee4",
    pattern: "plaster",
    roughness: 0.88,
  }),
  preset("wall-mineral-paint", "wall", "矿物涂料 / 硅藻肌理", "涂料", {
    color: "#d6d1c4",
    pattern: "plaster",
    roughness: 0.94,
  }),
  preset("wall-art-paint", "wall", "艺术漆 / 威尼斯灰泥", "艺术涂饰", {
    color: "#b2aa9e",
    pattern: "stone",
    roughness: 0.42,
  }),
  preset("wall-microcement", "wall", "微水泥", "无缝饰面", {
    color: "#aaa69d",
    pattern: "concrete",
    roughness: 0.73,
    thickness_mm: 3,
  }),
  preset("wall-wallpaper", "wall", "壁纸", "卷材饰面", {
    color: "#ddd2b5",
    accent_color: "#a99677",
    pattern: "wallpaper",
    width_mm: 530,
    height_mm: 640,
  }),
  preset("wall-wallcovering", "wall", "壁布", "卷材饰面", {
    color: "#c8bda8",
    pattern: "fabric",
    width_mm: 300,
    height_mm: 300,
    roughness: 0.95,
  }),
  preset("wall-tile", "wall", "瓷砖 / 釉面砖", "块材饰面", {
    color: "#e6e3dc",
    pattern: "tile",
    layout: "straight",
    width_mm: 300,
    height_mm: 600,
    grout_mm: 2,
    thickness_mm: 8,
    roughness: 0.28,
  }),
  preset("wall-mosaic", "wall", "马赛克", "块材饰面", {
    color: "#b9c4b4",
    accent_color: "#6e9284",
    pattern: "mosaic",
    layout: "straight",
    width_mm: 50,
    height_mm: 50,
    grout_mm: 2,
    thickness_mm: 6,
    roughness: 0.3,
  }),
  preset("wall-stone", "wall", "天然石材", "石材", {
    color: "#ddd8d0",
    pattern: "stone",
    layout: "straight",
    width_mm: 1200,
    height_mm: 600,
    grout_mm: 2,
    thickness_mm: 20,
    roughness: 0.2,
  }),
  preset("wall-sintered-stone", "wall", "岩板 / 大板", "石材", {
    color: "#c3c1b9",
    pattern: "stone",
    layout: "straight",
    width_mm: 1200,
    height_mm: 2400,
    grout_mm: 2,
    thickness_mm: 6,
    roughness: 0.32,
  }),
  preset("wall-wood-panel", "wall", "木饰面 / 护墙板", "板材饰面", {
    color: "#a67b52",
    accent_color: "#61472f",
    pattern: "wood",
    layout: "straight",
    width_mm: 600,
    height_mm: 2400,
    grout_mm: 3,
    thickness_mm: 15,
    roughness: 0.48,
  }),
  preset("wall-slat", "wall", "木 / 金属格栅", "板材饰面", {
    color: "#9b744d",
    accent_color: "#3e342b",
    pattern: "slat",
    width_mm: 60,
    height_mm: 600,
    thickness_mm: 30,
  }),
  preset("wall-gypsum-panel", "wall", "石膏板 / 装配板", "板材饰面", {
    color: "#eee9dc",
    pattern: "plaster",
    layout: "straight",
    width_mm: 1200,
    height_mm: 2400,
    grout_mm: 2,
    thickness_mm: 12,
  }),
  preset("wall-soft-panel", "wall", "软包 / 硬包 / 吸音板", "包覆饰面", {
    color: "#a49588",
    pattern: "fabric",
    layout: "straight",
    width_mm: 600,
    height_mm: 600,
    grout_mm: 4,
    thickness_mm: 30,
    roughness: 0.98,
  }),
  preset("wall-metal", "wall", "金属板", "金属饰面", {
    color: "#b3b7b5",
    pattern: "metal",
    layout: "straight",
    width_mm: 600,
    height_mm: 1200,
    grout_mm: 3,
    thickness_mm: 2,
    metalness: 0.9,
    roughness: 0.28,
  }),
  preset("wall-glass", "wall", "烤漆玻璃", "玻璃饰面", {
    color: "#a7c0b9",
    pattern: "glass",
    layout: "straight",
    width_mm: 1200,
    height_mm: 2400,
    grout_mm: 2,
    thickness_mm: 6,
    roughness: 0.08,
  }),
  preset("wall-mirror", "wall", "镜面饰板", "玻璃饰面", {
    color: "#d7dce0",
    pattern: "glass",
    layout: "straight",
    width_mm: 900,
    height_mm: 2400,
    grout_mm: 2,
    thickness_mm: 5,
    metalness: 1,
    roughness: 0.03,
  }),
  preset("wall-concrete", "wall", "清水混凝土", "裸露饰面", {
    color: "#a4a39c",
    pattern: "concrete",
    layout: "straight",
    width_mm: 1200,
    height_mm: 600,
    grout_mm: 1,
    thickness_mm: 0,
    roughness: 0.9,
  }),
  preset("wall-brick", "wall", "文化砖 / 砖石", "砖石饰面", {
    color: "#b16d4d",
    accent_color: "#87462f",
    grout_color: "#bcb2a3",
    pattern: "brick",
    layout: "staggered",
    width_mm: 240,
    height_mm: 60,
    grout_mm: 10,
    thickness_mm: 20,
    roughness: 0.96,
  }),
  preset("wall-cork", "wall", "软木饰面", "天然饰面", {
    color: "#b29468",
    pattern: "terrazzo",
    width_mm: 300,
    height_mm: 300,
    thickness_mm: 5,
    roughness: 0.92,
  }),
  preset("custom-wall", "wall", "自定义墙面", "自定义", {}),
  preset("floor-porcelain", "floor", "瓷砖 / 玻化砖", "瓷砖", {
    color: "#d5cec0",
    pattern: "tile",
    layout: "straight",
    grout_mm: 3,
    thickness_mm: 10,
    roughness: 0.3,
  }),
  preset("floor-wood", "floor", "实木地板", "木地板", {
    color: "#b48b58",
    accent_color: "#725533",
    pattern: "wood",
    layout: "staggered",
    width_mm: 1200,
    height_mm: 180,
    grout_mm: 1,
    thickness_mm: 18,
    roughness: 0.48,
  }),
  preset("floor-engineered-wood", "floor", "实木复合地板", "木地板", {
    color: "#ab8964",
    accent_color: "#68523c",
    pattern: "wood",
    layout: "staggered",
    width_mm: 1200,
    height_mm: 200,
    grout_mm: 1,
    thickness_mm: 15,
    roughness: 0.48,
  }),
  preset("floor-laminate", "floor", "强化木地板", "木地板", {
    color: "#bdab89",
    accent_color: "#8b7857",
    pattern: "wood",
    layout: "staggered",
    width_mm: 1200,
    height_mm: 200,
    grout_mm: 1,
    thickness_mm: 12,
    roughness: 0.5,
  }),
  preset("floor-herringbone", "floor", "人字 / 鱼骨木地板", "木地板", {
    color: "#ad8055",
    accent_color: "#704e31",
    pattern: "wood",
    layout: "herringbone",
    width_mm: 600,
    height_mm: 150,
    grout_mm: 1,
    thickness_mm: 15,
    roughness: 0.48,
  }),
  preset("floor-spc", "floor", "SPC / 石塑地板", "弹性地材", {
    color: "#a7a391",
    accent_color: "#747060",
    pattern: "wood",
    layout: "staggered",
    width_mm: 1200,
    height_mm: 180,
    grout_mm: 0.5,
    thickness_mm: 5,
    roughness: 0.56,
  }),
  preset("floor-vinyl", "floor", "PVC / LVT / 卷材地板", "弹性地材", {
    color: "#b9b9ab",
    pattern: "tile",
    layout: "straight",
    width_mm: 500,
    height_mm: 500,
    grout_mm: 0,
    thickness_mm: 3,
    roughness: 0.65,
  }),
  preset("floor-linoleum", "floor", "亚麻地板", "弹性地材", {
    color: "#a6b4a3",
    pattern: "plaster",
    width_mm: 1000,
    height_mm: 1000,
    thickness_mm: 3,
    roughness: 0.75,
  }),
  preset("floor-stone", "floor", "天然石材 / 岩板", "石材", {
    color: "#bdb9ac",
    pattern: "stone",
    layout: "straight",
    grout_mm: 2,
    thickness_mm: 20,
    roughness: 0.23,
  }),
  preset("floor-terrazzo", "floor", "水磨石", "整体地面", {
    color: "#d2c8b8",
    accent_color: "#776c5a",
    pattern: "terrazzo",
    width_mm: 600,
    height_mm: 600,
    thickness_mm: 20,
    roughness: 0.35,
  }),
  preset("floor-microcement", "floor", "微水泥", "整体地面", {
    color: "#a4a195",
    pattern: "concrete",
    width_mm: 1000,
    height_mm: 1000,
    thickness_mm: 3,
    roughness: 0.62,
  }),
  preset("floor-cement", "floor", "水泥 / 自流平", "整体地面", {
    color: "#94948d",
    pattern: "concrete",
    width_mm: 1200,
    height_mm: 1200,
    thickness_mm: 8,
    roughness: 0.75,
  }),
  preset("floor-epoxy", "floor", "环氧 / 聚氨酯地坪", "整体地面", {
    color: "#a2b4b1",
    pattern: "solid",
    width_mm: 1000,
    height_mm: 1000,
    thickness_mm: 3,
    roughness: 0.17,
  }),
  preset("floor-carpet", "floor", "满铺地毯", "纺织地材", {
    color: "#8c8b7c",
    accent_color: "#676557",
    pattern: "carpet",
    width_mm: 200,
    height_mm: 200,
    thickness_mm: 8,
    roughness: 1,
  }),
  preset("floor-carpet-tile", "floor", "方块地毯", "纺织地材", {
    color: "#8c8274",
    accent_color: "#5e574c",
    pattern: "carpet",
    layout: "checkerboard",
    width_mm: 500,
    height_mm: 500,
    grout_mm: 1,
    thickness_mm: 7,
    roughness: 1,
  }),
  preset("floor-rubber", "floor", "橡胶地板", "弹性地材", {
    color: "#8b9a8c",
    pattern: "terrazzo",
    width_mm: 500,
    height_mm: 500,
    thickness_mm: 4,
    roughness: 0.85,
  }),
  preset("floor-cork", "floor", "软木地板", "天然地材", {
    color: "#b1946d",
    accent_color: "#74603e",
    pattern: "terrazzo",
    layout: "straight",
    width_mm: 600,
    height_mm: 300,
    grout_mm: 1,
    thickness_mm: 10,
    roughness: 0.7,
  }),
  preset("floor-raised", "floor", "架空 / 防静电地板", "装配地面", {
    color: "#bdc1b9",
    pattern: "tile",
    layout: "straight",
    width_mm: 600,
    height_mm: 600,
    grout_mm: 3,
    thickness_mm: 35,
    roughness: 0.58,
  }),
  preset("floor-mosaic", "floor", "马赛克 / 小规格地砖", "瓷砖", {
    color: "#c3b99f",
    accent_color: "#80785f",
    pattern: "mosaic",
    layout: "straight",
    width_mm: 50,
    height_mm: 50,
    grout_mm: 2,
    thickness_mm: 8,
    roughness: 0.5,
  }),
  preset("floor-brick", "floor", "砖 / 陶土砖", "砖石地面", {
    color: "#b07553",
    accent_color: "#905b3e",
    pattern: "brick",
    layout: "staggered",
    width_mm: 240,
    height_mm: 120,
    grout_mm: 5,
    thickness_mm: 20,
    roughness: 0.94,
  }),
  preset("custom-floor", "floor", "自定义地面", "自定义", {}),
];

function surfaceName(surface) {
  if (surface !== "wall" && surface !== "floor")
    throw Error("装修类型不合法。");
  return surface === "wall" ? "墙面" : "地面";
}

export function finishOptions(surface) {
  surfaceName(surface);
  return structuredClone(presets.filter((value) => value.surface === surface));
}

function text(value, label, limit, empty = true) {
  if (
    typeof value !== "string" ||
    value.length > limit ||
    (!empty && !value.trim())
  )
    throw Error(`${label}不合法。`);
  return value.trim();
}

function number(value, label, low, high) {
  if (!Number.isFinite(value) || value < low || value > high)
    throw Error(`${label}不合法。`);
  return value;
}

function color(value, label) {
  if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value))
    throw Error(`${label}应为六位颜色值。`);
  return value.toLowerCase();
}

export function normalizeFinish(input, surface) {
  const label = surfaceName(surface);
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error(`${label}方案不合法。`);
  const presetId = input.preset_id ?? input.id ?? `custom-${surface}`;
  const selected = presets.find(
    (value) => value.id === presetId && value.surface === surface,
  );
  if (!selected) throw Error(`请选择有效的${label}类型。`);
  const value = { ...selected, ...input };
  if (!FINISH_PATTERNS.some((option) => option.id === value.pattern))
    throw Error("纹理类型不合法。");
  if (!FINISH_LAYOUTS.some((option) => option.id === value.layout))
    throw Error("铺法不合法。");
  const width = number(value.width_mm, "规格宽度", 1, 10000);
  const height = number(value.height_mm, "规格长度", 1, 10000);
  const grout = number(value.grout_mm, "缝宽", 0, Math.min(width, height) / 4);
  if (!Array.isArray(value.layers) || value.layers.length > 20)
    throw Error("装修层次最多20层。");
  const layers = value.layers.map((layer) => {
    if (!layer || typeof layer !== "object" || Array.isArray(layer))
      throw Error("装修层次不合法。");
    return {
      name: text(layer.name, "层次名称", 100, false),
      thickness_mm: number(layer.thickness_mm, "层次厚度", 0, 1000),
      note: text(layer.note ?? "", "层次说明", 1000),
    };
  });
  return {
    preset_id: presetId,
    surface,
    name: text(value.name, "装修名称", 100, false),
    category: text(value.category, "装修分类", 100, false),
    color: color(value.color, "主色"),
    accent_color: color(value.accent_color, "辅色"),
    grout_color: color(value.grout_color, "缝色"),
    roughness: number(value.roughness, "粗糙度", 0, 1),
    metalness: number(value.metalness, "金属度", 0, 1),
    opacity: number(value.opacity, "不透明度", 0, 1),
    pattern: value.pattern,
    layout: value.layout,
    width_mm: width,
    height_mm: height,
    angle_deg:
      ((number(value.angle_deg, "铺设方向", -36000, 36000) % 360) + 360) % 360,
    grout_mm: grout,
    thickness_mm: number(value.thickness_mm, "饰面厚度", 0, 1000),
    substrate: text(value.substrate, "基层", 2000),
    process_note: text(value.process_note, "工艺备注", 4000),
    layers,
  };
}
