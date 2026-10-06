import { deflateSync } from "node:zlib";
import { encodeGlb } from "./glb-fixtures.mjs";

function chunk(type, bytes) {
  const data = Buffer.concat([Buffer.from(type), bytes]);
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const result = Buffer.alloc(bytes.length + 12);
  result.writeUInt32BE(bytes.length, 0);
  data.copy(result, 4);
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4);
  return result;
}
function screenPng() {
  const width = 8,
    height = 4,
    header = Buffer.alloc(13),
    rows = Buffer.alloc(height * (1 + width * 4));
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = y * (1 + width * 4) + 1 + x * 4;
      rows.set([20 + x * 20, 40 + y * 40, 160 - x * 10, 255], at);
    }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export function televisionFixture() {
  // Original anonymous geometry and generated artwork. This fixture contains
  // no merchant file, node name, or external texture reference.
  const parts = [],
    bufferViews = [],
    accessors = [];
  let length = 0;
  const view = (bytes, target) => {
    const id = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset: length,
      byteLength: bytes.length,
      ...(target ? { target } : {}),
    });
    const padded = Buffer.alloc(Math.ceil(bytes.length / 4) * 4);
    bytes.copy(padded);
    parts.push(padded);
    length += padded.length;
    return id;
  };
  const accessor = (values, type, componentType, target, bounds) => {
    const bytes = Buffer.from(
      (componentType === 5123
        ? new Uint16Array(values)
        : new Float32Array(values)
      ).buffer,
    );
    const id = accessors.length;
    accessors.push({
      bufferView: view(bytes, target),
      componentType,
      count: values.length / { SCALAR: 1, VEC2: 2, VEC3: 3 }[type],
      type,
      ...(bounds ? { min: bounds[0], max: bounds[1] } : {}),
    });
    return id;
  };
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
    uvs = [],
    indices = [];
  for (const face of faces) {
    const start = positions.length / 3;
    for (let i = 0; i < 4; i++) {
      positions.push(...face[i]);
      normals.push(...face[4]);
      uvs.push(
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
  const box = {
    POSITION: accessor(positions, "VEC3", 5126, 34962, [
      [-0.5, -0.5, -0.5],
      [0.5, 0.5, 0.5],
    ]),
    NORMAL: accessor(normals, "VEC3", 5126, 34962),
    TEXCOORD_0: accessor(uvs, "VEC2", 5126, 34962),
  };
  const boxIndex = accessor(indices, "SCALAR", 5123, 34963);
  const screen = {
    POSITION: accessor(
      [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0],
      "VEC3",
      5126,
      34962,
      [
        [-0.5, -0.5, 0],
        [0.5, 0.5, 0],
      ],
    ),
    NORMAL: accessor([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], "VEC3", 5126, 34962),
    TEXCOORD_0: accessor([0, 1, 1, 1, 1, 0, 0, 0], "VEC2", 5126, 34962),
  };
  const screenIndex = accessor([0, 1, 2, 0, 2, 3], "SCALAR", 5123, 34963);
  const image = view(screenPng());
  const nodes = [
    { mesh: 0, scale: [1.2, 0.7, 0.04], translation: [0, 0.45, 0] },
    { mesh: 1, scale: [1.18, 0.68, 0.02], translation: [0, 0.45, -0.031] },
    { mesh: 2, scale: [0.09, 0.12, 0.07], translation: [0, 0.075, 0] },
    { mesh: 2, scale: [0.6, 0.03, 0.3], translation: [0, 0.015, 0] },
    { mesh: 2, scale: [0.05, 0.003, 0.002], translation: [0, 0.11, 0.031] },
    { mesh: 3, scale: [1.15, 0.65, 1], translation: [0, 0.45, 0.025] },
  ];
  const document = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes: [
      ...[0, 1, 2].map((material) => ({
        primitives: [{ attributes: box, indices: boxIndex, material }],
      })),
      {
        primitives: [{ attributes: screen, indices: screenIndex, material: 3 }],
      },
    ],
    materials: [
      { pbrMetallicRoughness: { baseColorFactor: [0.03, 0.04, 0.05, 1] } },
      {
        pbrMetallicRoughness: {
          baseColorFactor: [0.12, 0.14, 0.16, 1],
          roughnessFactor: 0.7,
        },
      },
      {
        pbrMetallicRoughness: {
          baseColorFactor: [0.34, 0.38, 0.42, 1],
          metallicFactor: 0.7,
        },
      },
      {
        pbrMetallicRoughness: { baseColorTexture: { index: 0 } },
        emissiveTexture: { index: 0 },
        emissiveFactor: [0.35, 0.35, 0.35],
        doubleSided: true,
      },
    ],
    textures: [{ source: 0 }],
    images: [{ bufferView: image, mimeType: "image/png" }],
    bufferViews,
    accessors,
    buffers: [{ byteLength: length }],
  };
  return { document, bytes: encodeGlb(document, Buffer.concat(parts)) };
}
