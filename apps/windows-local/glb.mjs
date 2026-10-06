const allowedExtensions = new Set([
  "KHR_texture_transform",
  "EXT_texture_webp",
  "KHR_materials_transmission",
  "KHR_materials_clearcoat",
  "KHR_materials_sheen",
  "KHR_materials_specular",
  "KHR_materials_volume",
  "KHR_materials_ior",
  "KHR_materials_emissive_strength",
  "KHR_materials_unlit",
  "KHR_lights_punctual",
  "KHR_mesh_quantization",
  "EXT_mesh_gpu_instancing",
  "KHR_draco_mesh_compression",
  "EXT_meshopt_compression",
  "KHR_texture_basisu",
  "KHR_materials_iridescence",
  "KHR_materials_anisotropy",
  "KHR_materials_dispersion",
  "EXT_materials_bump",
  "EXT_texture_avif",
]);
export class GlbValidationError extends Error {}
function invalid(message) {
  throw new GlbValidationError(message);
}
function dataBytes(uri, kind) {
  const mime =
    kind === "buffer"
      ? "application/(?:octet-stream|gltf-buffer)"
      : "image/(?:png|jpeg|webp|avif|ktx2)";
  const match = new RegExp(
    `^data:(${mime});base64,([A-Za-z0-9+/]*={0,2})$`,
    "i",
  ).exec(uri);
  if (
    !match ||
    match[2].length % 4 === 1 ||
    (/=/.test(match[2]) && match[2].length % 4 !== 0)
  )
    invalid("GLB 内置 data 资源格式无效；请使用完整的二进制或图片资源。");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > 30 * 1024 * 1024)
    invalid("GLB 内置资源大小无效。");
  return bytes;
}
function safe(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (!value || typeof value !== "object") return true;
  for (const [key, child] of Object.entries(value)) {
    if (
      key === "uri" &&
      typeof child === "string" &&
      !child.startsWith("data:")
    )
      return false;
    if (!safe(child)) return false;
  }
  return true;
}
export function validateGlb(bytes) {
  try {
    return readGlb(bytes);
  } catch (error) {
    if (error instanceof GlbValidationError) throw error;
    invalid("GLB 模型结构损坏，请重新导出完整的 GLB 2.0 文件。");
  }
}
function readGlb(bytes) {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length < 20 ||
    bytes.length > 30 * 1024 * 1024
  )
    invalid("GLB 文件大小不符合要求，最大为 30 MiB。");
  if (
    bytes.toString("ascii", 0, 4) !== "glTF" ||
    bytes.readUInt32LE(4) !== 2 ||
    bytes.readUInt32LE(8) !== bytes.length
  )
    invalid("请选择完整的 GLB 2.0 文件。");
  let offset = 12,
    json = null,
    binaryLength = 0;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) invalid("GLB 分块不完整。");
    const length = bytes.readUInt32LE(offset),
      type = bytes.readUInt32LE(offset + 4);
    offset += 8;
    if (length % 4 !== 0 || offset + length > bytes.length)
      invalid("GLB 分块长度不合法。");
    if (json === null && type === 0x4e4f534a) {
      try {
        const text = new TextDecoder("utf-8", { fatal: true })
          .decode(bytes.subarray(offset, offset + length))
          .replace(/[\u0000 ]+$/, "");
        json = JSON.parse(text);
      } catch {
        invalid("GLB 模型说明分块损坏，请重新导出 GLB 2.0。");
      }
    } else if (json !== null && type === 0x004e4942 && binaryLength === 0)
      binaryLength = length;
    else invalid("GLB 包含不支持的分块。");
    offset += length;
  }
  if (
    !json ||
    json.asset?.version !== "2.0" ||
    !Array.isArray(json.scenes) ||
    !Array.isArray(json.meshes) ||
    json.meshes.length === 0 ||
    !safe(json)
  )
    invalid("GLB 模型结构不合法或包含外部资源，请导出自包含的 GLB 2.0。");
  if (
    !Array.isArray(json.extensionsRequired ?? []) ||
    !Array.isArray(json.extensionsUsed ?? [])
  )
    invalid("GLB 扩展列表格式不合法。");
  const unsupported = (json.extensionsRequired ?? []).filter(
    (name) => !allowedExtensions.has(name),
  );
  if (unsupported.length)
    invalid(
      `GLB 必需扩展暂不支持：${unsupported.join("、")}。请导出兼容的 GLB 2.0。`,
    );
  validateGeometry(json, binaryLength);
  return json;
}

