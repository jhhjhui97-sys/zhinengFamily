import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalServer } from "../server.mjs";
import { MAX_DXF_BYTES } from "../dxf-analyze.mjs";

const sample = Buffer.from(
  "0\nSECTION\n2\nENTITIES\n0\nLINE\n8\nWALL\n10\n0\n20\n0\n11\n4200\n21\n0\n0\nENDSEC\n0\nEOF\n",
);

async function setup(t) {
  const dataDirectory = await mkdtemp(join(tmpdir(), "family-dxf-server-"));
  await writeFile(join(dataDirectory, "index.html"), "local");
  const server = createLocalServer({
    dataDirectory,
    publicDirectory: dataDirectory,
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const cookie = (await fetch(origin)).headers.get("set-cookie").split(";")[0];
  const post = (route, body = sample, headers = {}) =>
    fetch(`${origin}${route}`, {
      method: "POST",
      headers: {
        origin,
        cookie,
        "content-type": "application/dxf",
        ...headers,
      },
      body,
    });
  return { dataDirectory, origin, post };
}

test("analyzes and archives DXF bytes under their SHA-256 name", async (t) => {
  const s = await setup(t);
  const response = await s.post("/api/dxf/analyze");
  assert.equal(response.status, 200);
  const analysis = (await response.json()).data;
  assert.equal(analysis.segments.length, 1);
  assert.match(analysis.sha256, /^[0-9a-f]{64}$/);
  for (let i = 0; i < 2; i++) {
    const archive = await s.post("/api/dxf/archive");
    assert.equal(archive.status, 200);
    assert.equal((await archive.json()).data.sha256, analysis.sha256);
  }
  assert.deepEqual(await readdir(join(s.dataDirectory, "floorplans")), [
    `${analysis.sha256}.dxf`,
  ]);
  assert.deepEqual(
    await readFile(
      join(s.dataDirectory, "floorplans", `${analysis.sha256}.dxf`),
    ),
    sample,
  );
});

test("DXF upload routes enforce local session, same origin and type", async (t) => {
  const s = await setup(t);
  for (const route of ["/api/dxf/analyze", "/api/dxf/archive"]) {
    assert.equal((await s.post(route, sample, { cookie: "" })).status, 403);
    assert.equal(
      (await s.post(route, sample, { origin: "https://evil.example" })).status,
      403,
    );
    assert.equal(
      (await s.post(route, sample, { "content-type": "text/plain" })).status,
      415,
    );
  }
});

test("bad and oversized DXF cannot enter source archive", async (t) => {
  const s = await setup(t);
  assert.equal(
    (await s.post("/api/dxf/analyze", Buffer.from("broken"))).status,
    422,
  );
  assert.equal(
    (await s.post("/api/dxf/archive", Buffer.from("broken"))).status,
    422,
  );
  assert.equal(
    (await s.post("/api/dxf/analyze", Buffer.alloc(MAX_DXF_BYTES + 1))).status,
    413,
  );
  await assert.rejects(readdir(join(s.dataDirectory, "floorplans")), /ENOENT/);
});
