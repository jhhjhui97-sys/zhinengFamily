import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { validateGlb } from "../glb.mjs";
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
test("rejects malformed header length external resources and remote decoders", () => {
  const doc = {
    asset: { version: "2.0" },
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [] }],
  };
  const good = glb(doc);
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
      glb({ ...doc, extensionsRequired: ["KHR_draco_mesh_compression"] }),
    ),
  );
});
