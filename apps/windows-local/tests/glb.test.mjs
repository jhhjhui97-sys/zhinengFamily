import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { validateGlb } from "../glb.mjs";
import {
  encodeGlb,
  triangleFixture,
  dracoFixture,
  meshoptFixture,
} from "./glb-fixtures.mjs";
const root = resolve(import.meta.dirname, "../../..");
function glb(document) {
  const raw = Buffer.from(JSON.stringify(document));
  const json = Buffer.concat([
    raw,
    Buffer.alloc((4 - (raw.length % 4)) % 4, 32),
  ]);
  const output = Buffer.alloc(20 + json.length);
  output.write("glTF", 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(json.length, 12);
  output.write("JSON", 16);
  json.copy(output, 20);
  return output;
}
test("accepts an actual bundled textured GLB", async () => {
  const bytes = await readFile(
    join(root, "apps/windows-local/public/assets/sofa.glb"),
  );
  assert.doesNotThrow(() => validateGlb(bytes));
});
test("rejects malformed header length external resources and unknown mandatory extensions", () => {
  const { document: doc, binary, bytes: good } = triangleFixture();
  assert.doesNotThrow(() => validateGlb(good));
  const badLength = Buffer.from(good);
  badLength.writeUInt32LE(good.length + 4, 8);
  assert.throws(() => validateGlb(badLength));
  assert.throws(() =>
    validateGlb(
      glb({ ...doc, buffers: [{ uri: "https://evil.example/file.bin" }] }),
    ),
  );
  assert.throws(() =>
    validateGlb(glb({ ...doc, images: [{ uri: "../private.png" }] })),
  );
  assert.throws(() =>
    validateGlb(
      glb({ ...doc, extensionsRequired: ["FUTURE_unknown_compression"] }),
    ),
  );
});

test("malformed collection entries report a GLB validation error instead of an internal TypeError", () => {
  const { document, binary } = triangleFixture();
  for (const changed of [
    { ...document, bufferViews: [null] },
    { ...document, accessors: [null] },
    { ...document, scenes: [null] },
    { ...document, nodes: [null] },
  ])
    assert.throws(() => validateGlb(encodeGlb(changed, binary)), /GLB/);
});

test("accepts native quantized geometry and self-contained data buffers", () => {
  assert.doesNotThrow(() =>
    validateGlb(triangleFixture({ quantized: true }).bytes),
  );
  assert.doesNotThrow(() =>
    validateGlb(triangleFixture({ embedded: true }).bytes),
  );
});

test("accepts real Draco and Meshopt compressed geometry with a declared fallback buffer", () => {
  assert.doesNotThrow(() => validateGlb(dracoFixture().bytes));
  assert.doesNotThrow(() => validateGlb(meshoptFixture().bytes));
});

test("reports the precise unsupported extension and rejects external resource paths", () => {
  const { document, binary } = triangleFixture();
  assert.throws(
    () =>
      validateGlb(
        encodeGlb(
          { ...document, extensionsRequired: ["FUTURE_unknown_compression"] },
          binary,
        ),
      ),
    /FUTURE_unknown_compression/,
  );
  for (const uri of [
    "../texture.png",
    "https://example.com/model.bin",
    "file:///C:/private.bin",
    "data:text/html;base64,PGgxPg==",
  ]) {
    assert.throws(
      () =>
        validateGlb(
          encodeGlb(
            { ...document, buffers: [{ byteLength: 36, uri }] },
            binary,
          ),
        ),
      /资源|缓冲|data|格式/,
    );
  }
});

test("rejects an empty or unreachable mesh instead of importing an invisible model", () => {
  const { document, binary } = triangleFixture();
  for (const changed of [
    { ...document, scenes: [{ nodes: [] }] },
    { ...document, meshes: [{ primitives: [] }] },
    { ...document, nodes: [{ mesh: 4 }] },
    { ...document, nodes: [{ mesh: 0, children: [0] }] },
    { ...document, meshes: [{ primitives: [{ attributes: {} }] }] },
  ])
    assert.throws(
      () => validateGlb(encodeGlb(changed, binary)),
      /模型|节点|几何|网格|顶点/,
    );
});

test("rejects truncated geometry and malformed data URIs before product creation", () => {
  const { document, binary } = triangleFixture();
  assert.throws(
    () =>
      validateGlb(
        encodeGlb(
          {
            ...document,
            bufferViews: [{ buffer: 0, byteOffset: 32, byteLength: 36 }],
          },
          binary,
        ),
      ),
    /缓冲|几何/,
  );
  assert.throws(
    () =>
      validateGlb(
        encodeGlb(
          { ...document, accessors: [{ ...document.accessors[0], count: 4 }] },
          binary,
        ),
      ),
    /顶点|几何|缓冲/,
  );
  assert.throws(
    () =>
      validateGlb(
        encodeGlb({
          ...document,
          buffers: [
            {
              byteLength: 36,
              uri: "data:application/octet-stream;base64,A===",
            },
          ],
        }),
      ),
    /缓冲|data|格式/,
  );
});

test("accepts a nonempty alternative scene when the exporter leaves the default empty", () => {
  const { document, binary } = triangleFixture();
  assert.doesNotThrow(() =>
    validateGlb(
      encodeGlb(
        { ...document, scenes: [{ nodes: [] }, { nodes: [0] }] },
        binary,
      ),
    ),
  );
});
