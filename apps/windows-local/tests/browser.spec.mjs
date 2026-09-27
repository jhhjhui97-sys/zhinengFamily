import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createLocalServer } from "../server.mjs";
const root = resolve(import.meta.dirname, "../../..");
async function setup(t) {
  const data = await mkdtemp(join(tmpdir(), "family-browser-"));
  const server = createLocalServer({
    bridgePath: join(root, ".local/windows-bridge/LocalBridge.exe"),
    dataDirectory: data,
    protocolDirectory: join(root, "apps/unity-client/Assets/StreamingAssets"),
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1500, height: 1000 },
  });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === url
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  t.after(async () => {
    await browser.close();
    await new Promise((r) => server.close(r));
  });
  await page.goto(url);
  return { page, errors };
}
async function project(page) {
  await page.locator("#project-name").fill("张先生 · 龙湖小区120㎡");
  await page.getByRole("button", { name: "新建方案", exact: true }).click();
  await page.getByRole("button", { name: "载入两室一厅", exact: true }).click();
  await page
    .locator('canvas[data-model-loaded="true"]')
    .waitFor({ timeout: 30000 });
}
test(
  "actual offline render, furniture edit v2, immutable restore v3 and page reload",
  { timeout: 60000 },
  async (t) => {
    const { page, errors } = await setup(t);
    await project(page);
    await page.getByRole("button", { name: "保存新版本", exact: true }).click();
    await page.locator("#revision").filter({ hasText: "当前 v1" }).waitFor();
    await page.locator("#furniture-x").fill("3500");
    await page
      .getByRole("button", { name: "更新家具位置", exact: true })
      .click();
    await page.getByRole("button", { name: "保存新版本", exact: true }).click();
    await page.locator("#revision").filter({ hasText: "当前 v2" }).waitFor();
    await page.getByRole("button", { name: "查看 v1", exact: true }).click();
    await page.getByRole("button", { name: "恢复此版本", exact: true }).click();
    await page.getByRole("button", { name: "确认恢复", exact: true }).click();
    await page.locator("#revision").filter({ hasText: "当前 v3" }).waitFor();
    await page.reload();
    await page.getByRole("button", { name: /张先生 · 龙湖小区120㎡/ }).click();
    await page.locator("#revision").filter({ hasText: "当前 v3" }).waitFor();
    await page.locator('canvas[data-model-loaded="true"]').waitFor();
    await page
      .locator("#message")
      .filter({ hasText: "已打开本地方案" })
      .waitFor();
    await page.waitForFunction(() => !document.querySelector("#save").disabled);
    await mkdir(join(root, ".local/windows-evidence"), { recursive: true });
    await page.screenshot({
      path: join(root, ".local/windows-evidence/runtime-room.png"),
    });
    assert.equal(errors.length, 0, errors.join("\n"));
    assert.equal(
      await page.evaluate(() => localStorage.length + sessionStorage.length),
      0,
    );
  },
);
test(
  "invalid JSON never writes a new version",
  { timeout: 45000 },
  async (t) => {
    const { page } = await setup(t);
    await project(page);
    await page.locator("#advanced").click();
    await page.locator("#scene-json").fill('{"x":1e400}');
    await page.getByRole("button", { name: "应用 JSON", exact: true }).click();
    await page
      .locator("#message")
      .filter({ hasText: /不符合|非法/ })
      .waitFor();
    assert.match(await page.locator("#revision").textContent(), /未保存/);
  },
);

test(
  "stale browser save shows conflict and preserves unsaved furniture changes",
  { timeout: 45000 },
  async (t) => {
    const { page } = await setup(t);
    await project(page);
    await page.getByRole("button", { name: "保存新版本", exact: true }).click();
    await page.locator("#message").filter({ hasText: "已保存 v1" }).waitFor();
    const origin = new URL(page.url()).origin;
    const call = async (fields) =>
      (
        await page.request.post(origin + "/api/local", {
          headers: { origin },
          data: fields,
        })
      ).json();
    const list = await call({ action: "list" });
    const id = list.data.items[0].id;
    const previous = await call({ action: "current", id });
    previous.data.scene.rooms[0].name = "其他窗口已修改";
    await call({
      action: "save",
      id,
      base_revision: 1,
      scene: previous.data.scene,
    });
    await page.locator("#furniture-x").fill("3500");
    await page
      .getByRole("button", { name: "更新家具位置", exact: true })
      .click();
    await page.getByRole("button", { name: "保存新版本", exact: true }).click();
    await page
      .locator("#message")
      .filter({ hasText: "你的修改已保留" })
      .waitFor();
    assert.equal(await page.locator("#furniture-x").inputValue(), "3500");
    assert.match(await page.locator("#revision").textContent(), /当前 v1/);
    assert.equal((await call({ action: "current", id })).data.revision, 2);
  },
);
test(
  "new empty project clears previous render and history",
  { timeout: 45000 },
  async (t) => {
    const { page } = await setup(t);
    await project(page);
    await page.getByRole("button", { name: "保存新版本", exact: true }).click();
    await page.locator("#message").filter({ hasText: "已保存 v1" }).waitFor();
    await page.locator("#project-name").fill("新方案");
    await page.getByRole("button", { name: "新建方案", exact: true }).click();
    await page.locator("#message").filter({ hasText: "方案已建立" }).waitFor();
    assert.equal(
      await page.locator("canvas").getAttribute("data-model-loaded"),
      "false",
    );
    assert.equal(
      await page.getByRole("button", { name: "查看 v1", exact: true }).count(),
      0,
    );
    assert.equal(await page.locator("#empty-view").isVisible(), true);
  },
);
