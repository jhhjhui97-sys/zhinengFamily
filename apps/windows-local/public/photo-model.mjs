const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_SIDE = 4096;

export function photoDimensions(input) {
  const bytes =
    input instanceof Uint8Array ? input : new Uint8Array(input ?? []);
  if (bytes.length > MAX_IMAGE_BYTES) throw Error("图片不能超过 5 MiB。");
  if (bytes.length < 10) throw Error("请选择有效的 PNG 或 JPEG 图片。");
  let width, height, mimeType;
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => bytes[i] === n)) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (
      bytes[12] !== 73 ||
      bytes[13] !== 72 ||
      bytes[14] !== 68 ||
      bytes[15] !== 82
    )
      throw Error("图片 PNG 头无效。");
    width = view.getUint32(16);
    height = view.getUint32(20);
    mimeType = "image/png";
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      offset += 2;
      if (marker === 0xd9 || marker === 0xda) break;
      if (
        marker === 0xff ||
        marker === 0x01 ||
        (marker >= 0xd0 && marker <= 0xd7)
      )
        continue;
      const size = (bytes[offset] << 8) | bytes[offset + 1];
      if (size < 2 || offset + size > bytes.length) break;
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      ) {
        height = (bytes[offset + 3] << 8) | bytes[offset + 4];
        width = (bytes[offset + 5] << 8) | bytes[offset + 6];
        mimeType = "image/jpeg";
        break;
      }
      offset += size;
    }
  }
  if (!mimeType || !width || !height || width > MAX_SIDE || height > MAX_SIDE)
    throw Error("图片尺寸无效，须为不超过 4096 像素的 PNG 或 JPEG。");
  return { width, height, mimeType };
}

function padded(bytes, fill = 0) {
  const result = new Uint8Array(Math.ceil(bytes.length / 4) * 4);
  result.fill(fill);
  result.set(bytes);
  return result;
}

function f32(numbers) {
  return new Uint8Array(new Float32Array(numbers).buffer);
}

function u16(numbers) {
  return new Uint8Array(new Uint16Array(numbers).buffer);
}

