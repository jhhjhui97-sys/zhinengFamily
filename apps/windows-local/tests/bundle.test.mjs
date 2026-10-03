import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
const root = resolve(import.meta.dirname, "../../..");
const bundle =
  process.env.FAMILY_BUNDLE ??
  join(root, ".local/windows-portable/智能家居本地版");
test("portable Windows bundle contains executable runtime protocol model and licenses", async () => {
  for (const file of [
    "智能家居.exe",
    "runtime/node.exe",
    "runtime/client/server.mjs",
    "runtime/client/glb.mjs",
    "runtime/bridge/LocalBridge.exe",
    "runtime/bridge/LocalScenes.dll",
    "runtime/bridge/Newtonsoft.Json.dll",
    "runtime/client/protocol/scene.schema.json",
    "runtime/client/protocol/two-bedroom.json",
    "runtime/client/public/catalog.json",
    "runtime/client/public/assets/sofa.glb",
    "runtime/client/public/assets/chair.glb",
    "runtime/client/public/assets/velvet-sofa.glb",
    "runtime/client/public/assets/refrigerator.glb",
    "runtime/client/public/assets/room/wood-floor-diffuse.jpg",
    "runtime/client/public/assets/room/wood-floor-normal.jpg",
    "runtime/client/public/assets/room/wood-floor-roughness.jpg",
    "runtime/client/public/assets/room/white-plaster-normal.jpg",
    "runtime/client/public/assets/room/white-plaster-roughness.jpg",
    "runtime/client/public/assets/room/README.md",
    "runtime/client/public/assets/CHAIR-LICENSE.md",
    "runtime/client/public/assets/VELVET-SOFA-LICENSE.md",
    "runtime/client/public/assets/REFRIGERATOR-LICENSE.md",
    "licenses/Node-LICENSE.txt",
    "licenses/Newtonsoft-LICENSE.txt",
    "licenses/Three-LICENSE.txt",
    "licenses/ASSET-LICENSES.md",
  ]) {
    assert.ok((await stat(join(bundle, file))).size > 0, file);
  }
  const models = {
    "sofa.glb":
      "5349e042ad41e695e89f1110230c4ee0c75b2bc62ef830c7016be6ecf665bfb6",
    "chair.glb":
      "f0af2a2b102d28d540236306ae19f8fb36842df76bd38cf76f063f9bd2853399",
    "velvet-sofa.glb":
      "67202c74a1a33377771f162dc7fad612a6c9bd51ee15124c488e9851d9ac5266",
    "refrigerator.glb":
      "ef8da8b144e650c277ac953e6d9e50ac1689ff1ee88c2c5bd9551ae8bccb6065",
    "room/wood-floor-diffuse.jpg":
      "2a1c07687b6dbb214c4b9213739c6d92d425f1f0fc8ab3ac157f105d78240789",
    "room/wood-floor-normal.jpg":
      "452247f0d0d1b7fc7f8324ff3b6ed60bcc6de1405f4284eeb8d9bce90d4939c2",
    "room/wood-floor-roughness.jpg":
      "061f1e1293251b2d28c76e3fac1ea9452b0e8648bb8f9b3728e09db386166e5c",
    "room/white-plaster-normal.jpg":
      "eb572ca3630d5bfde72e2601b1f02412da23ca005cd19384dced8690be4cb783",
    "room/white-plaster-roughness.jpg":
      "4ff1fe957cd161b07f721fe6c28a9459c8c2e8ec65627a26c16e483a07c80d85",
  };
  for (const [file, hash] of Object.entries(models)) {
    const model = await readFile(
      join(bundle, "runtime/client/public/assets", file),
    );
    assert.equal(createHash("sha256").update(model).digest("hex"), hash);
  }
  const credits = await readFile(
    join(bundle, "licenses/ASSET-LICENSES.md"),
    "utf8",
  );
  const visibleCredits = await readFile(
    join(bundle, "runtime/client/public/index.html"),
    "utf8",
  );
  const sofaCredits = credits
    .split("Glam Velvet Sofa, source:")[1]
    .split("GLB size:")[0];
  const fridgeCredits = credits
    .split("Commercial Refrigerator, source:")[1]
    .split("GLB size:")[0];
  assert.match(sofaCredits, /Eric Chadwick/);
  assert.match(fridgeCredits, /Eric Chadwick/);
  assert.match(credits, /Wood Floor by Dimitrios Savva/);
  assert.match(credits, /White Plaster 02 by Rob Tuytel/);
  assert.match(visibleCredits, /木地板与浅色墙面 PBR 材质：Poly Haven，CC0/);
  assert.match(visibleCredits, /Glam Velvet Sofa：[\s\S]*Eric Chadwick/);
  assert.match(
    visibleCredits,
    /Commercial Refrigerator：[\s\S]*Eric[\s\S]*Chadwick/,
  );
});
test("bundle manifest records exact checksums and excludes credentials and user database", async () => {
  const manifest = JSON.parse(
    (await readFile(join(bundle, "manifest.json"), "utf8")).replace(
      /^\uFEFF/,
      "",
    ),
  );
  assert.match(manifest.sourceRevision, /^[0-9a-f]{40}$/);
  for (const item of manifest.files) {
    assert.doesNotMatch(
      item.path,
      /(\.env|sqlite|\.db$|node_modules\/playwright|tests\/)/i,
    );
    const content = await readFile(join(bundle, item.path));
    assert.equal(
      createHash("sha256").update(content).digest("hex"),
      item.sha256,
    );
  }
  assert.ok(manifest.files.length > 30);
});
test(
  "native launcher starts packaged loopback server and stops owned service",
  { timeout: 30000 },
  async () => {
    const { spawnSync } = await import("node:child_process");
    const child = spawnSync(join(bundle, "智能家居.exe"), ["--smoke-test"], {
      encoding: "utf8",
      timeout: 20000,
    });
    assert.equal(child.status, 0, child.stderr);
    assert.match(child.stdout, /PACKAGED_SERVER_OK \d+/);
    const port = Number(child.stdout.match(/\d+/)[0]);
    await assert.rejects(fetch(`http://127.0.0.1:${port}`));
  },
);