function list(document, key) {
  const value = document[key] ?? [];
  if (!Array.isArray(value)) invalid(`GLB ${key} 模型结构不合法。`);
  return value;
}
function index(value, values, message) {
  if (!Number.isInteger(value) || value < 0 || value >= values.length)
    invalid(message);
  return values[value];
}
function integer(value, minimum = 0) {
  return Number.isSafeInteger(value) && value >= minimum;
}
function validateGeometry(document, binaryLength) {
  const buffers = list(document, "buffers"),
    views = list(document, "bufferViews"),
    accessors = list(document, "accessors"),
    nodes = list(document, "nodes");
  const lengths = buffers.map((buffer, i) => {
    if (!integer(buffer?.byteLength, 1)) invalid("GLB 缓冲区长度无效。");
    const fallback =
      buffer.extensions?.EXT_meshopt_compression?.fallback === true;
    const available =
      buffer.uri !== undefined
        ? dataBytes(buffer.uri, "buffer").length
        : fallback
          ? buffer.byteLength
          : i === 0
            ? binaryLength
            : 0;
    if (buffer.byteLength > available) invalid("GLB 缓冲区不完整。");
    return buffer.byteLength;
  });
  function range(buffer, offset, length) {
    const total = index(buffer, lengths, "GLB 几何缓冲区引用无效。");
    if (!integer(offset) || !integer(length, 1) || offset + length > total)
      invalid("GLB 几何缓冲区不完整。");
  }
  for (const view of views) {
    range(view.buffer, view.byteOffset ?? 0, view.byteLength);
    if (
      view.byteStride !== undefined &&
      (!integer(view.byteStride, 4) ||
        view.byteStride > 252 ||
        view.byteStride % 4)
    )
      invalid("GLB 顶点缓冲区步长无效。");
    const compression = view.extensions?.EXT_meshopt_compression;
    if (compression) {
      range(
        compression.buffer,
        compression.byteOffset ?? 0,
        compression.byteLength,
      );
      if (
        !integer(compression.count, 1) ||
        !integer(compression.byteStride, 1) ||
        compression.count * compression.byteStride !== view.byteLength
      )
        invalid("GLB Meshopt 几何缓冲区说明无效。");
    }
  }
  const componentSizes = {
      5120: 1,
      5121: 1,
      5122: 2,
      5123: 2,
      5125: 4,
      5126: 4,
    },
    components = {
      SCALAR: 1,
      VEC2: 2,
      VEC3: 3,
      VEC4: 4,
      MAT2: 4,
      MAT3: 9,
      MAT4: 16,
    };
  for (const accessor of accessors) {
    const bytes = componentSizes[accessor.componentType],
      count = components[accessor.type];
    if (
      !bytes ||
      !count ||
      !integer(accessor.count, 1) ||
      !integer(accessor.byteOffset ?? 0)
    )
      invalid("GLB 顶点或几何访问器格式无效。");
    const columns = accessor.type.startsWith("MAT")
      ? Number(accessor.type.at(-1))
      : 1;
    const element =
      columns > 1
        ? Math.ceil((columns * bytes) / 4) * 4 * columns
        : count * bytes;
    if (accessor.bufferView !== undefined) {
      const view = index(
        accessor.bufferView,
        views,
        "GLB 顶点缓冲区引用无效。",
      );
      const stride = view.byteStride ?? element;
      if (
        stride < element ||
        (accessor.byteOffset ?? 0) + (accessor.count - 1) * stride + element >
          view.byteLength
      )
        invalid("GLB 顶点几何缓冲区不完整。");
    }
    if (accessor.sparse) {
      const sparse = accessor.sparse;
      if (!integer(sparse.count, 1) || sparse.count > accessor.count)
        invalid("GLB 稀疏顶点说明无效。");
      const indices = index(
          sparse.indices?.bufferView,
          views,
          "GLB 稀疏顶点索引无效。",
        ),
        values = index(
          sparse.values?.bufferView,
          views,
          "GLB 稀疏顶点缓冲区无效。",
        ),
        indexSize = { 5121: 1, 5123: 2, 5125: 4 }[
          sparse.indices?.componentType
        ];
      if (
        !indexSize ||
        !integer(sparse.indices.byteOffset ?? 0) ||
        !integer(sparse.values.byteOffset ?? 0) ||
        (sparse.indices.byteOffset ?? 0) + sparse.count * indexSize >
          indices.byteLength ||
        (sparse.values.byteOffset ?? 0) + sparse.count * element >
          values.byteLength
      )
        invalid("GLB 稀疏顶点缓冲区不完整。");
    }
  }
  for (const image of list(document, "images")) {
    if (image.uri !== undefined) dataBytes(image.uri, "image");
    else index(image.bufferView, views, "GLB 图片资源缓冲区无效。");
  }
  for (const mesh of document.meshes) {
    if (!Array.isArray(mesh.primitives) || !mesh.primitives.length)
      invalid("GLB 网格没有可显示的几何内容。");
    for (const primitive of mesh.primitives) {
      const position = index(
        primitive.attributes?.POSITION,
        accessors,
        "GLB 网格缺少有效的 POSITION 顶点。",
      );
      if (position.type !== "VEC3") invalid("GLB 位置顶点须为三维几何坐标。");
      for (const value of Object.values(primitive.attributes ?? {}))
        index(value, accessors, "GLB 网格顶点引用无效。");
      if (primitive.indices !== undefined)
        index(primitive.indices, accessors, "GLB 网格索引引用无效。");
      const draco = primitive.extensions?.KHR_draco_mesh_compression;
      if (draco) index(draco.bufferView, views, "GLB Draco 几何缓冲区无效。");
    }
  }
  for (const node of nodes) {
    if (node.mesh !== undefined)
      index(node.mesh, document.meshes, "GLB 节点网格引用无效。");
    if (!Array.isArray(node.children ?? [])) invalid("GLB 子节点列表无效。");
    for (const child of node.children ?? [])
      index(child, nodes, "GLB 子节点引用无效。");
    const instanced = node.extensions?.EXT_mesh_gpu_instancing;
    if (instanced) {
      for (const value of Object.values(instanced.attributes ?? {}))
        index(value, accessors, "GLB 实例顶点引用无效。");
    }
  }
  if (document.scene !== undefined)
    index(document.scene, document.scenes, "GLB 默认场景引用无效。");
  let reachableMesh = false;
  const visited = new Set(),
    visiting = new Set();
  for (const scene of document.scenes) {
    if (!Array.isArray(scene.nodes ?? [])) invalid("GLB 场景节点列表无效。");
    const stack = (scene.nodes ?? []).map((node) => [node, false]);
    while (stack.length) {
      const [nodeId, exit] = stack.pop();
      if (exit) {
        visiting.delete(nodeId);
        visited.add(nodeId);
        continue;
      }
      if (visiting.has(nodeId)) invalid("GLB 场景节点循环引用，模型无法显示。");
      if (visited.has(nodeId)) continue;
      const node = index(nodeId, nodes, "GLB 场景节点引用无效。");
      reachableMesh ||= node.mesh !== undefined;
      visiting.add(nodeId);
      stack.push([nodeId, true]);
      for (const child of node.children ?? []) stack.push([child, false]);
    }
  }
  if (!reachableMesh) invalid("GLB 场景没有可显示的网格模型，请检查导出内容。");
}
