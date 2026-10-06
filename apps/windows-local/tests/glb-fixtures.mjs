export function encodeGlb(document, binary = new Uint8Array()) {
  const raw = Buffer.from(JSON.stringify(document));
  const json = Buffer.concat([
    raw,
    Buffer.alloc((4 - (raw.length % 4)) % 4, 32),
  ]);
  const data = Buffer.concat([
    Buffer.from(binary),
    Buffer.alloc((4 - (binary.length % 4)) % 4),
  ]);
  const result = Buffer.alloc(
    20 + json.length + (data.length ? 8 + data.length : 0),
  );
  result.write("glTF", 0);
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(json.length, 12);
  result.write("JSON", 16);
  json.copy(result, 20);
  if (data.length) {
    result.writeUInt32LE(data.length, 20 + json.length);
    result.writeUInt32LE(0x004e4942, 24 + json.length);
    data.copy(result, 28 + json.length);
  }
  return result;
}

export function triangleFixture({ quantized = false, embedded = false } = {}) {
  const values = [0, 0, 0, 1, 0, 0, 0, 1, 0];
  const positions = quantized
    ? new Int16Array(values)
    : new Float32Array(values);
  const binary = Buffer.from(positions.buffer);
  const document = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [
      {
        bufferView: 0,
        componentType: quantized ? 5122 : 5126,
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
    ],
    bufferViews: [{ buffer: 0, byteLength: binary.length }],
    buffers: [
      {
        byteLength: binary.length,
        ...(embedded
          ? {
              uri: `data:application/octet-stream;base64,${binary.toString("base64")}`,
            }
          : {}),
      },
    ],
    ...(quantized
      ? {
          extensionsUsed: ["KHR_mesh_quantization"],
          extensionsRequired: ["KHR_mesh_quantization"],
        }
      : {}),
  };
  return {
    document,
    binary,
    bytes: encodeGlb(document, embedded ? undefined : binary),
  };
}

export function dracoFixture() {
  // Original four-vertex tetrahedron, encoded with the bundled Apache-2.0 Draco
  // encoder: POSITION quantization 14, MESH_SEQUENTIAL_ENCODING, faces
  // [0,1,2, 0,3,1, 0,2,3, 1,3,2]. No external model or merchant artwork.
  const binary = Buffer.from(
    "RFJBQ08CAgEAAAAEBAEAAQIAAwEAAgMBAwIBAQAJAwAAAgABAQADAwEgASADACCEiIEBAAAAAP8/AAAAAAAAAAAAAAAAAAAAAIA/Dg==",
    "base64",
  );
  const document = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [
          {
            attributes: { POSITION: 0 },
            indices: 1,
            extensions: {
              KHR_draco_mesh_compression: {
                bufferView: 0,
                attributes: { POSITION: 0 },
              },
            },
          },
        ],
      },
    ],
    accessors: [
      {
        componentType: 5126,
        count: 4,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 1, 1],
      },
      { componentType: 5123, count: 12, type: "SCALAR" },
    ],
    bufferViews: [{ buffer: 0, byteLength: binary.length }],
    buffers: [{ byteLength: binary.length }],
    extensionsUsed: ["KHR_draco_mesh_compression"],
    extensionsRequired: ["KHR_draco_mesh_compression"],
  };
  return { document, binary, bytes: encodeGlb(document, binary) };
}

export function meshoptFixture() {
  // Original triangle [0,0,0, 1,0,0, 0,1,0], generated with meshoptimizer
  // v0.22 encodeGltfBuffer(..., 3, 12, "ATTRIBUTES"). Encoder source:
  // https://github.com/zeux/meshoptimizer/blob/v0.22/js/meshopt_encoder.module.js
  const binary = Buffer.from(
    "oAAAATwAAAD//wE8AAAAfn0AAAEMAAAA/wEMAAAAfgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==",
    "base64",
  );
  const document = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
    ],
    bufferViews: [
      {
        buffer: 1,
        byteLength: 36,
        byteStride: 12,
        extensions: {
          EXT_meshopt_compression: {
            buffer: 0,
            byteLength: binary.length,
            byteStride: 12,
            count: 3,
            mode: "ATTRIBUTES",
            filter: "NONE",
          },
        },
      },
    ],
    buffers: [
      { byteLength: binary.length },
      {
        byteLength: 36,
        extensions: { EXT_meshopt_compression: { fallback: true } },
      },
    ],
    extensionsUsed: ["EXT_meshopt_compression"],
    extensionsRequired: ["EXT_meshopt_compression"],
  };
  return { document, binary, bytes: encodeGlb(document, binary) };
}