export function makePhotoGlb({
  width_mm,
  depth_mm,
  height_mm,
  category,
  imageBytes,
}) {
  const dimensions = [width_mm, depth_mm, height_mm].map(Number);
  if (dimensions.some((n) => !Number.isFinite(n) || n <= 0 || n > 10000))
    throw Error("商品尺寸须在 0–10000 mm 内。");
  const picture =
    imageBytes instanceof Uint8Array
      ? imageBytes
      : new Uint8Array(imageBytes ?? []);
  const { mimeType } = photoDimensions(picture);
  const [w, d, h] = dimensions.map((n) => n / 1000);
  const buffers = [],
    bufferViews = [],
    accessors = [];
  let byteLength = 0;
  function append(bytes, target) {
    const chunk = padded(bytes);
    const index = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset: byteLength,
      byteLength: bytes.length,
      ...(target ? { target } : {}),
    });
    buffers.push(chunk);
    byteLength += chunk.length;
    return index;
  }
  function accessor(values, type, componentType, target, min, max) {
    const view = append(
      componentType === 5123 ? u16(values) : f32(values),
      target,
    );
    const index = accessors.length;
    accessors.push({
      bufferView: view,
      componentType,
      count: values.length / { SCALAR: 1, VEC2: 2, VEC3: 3 }[type],
      type,
      ...(min ? { min, max } : {}),
    });
    return index;
  }
  // Unit box; node transforms give every category its real outside dimensions.
  const faces = [
    [
      [-0.5, -0.5, 0.5],
      [0.5, -0.5, 0.5],
      [0.5, 0.5, 0.5],
      [-0.5, 0.5, 0.5],
      [0, 0, 1],
    ],
    [
      [0.5, -0.5, -0.5],
      [-0.5, -0.5, -0.5],
      [-0.5, 0.5, -0.5],
      [0.5, 0.5, -0.5],
      [0, 0, -1],
    ],
    [
      [-0.5, -0.5, -0.5],
      [-0.5, -0.5, 0.5],
      [-0.5, 0.5, 0.5],
      [-0.5, 0.5, -0.5],
      [-1, 0, 0],
    ],
    [
      [0.5, -0.5, 0.5],
      [0.5, -0.5, -0.5],
      [0.5, 0.5, -0.5],
      [0.5, 0.5, 0.5],
      [1, 0, 0],
    ],
    [
      [-0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5],
      [0.5, 0.5, -0.5],
      [-0.5, 0.5, -0.5],
      [0, 1, 0],
    ],
    [
      [-0.5, -0.5, -0.5],
      [0.5, -0.5, -0.5],
      [0.5, -0.5, 0.5],
      [-0.5, -0.5, 0.5],
      [0, -1, 0],
    ],
  ];
  const positions = [],
    normals = [],
    uv = [],
    indices = [];
  for (const face of faces) {
    const start = positions.length / 3;
    for (let i = 0; i < 4; i++) {
      positions.push(...face[i]);
      normals.push(...face[4]);
      uv.push(
        ...[
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ][i],
      );
    }
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  const position = accessor(
    positions,
    "VEC3",
    5126,
    34962,
    [-0.5, -0.5, -0.5],
    [0.5, 0.5, 0.5],
  );
  const normal = accessor(normals, "VEC3", 5126, 34962);
  const texcoord = accessor(uv, "VEC2", 5126, 34962);
  const boxIndices = accessor(indices, "SCALAR", 5123, 34963);
  const photoPosition = accessor(
    [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0],
    "VEC3",
    5126,
    34962,
    [-0.5, -0.5, 0],
    [0.5, 0.5, 0],
  );
  const photoNormal = accessor(
    [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
    "VEC3",
    5126,
    34962,
  );
  const photoUv = accessor([0, 1, 1, 1, 1, 0, 0, 0], "VEC2", 5126, 34962);
  const photoIndices = accessor([0, 1, 2, 0, 2, 3], "SCALAR", 5123, 34963);
  const imageView = append(picture);
  const nodes = [];
  function box(name, scale, translation) {
    nodes.push({ name, mesh: 0, scale, translation });
  }
  const kind = String(category ?? "").toLowerCase();
  if (/sofa|沙发/.test(kind)) {
    box("seat", [w, h * 0.45, d], [0, h * 0.225, 0]);
    box("back", [w, h * 0.55, d * 0.18], [0, h * 0.725, -d * 0.41]);
    box("left arm", [w * 0.11, h * 0.65, d], [-w * 0.445, h * 0.325, 0]);
    box("right arm", [w * 0.11, h * 0.65, d], [w * 0.445, h * 0.325, 0]);
  } else if (/bed|床/.test(kind)) {
    box("mattress", [w, h * 0.45, d], [0, h * 0.225, 0]);
    box("headboard", [w, h * 0.55, d * 0.12], [0, h * 0.725, -d * 0.44]);
  } else if (/table|桌/.test(kind)) {
    box("tabletop", [w, h * 0.12, d], [0, h * 0.94, 0]);
    for (const x of [-1, 1])
      for (const z of [-1, 1])
        box(
          "leg",
          [w * 0.08, h * 0.88, d * 0.08],
          [x * w * 0.42, h * 0.44, z * d * 0.42],
        );
  } else {
    box("sized body", [w, h, d], [0, h / 2, 0]);
  }
  nodes.push({
    name: "uploaded photo on front",
    mesh: 1,
    scale: [w * 0.88, h * 0.75, 1],
    translation: [0, h * 0.5, d * 0.5 + 0.002],
  });
  const json = {
    asset: {
      version: "2.0",
      generator: "zhinengFamily offline dimension proxy",
    },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes: [
      {
        primitives: [
          {
            attributes: {
              POSITION: position,
              NORMAL: normal,
              TEXCOORD_0: texcoord,
            },
            indices: boxIndices,
            material: 0,
          },
        ],
      },
      {
        primitives: [
          {
            attributes: {
              POSITION: photoPosition,
              NORMAL: photoNormal,
              TEXCOORD_0: photoUv,
            },
            indices: photoIndices,
            material: 1,
          },
        ],
      },
    ],
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorFactor: [0.66, 0.68, 0.67, 1],
          metallicFactor: 0,
          roughnessFactor: 0.9,
        },
        doubleSided: true,
      },
      {
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
          metallicFactor: 0,
          roughnessFactor: 1,
        },
        doubleSided: true,
      },
    ],
    textures: [{ source: 0 }],
    images: [{ bufferView: imageView, mimeType }],
    samplers: [
      { magFilter: 9729, minFilter: 9729, wrapS: 33071, wrapT: 33071 },
    ],
    bufferViews,
    accessors,
    buffers: [{ byteLength }],
  };
  json.textures[0].sampler = 0;
  const jsonBytes = padded(new TextEncoder().encode(JSON.stringify(json)), 32);
  const result = new Uint8Array(12 + 8 + jsonBytes.length + 8 + byteLength);
  const view = new DataView(result.buffer);
  result.set([0x67, 0x6c, 0x54, 0x46], 0);
  view.setUint32(4, 2, true);
  view.setUint32(8, result.length, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  result.set(jsonBytes, 20);
  const binHead = 20 + jsonBytes.length;
  view.setUint32(binHead, byteLength, true);
  view.setUint32(binHead + 4, 0x004e4942, true);
  let offset = binHead + 8;
  for (const chunk of buffers) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
