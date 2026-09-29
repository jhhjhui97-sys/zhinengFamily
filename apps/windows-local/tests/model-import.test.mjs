import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createLocalServer } from "../server.mjs";

const root = resolve(import.meta.dirname, "../../..");
const source = join(root, "apps/windows-local/public/assets/sofa.glb");
async function setup(t) {
  const dataDirectory = await mkdtemp(join(tmpdir(), "family-model-import-"));
  const server = createLocalServer({
    bridgePath: join(root, ".local/windows-bridge/LocalBridge.exe"),
    dataDirectory,
    protocolDirectory: join(root, "apps/unity-client/Assets/StreamingAssets"),
    publicDirectory: join(root, "apps/windows-local/public"),
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const cookie = (await fetch(url)).headers.get("set-cookie").split(";")[0];
  const call = async (body) =>
    await (
      await fetch(url + "/api/local", {
        method: "POST",
        headers: { origin: url, cookie, "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    ).json();
  const product = await call({
    action: "product_create",
    category: "sofa",
    brand: "品牌",
    name: "三人沙发",
    sku: "S-1",
    price: "6800.50",
    width_mm: 2400,
    depth_mm: 950,
    height_mm: 850,
  });
  assert.equal(product.status, 200);
  const id = product.data.id;
  const upload = (body, headers = {}) =>
    fetch(`${url}/api/product-models/${id}`, {
      method: "POST",
      headers: {
        origin: url,
        cookie,
        "content-type": "model/gltf-binary",
        "x-base-revision": "1",
        ...headers,
      },
      body,
    });
  return { url, cookie, call, id, upload, dataDirectory };
}
test("valid local GLB import links SKU and serves the exact bytes offline", async (t) => {
  const s = await setup(t),
    bytes = await readFile(source);
  const response = await s.upload(bytes);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.data.revision, 2);
  assert.match(result.data.active_asset_id, /^[0-9a-f-]{36}$/);
  assert.equal(
    (await s.call({ action: "product", id: s.id })).data.active_asset_id,
    result.data.active_asset_id,
  );
  const model = await fetch(
    `${s.url}/local-models/${result.data.active_asset_id}.glb`,
    { headers: { cookie: s.cookie } },
  );
  assert.equal(model.status, 200);
  assert.deepEqual(Buffer.from(await model.arrayBuffer()), bytes);
  assert.equal(
    (await fetch(`${s.url}/local-models/${result.data.active_asset_id}.glb`))
      .status,
    403,
  );
});
test("bad GLB cross-origin upload and stale attach leave prior SKU model untouched", async (t) => {
  const s = await setup(t),
    bytes = await readFile(source);
  assert.equal(
    (await s.upload(bytes, { origin: "https://evil.example" })).status,
    403,
  );
  assert.equal((await s.upload(Buffer.alloc(40))).status, 422);
  assert.equal(
    (await s.call({ action: "product", id: s.id })).data.active_asset_id,
    null,
  );
  assert.equal(
    (
      await s.call({
        action: "model_attach",
        id: s.id,
        base_revision: 1,
        sha256: "0".repeat(64),
        byte_count: 100,
      })
    ).status,
    422,
  );
  const valid = await s.upload(bytes);
  assert.equal(valid.status, 200);
  const original = (await valid.json()).data.active_asset_id;
  assert.equal((await s.upload(bytes)).status, 409);
  assert.equal(
    (await s.call({ action: "product", id: s.id })).data.active_asset_id,
    original,
  );
  assert.equal(
    (
      await fetch(`${s.url}/local-models/../../package.json`, {
        headers: { cookie: s.cookie },
      })
    ).status,
    404,
  );
});
test("missing model file is reported without erasing the saved SKU link", async (t) => {
  const s = await setup(t);
  const response = await s.upload(await readFile(source));
  assert.equal(response.status, 200);
  const id = (await response.json()).data.active_asset_id;
  const asset = await s.call({ action: "model_asset", id });
  assert.equal(asset.status, 200);
  await unlink(join(s.dataDirectory, "models", `${asset.data.sha256}.glb`));
  const model = await fetch(`${s.url}/local-models/${id}.glb`, {
    headers: { cookie: s.cookie },
  });
  assert.equal(model.status, 404);
  assert.equal(
    (await s.call({ action: "product", id: s.id })).data.active_asset_id,
    id,
  );
});
test("oversized model is rejected without updating product", async (t) => {
  const s = await setup(t);
  assert.equal(
    (await s.upload(Buffer.alloc(30 * 1024 * 1024 + 1))).status,
    413,
  );
  assert.equal(
    (await s.call({ action: "product", id: s.id })).data.revision,
    1,
  );
});
