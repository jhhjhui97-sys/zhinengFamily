import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { copyThreeAddons } from "../../../tools/copy_three_addons.mjs";

test("portable addons include imported modules, their dependencies and local decoders without unrelated assets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "family-addon-package-"));
  const publicDirectory = join(directory, "public"),
    vendorDirectory = join(directory, "vendor"),
    destination = join(directory, "output");
  const files = {
    "public/render.mjs":
      'import {Something} from "three/addons/controls/Example.js";',
    "vendor/examples/jsm/controls/Example.js":
      'import {Util} from "../utils/Nested.js"; export {Other} from "../math/Other.js";',
    "vendor/examples/jsm/utils/Nested.js": "export const Util=1;",
    "vendor/examples/jsm/math/Other.js": "export const Other=2;",
    "vendor/examples/fonts/unrelated.json": '{"font":true}',
    "vendor/examples/jsm/libs/unrelated.js": "unused vendor code",
    "vendor/examples/jsm/libs/draco/gltf/draco_decoder.js": "draco-js",
    "vendor/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js":
      "draco-wrapper",
    "vendor/examples/jsm/libs/draco/gltf/draco_decoder.wasm": "draco-wasm",
    "vendor/examples/jsm/libs/draco/README.md": "draco license reference",
    "vendor/examples/jsm/libs/basis/basis_transcoder.js": "basis-wrapper",
    "vendor/examples/jsm/libs/basis/basis_transcoder.wasm": "basis-wasm",
    "vendor/examples/jsm/libs/basis/README.md": "basis license reference",
  };
  for (const [path, content] of Object.entries(files)) {
    const file = join(directory, path);
    await mkdir(resolve(file, ".."), { recursive: true });
    await writeFile(file, content);
  }
  await copyThreeAddons({ publicDirectory, vendorDirectory, destination });
  assert.equal(
    await readFile(join(destination, "examples/jsm/utils/Nested.js"), "utf8"),
    "export const Util=1;",
  );
  assert.equal(
    await readFile(join(destination, "examples/jsm/math/Other.js"), "utf8"),
    "export const Other=2;",
  );
  assert.equal(
    await readFile(
      join(destination, "examples/jsm/libs/draco/gltf/draco_decoder.wasm"),
      "utf8",
    ),
    "draco-wasm",
  );
  assert.equal(
    await readFile(
      join(destination, "examples/jsm/libs/basis/basis_transcoder.wasm"),
      "utf8",
    ),
    "basis-wasm",
  );
  await assert.rejects(
    access(join(destination, "examples/fonts/unrelated.json")),
  );
  await assert.rejects(
    access(join(destination, "examples/jsm/libs/unrelated.js")),
  );
});

test("actual portable addon selection preserves the current Three.js loader dependency closure", async () => {
  const destination = await mkdtemp(join(tmpdir(), "family-real-addons-"));
  const vendorDirectory = resolve(import.meta.dirname, "../node_modules/three");
  await copyThreeAddons({
    publicDirectory: resolve(import.meta.dirname, "../public"),
    vendorDirectory,
    destination,
  });
  for (const file of [
    "loaders/GLTFLoader.js",
    "loaders/DRACOLoader.js",
    "loaders/KTX2Loader.js",
    "controls/OrbitControls.js",
    "environments/RoomEnvironment.js",
    "libs/meshopt_decoder.module.js",
    "libs/ktx-parse.module.js",
    "libs/zstddec.module.js",
    "utils/WorkerPool.js",
    "math/ColorSpaces.js",
    "libs/draco/gltf/draco_decoder.wasm",
    "libs/basis/basis_transcoder.wasm",
  ]) {
    assert.deepEqual(
      await readFile(join(destination, "examples/jsm", file)),
      await readFile(join(vendorDirectory, "examples/jsm", file)),
    );
  }
});
