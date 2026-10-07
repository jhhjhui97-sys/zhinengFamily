import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Worker as NodeWorker } from "node:worker_threads";
import * as THREE from "three";
import { createFurnitureLoader } from "../public/model-loader.mjs";
import {
  encodeGlb,
  triangleFixture,
  dracoFixture,
  meshoptFixture,
} from "./glb-fixtures.mjs";

globalThis.ProgressEvent ??= class ProgressEvent extends Event {
  constructor(type, data) {
    super(type);
    Object.assign(this, data);
  }
};

test("decodes an actual Meshopt GLB while preserving its original triangle coordinates", async (t) => {
  const { loader, url } = await serve(t, meshoptFixture().bytes);
  const result = await loader.loadAsync(url);
  const mesh = result.scene.children[0];
  assert.deepEqual(
    Array.from(mesh.geometry.attributes.position.array),
    [0, 0, 0, 1, 0, 0, 0, 1, 0],
  );
  const box = new THREE.Box3().setFromObject(result.scene);
  assert.deepEqual(box.min.toArray(), [0, 0, 0]);
  assert.deepEqual(box.max.toArray(), [1, 1, 0]);
});

async function serve(t, bytes) {
  const requests = [];
  const server = createServer(async (req, res) => {
    requests.push(req.url);
    try {
      const content =
        req.url === "/model.glb"
          ? bytes
          : await readFile(
              resolve(
                import.meta.dirname,
                "../node_modules/three",
                req.url.slice("/vendor/three/".length),
              ),
            );
      res.writeHead(200, {
        "content-type": req.url.endsWith(".wasm")
          ? "application/wasm"
          : req.url.endsWith(".js")
            ? "text/javascript"
            : "model/gltf-binary",
      });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const manager = new THREE.LoadingManager().setURLModifier(
    (url) => new URL(url, origin).href,
  );
  const loader = createFurnitureLoader(null, manager);
  t.after(() => loader.dispose?.());
  return { loader, url: `${origin}/model.glb`, requests };
}

test("loads actual quantized and self-contained buffer geometry without losing node transforms", async (t) => {
  const fixture = triangleFixture({ quantized: true, embedded: true });
  fixture.document.nodes[0].translation = [2, 3, 4];
  const { loader, url } = await serve(t, encodeGlb(fixture.document));
  const result = await loader.loadAsync(url);
  const box = new THREE.Box3().setFromObject(result.scene);
  assert.deepEqual(box.min.toArray(), [2, 3, 4]);
  assert.deepEqual(box.max.toArray(), [3, 4, 4]);
  const meshes = [];
  result.scene.traverse((node) => {
    if (node.isMesh) meshes.push(node);
  });
  assert.equal(meshes.length, 1);
  assert.equal(meshes[0].geometry.getAttribute("position").count, 3);
});

test(
  "decodes a real compressed Draco GLB using the packaged local WebAssembly decoder",
  { timeout: 15000 },
  async (t) => {
    const previousWorker = globalThis.Worker;
    const workers = [];
    // Run the loader's unchanged browser worker and real WASM in Node threads.
    // This bridges only the Worker API; it does not replace geometry decoding.
    globalThis.Worker = class BrowserWorker {
      constructor(url) {
        this.pending = fetch(url)
          .then((r) => r.text())
          .then((source) => {
            const prefix =
              "const {parentPort}=require('node:worker_threads');global.self=globalThis;global.location={href:'http://127.0.0.1/draco-worker.js'};global.importScripts=()=>{throw Error('unexpected external script')};global.postMessage=(data,transfer)=>parentPort.postMessage(data,transfer);parentPort.on('message',data=>global.onmessage({data}));";
            const worker = new NodeWorker(prefix + source, {
              eval: true,
              execArgv: [],
            });
            workers.push(worker);
            worker.on("message", (data) => this.onmessage?.({ data }));
            worker.on("error", (error) => this.onerror?.(error));
            return worker;
          });
      }
      postMessage(data, transfer) {
        this.pending.then((worker) => worker.postMessage(data, transfer));
      }
      terminate() {
        this.pending.then((worker) => worker.terminate());
      }
    };
    t.after(async () => {
      globalThis.Worker = previousWorker;
      await Promise.all(workers.map((worker) => worker.terminate()));
    });
    const { loader, url, requests } = await serve(t, dracoFixture().bytes);
    const result = await loader.loadAsync(url);
    const mesh = result.scene.children[0];
    assert.equal(mesh.geometry.attributes.position.count, 4);
    assert.equal(mesh.geometry.index.count, 12);
    const box = new THREE.Box3().setFromObject(result.scene);
    assert.deepEqual(box.min.toArray(), [0, 0, 0]);
    assert.deepEqual(box.max.toArray(), [1, 1, 1]);
    assert.ok(
      requests.includes(
        "/vendor/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm",
      ),
    );
    assert.ok(
      requests.includes(
        "/vendor/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js",
      ),
    );
  },
);

test("uses an exported nonempty scene instead of showing nothing for an empty default scene", async (t) => {
  const { document, binary } = triangleFixture();
  document.scenes = [{ nodes: [] }, { nodes: [0] }];
  const { loader, url } = await serve(t, encodeGlb(document, binary));
  const result = await loader.loadAsync(url);
  const meshes = [];
  result.scene.traverse((node) => {
    if (node.isMesh) meshes.push(node);
  });
  assert.equal(meshes.length, 1, "the usable exported scene must be visible");
});

test("rejects a scene without displayable geometry instead of reporting a successful render", async (t) => {
  const { document, binary } = triangleFixture();
  document.scenes[0].nodes = [];
  const { loader, url } = await serve(t, encodeGlb(document, binary));
  await assert.rejects(loader.loadAsync(url), /几何|网格|显示/);
});

test("rejects collapsed geometry so furniture dimensions never divide by zero", async (t) => {
  const { document, binary } = triangleFixture();
  document.nodes[0].scale = [0, 0, 0];
  const { loader, url } = await serve(t, encodeGlb(document, binary));
  await assert.rejects(loader.loadAsync(url), /几何|网格|显示/);
});

test("loads GPU instances with their correct world bounds", async (t) => {
  const { document, binary } = triangleFixture();
  const translations = Buffer.from(new Float32Array([0, 0, 0, 2, 0, 1]).buffer);
  document.buffers[0].byteLength += translations.length;
  document.bufferViews.push({
    buffer: 0,
    byteOffset: binary.length,
    byteLength: translations.length,
  });
  document.accessors.push({
    bufferView: 1,
    componentType: 5126,
    count: 2,
    type: "VEC3",
  });
  document.nodes[0].extensions = {
    EXT_mesh_gpu_instancing: { attributes: { TRANSLATION: 1 } },
  };
  document.extensionsUsed = document.extensionsRequired = [
    "EXT_mesh_gpu_instancing",
  ];
  const { loader, url } = await serve(
    t,
    encodeGlb(document, Buffer.concat([binary, translations])),
  );
  const result = await loader.loadAsync(url);
  const box = new THREE.Box3().setFromObject(result.scene);
  assert.deepEqual(box.min.toArray(), [0, 0, 0]);
  assert.deepEqual(box.max.toArray(), [3, 1, 1]);
  assert.equal(result.scene.children[0].isInstancedMesh, true);
  assert.equal(result.scene.children[0].count, 2);
});
