import http from "node:http";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createLocalServer } from "../server.mjs";
const root = resolve(import.meta.dirname, "../../..");
async function setup(t, extra = {}) {
  const dir = await mkdtemp(join(tmpdir(), "family-server-"));
  await writeFile(join(dir, "index.html"), "<h1>本地家具设计</h1>");
  const server = createLocalServer({
    bridgePath: join(root, ".local/windows-bridge/LocalBridge.exe"),
    dataDirectory: dir,
    protocolDirectory: join(root, "apps/unity-client/Assets/StreamingAssets"),
    publicDirectory: dir,
    ...extra,
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => server.close(r)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(url);
  const cookie = response.headers.get("set-cookie").split(";")[0];
  return {
    dataDirectory: dir,
    url,
    cookie,
    request: (body, headers = {}) =>
      fetch(url + "/api/local", {
        method: "POST",
        headers: {
          origin: url,
          cookie,
          "content-type": "application/json",
          ...headers,
        },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
  };
}
test("loopback UI sets HttpOnly SameSite cookie without browser token", async (t) => {
  const s = await setup(t);
  const r = await fetch(s.url);
  assert.match(r.headers.get("set-cookie"), /HttpOnly/);
  assert.match(r.headers.get("set-cookie"), /SameSite=Strict/);
  assert.doesNotMatch(await r.text(), /access_token|Bearer/);
});
test("bundled PBR material images are served only as local image resources", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "family-material-"));
  await mkdir(join(dir, "materials"));
  const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  await writeFile(join(dir, "index.html"), "<h1>本地家具设计</h1>");
  await writeFile(join(dir, "materials", "floor.jpg"), bytes);
  const s = await setup(t, { publicDirectory: dir });
  const response = await fetch(`${s.url}/materials/floor.jpg`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
});
test("same origin API uses real SQLite library", async (t) => {
  const s = await setup(t);
  const created = await s.request({ action: "create", name: "本地项目" });
  assert.equal(created.status, 200);
  const list = await s.request({ action: "list" });
  assert.equal((await list.json()).data.total, 1);
});
test("cross origin and missing origin writes blocked", async (t) => {
  const s = await setup(t);
  assert.equal(
    (
      await s.request(
        { action: "create", name: "不能写" },
        { origin: "https://evil.example" },
      )
    ).status,
    403,
  );
  assert.equal(
    (await s.request({ action: "list" }, { origin: "" })).status,
    403,
  );
  assert.equal(
    (await s.request({ action: "list" }, { cookie: "" })).status,
    403,
  );
});
test("host spoof and traversal never expose files", async (t) => {
  const s = await setup(t);
  assert.equal(
    await new Promise((resolve, reject) => {
      http
        .get(s.url, { headers: { host: "evil.example" } }, (r) => {
          r.resume();
          resolve(r.statusCode);
        })
        .on("error", reject);
    }),
    403,
  );
  assert.equal((await fetch(s.url + "/%2e%2e/package.json")).status, 404);
});
test("malformed and overflowing nested JSON rejected before forwarding", async (t) => {
  const s = await setup(t);
  for (const body of [
    "{bad",
    '{"action":"save","scene":{"metadata":{"x":1e400}}}',
    '{"action":"save","scene":{"metadata":{"x":[-1e400]}}}',
  ])
    assert.equal((await s.request(body)).status, 422);
});
test("body limit and wrong content type handled safely", async (t) => {
  const s = await setup(t);
  assert.equal((await s.request("x".repeat(1024 * 1024 + 1))).status, 413);
  assert.equal(
    (await s.request({ action: "list" }, { "content-type": "text/plain" }))
      .status,
    415,
  );
});
test("missing subprocess returns Chinese safe error", async (t) => {
  const s = await setup(t, { bridgePath: "Z:/not-present/private.exe" });
  const r = await s.request({ action: "list" });
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /本地/);
});
test("same local data survives service restart without internet or login", async (t) => {
  const s = await setup(t);
  const created = await (
    await s.request({ action: "create", name: "离线重启" })
  ).json();
  const id = created.data.id;
  const sample = await (await s.request({ action: "sample", id })).json();
  assert.equal(
    (
      await s.request({
        action: "save",
        id,
        base_revision: 0,
        scene: sample.data.scene,
      })
    ).status,
    200,
  );
  const current = await (await s.request({ action: "current", id })).json();
  assert.equal(current.data.revision, 1);
  const recreated = createLocalServer({
    bridgePath: join(root, ".local/windows-bridge/LocalBridge.exe"),
    dataDirectory: s.dataDirectory,
    protocolDirectory: join(root, "apps/unity-client/Assets/StreamingAssets"),
    publicDirectory: s.dataDirectory,
  });
  await new Promise((r) => recreated.listen(0, "127.0.0.1", r));
  t.after(() => new Promise((r) => recreated.close(r)));
  const url = `http://127.0.0.1:${recreated.address().port}`;
  const cookie = (await fetch(url)).headers.get("set-cookie").split(";")[0];
  const response = await fetch(url + "/api/local", {
    method: "POST",
    headers: { origin: url, cookie, "content-type": "application/json" },
    body: JSON.stringify({ action: "current", id }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.revision, 1);
});
