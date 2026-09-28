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
    "runtime/bridge/LocalBridge.exe",
    "runtime/bridge/LocalScenes.dll",
    "runtime/bridge/Newtonsoft.Json.dll",
    "runtime/client/protocol/scene.schema.json",
    "runtime/client/protocol/two-bedroom.json",
    "runtime/client/public/assets/sofa.glb",
    "licenses/Node-LICENSE.txt",
    "licenses/Newtonsoft-LICENSE.txt",
    "licenses/Three-LICENSE.txt",
    "licenses/ASSET-LICENSES.md",
  ]) {
    assert.ok((await stat(join(bundle, file))).size > 0, file);
  }
  const model = await readFile(
    join(bundle, "runtime/client/public/assets/sofa.glb"),
  );
  assert.equal(
    createHash("sha256").update(model).digest("hex"),
    "5349e042ad41e695e89f1110230c4ee0c75b2bc62ef830c7016be6ecf665bfb6",
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
