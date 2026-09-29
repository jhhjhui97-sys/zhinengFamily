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
]);
function safe(value) {
  if (typeof value === "number") return Number.isFinite(value);
  if (!value || typeof value !== "object") return true;
  for (const [key, child] of Object.entries(value)) {
    if (key === "uri" && typeof child === "string") return false;
    if (!safe(child)) return false;
  }
  return true;
}
export function validateGlb(bytes) {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length < 20 ||
    bytes.length > 30 * 1024 * 1024
  )
    throw Error("GLB 文件大小不符合要求。");
  if (
    bytes.toString("ascii", 0, 4) !== "glTF" ||
    bytes.readUInt32LE(4) !== 2 ||
    bytes.readUInt32LE(8) !== bytes.length
  )
    throw Error("请选择完整的 GLB 2.0 文件。");
  let offset = 12,
    json = null,
    binaryLength = 0;
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) throw Error("GLB 分块不完整。");
    const length = bytes.readUInt32LE(offset),
      type = bytes.readUInt32LE(offset + 4);
    offset += 8;
    if (length % 4 !== 0 || offset + length > bytes.length)
      throw Error("GLB 分块长度不合法。");
    if (json === null && type === 0x4e4f534a) {
      const text = new TextDecoder("utf-8", { fatal: true })
        .decode(bytes.subarray(offset, offset + length))
        .replace(/[\u0000 ]+$/, "");
      json = JSON.parse(text);
    } else if (json !== null && type === 0x004e4942 && binaryLength === 0)
      binaryLength = length;
    else throw Error("GLB 包含不支持的分块。");
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
    throw Error("GLB 模型结构不合法或引用了外部文件。");
  if (
    (json.extensionsRequired ?? []).some((name) => !allowedExtensions.has(name))
  )
    throw Error("GLB 使用了暂不支持的压缩或扩展。");
  if (
    (json.buffers ?? []).some(
      (buffer) =>
        !Number.isInteger(buffer.byteLength) ||
        buffer.byteLength < 0 ||
        buffer.byteLength > binaryLength,
    )
  )
    throw Error("GLB 缓冲区不完整。");
  return json;
}
