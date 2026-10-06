import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdtemp, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
const { createLocalServer } = await import(
  process.env.FAMILY_BUNDLE
    ? pathToFileURL(
        join(process.env.FAMILY_BUNDLE, "runtime/client/server.mjs"),
      ).href
    : new URL("../server.mjs", import.meta.url).href
);
const root = resolve(import.meta.dirname, "../../..");
async function setup(
  t,
  { trackFrames = false, failFirstCatalog = false } = {},
) {
  const data = await mkdtemp(join(tmpdir(), "family-browser-"));
  const config = {
    bridgePath: process.env.FAMILY_BUNDLE
      ? join(process.env.FAMILY_BUNDLE, "runtime/bridge/LocalBridge.exe")
      : join(root, ".local/windows-bridge/LocalBridge.exe"),
    dataDirectory: data,
    protocolDirectory: process.env.FAMILY_BUNDLE
      ? join(process.env.FAMILY_BUNDLE, "runtime/client/protocol")
      : join(root, "apps/unity-client/Assets/StreamingAssets"),
    publicDirectory: process.env.FAMILY_BUNDLE
      ? join(process.env.FAMILY_BUNDLE, "runtime/client/public")
      : join(root, "apps/windows-local/public"),
    vendorDirectory: process.env.FAMILY_BUNDLE
      ? join(process.env.FAMILY_BUNDLE, "runtime/client/node_modules/three")
      : join(root, "apps/windows-local/node_modules/three"),
  };
  let server = createLocalServer(config);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  let url = `http://127.0.0.1:${server.address().port}`;
  let browser;
  t.after(async () => {
    await browser?.close();
    await new Promise((r) => server.close(r));
  });
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width: 1500, height: 1000 },
  });
  if (trackFrames)
    await context.addInitScript(() => {
      const original = window.requestAnimationFrame.bind(window);
      let requests = 0;
      window.requestAnimationFrame = (callback) => {
        requests++;
        return original(callback);
      };
      window.__frameRequests = () => requests;
    });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === url
      ? route.continue()
      : route.abort(),
  );
  if (failFirstCatalog) {
    let first = true;
    await context.route("**/api/local", (route) => {
      if (
        first &&
        JSON.parse(route.request().postData() ?? "{}").action === "catalog"
      ) {
        first = false;
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "temporary" }),
        });
      }
      return route.continue();
    });
  }
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(url);
  await page
    .locator("#customer-count")
    .filter({ hasText: /共 \d+ 位客户/ })
    .waitFor();
  // The initial count is a static placeholder. Wait for startup reads to finish
  // before direct API setup can create a second connection to a fresh database.
  await page.waitForFunction(
    () => !document.querySelector("#customer-create").disabled,
  );
  const restart = async () => {
    await new Promise((r) => server.close(r));
    server = createLocalServer(config);
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    url = `http://127.0.0.1:${server.address().port}`;
    await page.goto(url);
  };
  return { page, errors, restart };
}
async function project(page, requireModel = false) {
  await page.locator("#project-name").fill("张先生 · 龙湖小区120㎡");
  await page.getByRole("button", { name: "新建方案", exact: true }).click();
  await page.getByRole("button", { name: "载入两室一厅", exact: true }).click();
  await page.locator("#message").filter({ hasText: "示例已载入" }).waitFor();
  if (requireModel)
    await page
      .locator('canvas[data-model-loaded="true"]')
      .waitFor({ timeout: 90000 });
}
async function fillProduct(page, overrides = {}) {
  const values = {
    category: "chair",
    brand: "门店品牌",
    name: "尺寸商品椅",
    sku: "DIM-CHAIR-1",
    price: "1200.00",
    width: "800",
    depth: "700",
    height: "900",
    metadata: '{"color":"浅灰"}',
    ...overrides,
  };
  for (const [key, value] of Object.entries(values))
    await page.locator(`#product-${key}`).fill(value);
}

const dxfRoom = (x1, y1, x2, y2) =>
  `0\nLWPOLYLINE\n8\nROOM\n90\n4\n70\n1\n10\n${x1}\n20\n${y1}\n10\n${x2}\n20\n${y1}\n10\n${x2}\n20\n${y2}\n10\n${x1}\n20\n${y2}\n`;
const dxfLine = (layer, x1, y1, x2, y2) =>
  `0\nLINE\n8\n${layer}\n10\n${x1}\n20\n${y1}\n11\n${x2}\n21\n${y2}\n`;
const dxfBytes = (entities, units = 4) =>
  Buffer.from(
    `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n${units}\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`,
  );
async function localDxfProject(page, sceneName) {
  await page.locator("#customer-name").fill("DXF 客户");
  await page.getByRole("button", { name: "保存客户", exact: true }).click();
  await page
    .locator("#selected-customer")
    .filter({ hasText: "DXF 客户" })
    .waitFor();
  await page.locator("#sales-project-name").fill("DXF 房屋项目");
  await page.getByRole("button", { name: "保存项目", exact: true }).click();
  await page
    .locator("#selected-project")
    .filter({ hasText: "DXF 房屋项目" })
    .waitFor();
  await page.locator("#project-name").fill(sceneName);
  await page.getByRole("button", { name: "新建方案", exact: true }).click();
}
test(
  "dimensions-only products refresh immediately, preserve saved scenes and quotes, and furniture deletion saves a new version",
  { timeout: 180000 },
  async (t) => {
    const { page, errors } = await setup(t);
    const origin = new URL(page.url()).origin;
    const call = async (body) => {
      const response = await page.request.post(`${origin}/api/local`, {
        headers: { origin },
        data: body,
      });
      const result = await response.json();
      assert.equal(response.status(), 200, JSON.stringify(result));
      return result.data;
    };
    await page.getByRole("button", { name: "商品管理", exact: true }).click();
    await fillProduct(page);
    await page
      .getByRole("button", { name: "新建在售商品", exact: true })
      .click();
    await page
      .locator("#product-message")
      .filter({ hasText: "商品已保存在本机" })
      .waitFor();
    const product = (await call({ action: "products", search: "DIM-CHAIR-1" }))
      .items[0];
    assert.equal(product.active_asset_id, null);
    // The design page is still hidden: no page switch or reload may be needed.
    assert.equal(
      await page
        .locator(`#catalog-select option[value="${product.id}"]`)
        .textContent(),
      "在售 · 尺寸商品椅（尺寸模型）",
    );
    await page.getByRole("button", { name: "设计工作台", exact: true }).click();
    await localDxfProject(page, "尺寸商品方案");
    await page
      .getByRole("button", { name: "载入两室一厅", exact: true })
      .click();
    await page.locator("#catalog-select").selectOption(product.id);
    await page.getByRole("button", { name: "放入场景", exact: true }).click();
    await page
      .locator("#message")
      .filter({ hasText: "尺寸商品椅已放入场景" })
      .waitFor();
    await page
      .locator('canvas[data-model-loaded="true"][data-dimension-models="1"]')
      .waitFor({ timeout: 90000 });
    const original = JSON.parse(await page.locator("#scene-json").inputValue());
    const placed = original.furniture_instances.find(
      (item) => item.product_id === product.id,
    );
    assert.ok(placed);
    assert.equal(placed.asset_id, null);
    assert.equal(placed.metadata.offline_catalog_only, false);
    assert.equal(placed.metadata.model_kind, "dimensions");
    await page.getByRole("button", { name: "保存新版本", exact: true }).click();
    await page.locator("#revision").filter({ hasText: "当前 v1" }).waitFor();
    await page.getByRole("button", { name: "生成报价", exact: true }).click();
    await page
      .locator("#quote-total")
      .filter({ hasText: "合计 ¥1,200" })
      .waitFor();
    assert.equal(
      await page.locator("#quote-total").textContent(),
      "合计 ¥1,200",
    );
    await page
      .locator("#quote-lines")
      .filter({ hasText: "DIM-CHAIR-1" })
      .waitFor();
    await page.getByRole("button", { name: "商品管理", exact: true }).click();
    await page
      .getByRole("button", { name: "编辑 尺寸商品椅", exact: true })
      .click();
    await page.waitForFunction(
      () => document.activeElement === document.querySelector("#product-name"),
    );
    assert.equal(
      await page
        .locator("#product-name")
        .evaluate((element) => element === document.activeElement),
      true,
    );
    await page.locator("#product-name").fill("更新后的尺寸椅");
    await page.locator("#product-width").fill("1000");
    await page
      .getByRole("button", { name: "更新在售商品", exact: true })
      .click();
    await page
      .locator("#product-message")
      .filter({ hasText: "商品资料已更新" })
      .waitFor();
    assert.match(
      await page
        .locator(`#catalog-select option[value="${product.id}"]`)
        .textContent(),
      /更新后的尺寸椅/,
    );
    assert.deepEqual(
      JSON.parse(await page.locator("#scene-json").inputValue()),
      original,
    );
    page.once("dialog", (dialog) => dialog.dismiss());
    await page
      .getByRole("button", { name: "删除 更新后的尺寸椅", exact: true })
      .click();
    assert.equal(
      (await call({ action: "products", search: "DIM-CHAIR-1" })).total,
      1,
    );
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "删除当前商品", exact: true })
      .click();
    await page
      .locator("#product-message")
      .filter({ hasText: "商品已删除" })
      .waitFor();
    assert.equal(
      await page
        .locator(`#catalog-select option[value="${product.id}"]`)
        .count(),
      0,
    );
    assert.deepEqual(
      JSON.parse(await page.locator("#scene-json").inputValue()),
      original,
    );
    await page.getByRole("button", { name: "设计工作台", exact: true }).click();
    assert.match(
      await page.locator("#quote-lines").textContent(),
      /尺寸商品椅.*DIM-CHAIR-1/s,
    );
    assert.equal(
      await page.locator("#quote-total").textContent(),
      "合计 ¥1,200",
    );
    await page.locator("#furniture-select").selectOption(placed.id);
    page.once("dialog", (dialog) => dialog.dismiss());
    await page
      .getByRole("button", { name: "删除当前家具", exact: true })
      .click();
    assert.deepEqual(
      JSON.parse(await page.locator("#scene-json").inputValue()),
      original,
    );
    const rejectRemoval = (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      return body.action === "validate"
        ? route.fulfill({
            status: 422,
            contentType: "application/json",
            body: JSON.stringify({ error: "场景校验失败，请重试" }),
          })
        : route.continue();
    };
    await page.route("**/api/local", rejectRemoval);
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "删除当前家具", exact: true })
      .click();
    await page
      .locator("#message")
      .filter({ hasText: "场景校验失败" })
      .waitFor();
    assert.deepEqual(
      JSON.parse(await page.locator("#scene-json").inputValue()),
      original,
    );
    await page.unroute("**/api/local", rejectRemoval);
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "删除当前家具", exact: true })
      .click();
    await page
      .locator("#message")
      .filter({ hasText: "请保存新版本" })
      .waitFor();
    const removed = JSON.parse(await page.locator("#scene-json").inputValue());
    assert.deepEqual(
      removed.furniture_instances,
      original.furniture_instances.filter((item) => item.id !== placed.id),
    );
    assert.notEqual(
      await page.locator("#furniture-select").inputValue(),
      placed.id,
    );
    await page.getByRole("button", { name: "保存新版本", exact: true }).click();
    await page.locator("#revision").filter({ hasText: "当前 v2" }).waitFor();
    await page.getByRole("button", { name: "查看 v1", exact: true }).click();
    assert.match(
      await page.locator("#history-json").textContent(),
      new RegExp(placed.id),
    );
    await page.getByRole("button", { name: "恢复此版本", exact: true }).click();
    await page.getByRole("button", { name: "确认恢复", exact: true }).click();
    await page.locator("#revision").filter({ hasText: "当前 v3" }).waitFor();
    await page
      .locator('canvas[data-model-loaded="true"][data-dimension-models="1"]')
      .waitFor({ timeout: 90000 });
    assert.deepEqual(
      JSON.parse(await page.locator("#scene-json").inputValue())
        .furniture_instances,
      original.furniture_instances,
    );
    assert.deepEqual(
      errors.filter((error) => !error.includes("422")),
      [],
    );
  },
);
test(
  "GLB import creates a new product with an existing selection and preserves files after invalid or duplicate inputs",
  { timeout: 120000 },
  async (t) => {
    const { page } = await setup(t);
    const origin = new URL(page.url()).origin;
    const products = async () =>
      (
        await (
          await page.request.post(`${origin}/api/local`, {
            headers: { origin },
            data: { action: "products" },
          })
        ).json()
      ).data;
    await page.getByRole("button", { name: "商品管理", exact: true }).click();
    await fillProduct(page);
    await page
      .getByRole("button", { name: "新建在售商品", exact: true })
      .click();
    await page
      .locator("#product-message")
      .filter({ hasText: "商品已保存在本机" })
      .waitFor();
    const original = (await products()).items[0];
    const picker = page.locator("#product-model-file");
    await picker.setInputFiles(
      join(root, "apps/windows-local/public/assets/chair.glb"),
    );
    let stagedUploads = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/model-files")
        stagedUploads++;
    });
    await page.locator("#product-width").fill("0");
    await page
      .getByRole("button", { name: "导入模型并新建商品", exact: true })
      .click();
    await page
      .locator("#product-message")
      .filter({ hasText: "尺寸必须" })
      .waitFor();
    assert.equal(stagedUploads, 0);
    assert.equal((await products()).total, 1);
    await page.locator("#product-width").fill("800");
    await page
      .getByRole("button", { name: "导入模型并新建商品", exact: true })
      .click();
    await page.locator("#product-message").filter({ hasText: /SKU/ }).waitFor();
    assert.equal((await products()).total, 1);
    assert.equal(await picker.evaluate((element) => element.files.length), 1);
    await fillProduct(page, { name: "新模型椅", sku: "MODEL-NEW-1" });
    await picker.setInputFiles({
      name: "broken.glb",
      mimeType: "model/gltf-binary",
      buffer: Buffer.from("broken"),
    });
    await page
      .getByRole("button", { name: "导入模型并新建商品", exact: true })
      .click();
    await page.locator("#product-message.error").waitFor();
    assert.equal((await products()).total, 1);
    assert.equal(
      await picker.evaluate((element) => element.files[0].name),
      "broken.glb",
    );
    await picker.setInputFiles(
      join(root, "apps/windows-local/public/assets/chair.glb"),
    );
    await page
      .getByRole("button", { name: "导入模型并新建商品", exact: true })
      .click();
    await page
      .locator("#product-message")
      .filter({ hasText: "模型已导入，并新建在售商品" })
      .waitFor();
    const saved = await products();
    assert.equal(saved.total, 2);
    const imported = saved.items.find((item) => item.sku === "MODEL-NEW-1");
    assert.ok(imported.active_asset_id);
    assert.notEqual(imported.id, original.id);
    assert.equal(
      saved.items.find((item) => item.id === original.id).active_asset_id,
      null,
    );
    assert.equal(
      saved.items.find((item) => item.id === original.id).name,
      "尺寸商品椅",
    );
    assert.match(
      await page
        .locator(`#catalog-select option[value="${imported.id}"]`)
        .textContent(),
      /在售 · 新模型椅/,
    );
    assert.doesNotMatch(
      await page
        .locator(`#catalog-select option[value="${imported.id}"]`)
        .textContent(),
      /尺寸模型/,
    );
    assert.equal(await picker.evaluate((element) => element.files.length), 0);
  },
);
test(
  "customer can be removed and restored with the same project and scene",
  { timeout: 120000 },
  async (t) => {
    const { page } = await setup(t);
    await localDxfProject(page, "保留方案");
    const origin = new URL(page.url()).origin;
    const call = async (body) =>
      (
        await page.request.post(`${origin}/api/local`, {
          headers: { origin },
          data: body,
        })
      ).json();
    const customerId = (await call({ action: "customers" })).data.items[0].id;
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "移出客户", exact: true }).click();
    await page
      .locator("#customer-count")
      .filter({ hasText: "共 0 位客户" })
      .waitFor();
    assert.equal(
      (await call({ action: "customer", id: customerId })).status,
      404,
    );
    await page.getByRole("button", { name: "已移出客户", exact: true }).click();
    await page
      .getByRole("button", { name: "恢复 DXF 客户", exact: true })
      .click();
    await page
      .locator("#customer-count")
      .filter({ hasText: "共 1 位客户" })
      .waitFor();
    await page.getByRole("button", { name: "DXF 客户", exact: true }).click();
    await page
      .getByRole("button", { name: "DXF 房屋项目", exact: true })
      .click();
    await page.getByRole("button", { name: "保留方案", exact: true }).waitFor();
  },
);

test(
  "DXF import previews two project rooms and a separate wall layer, then saves locally",
  { timeout: 120000 },
  async (t) => {
    const { page, errors, restart } = await setup(t);
    await localDxfProject(page, "DXF 本地方案");
    await page
      .getByRole("button", { name: "导入 DXF 户型", exact: true })
      .click();
    const bytes = dxfBytes(
      dxfRoom(0, 0, 4200, 3000) +
        dxfRoom(4200, 0, 8000, 3000) +
        dxfLine("WALL", 0, 0, 4200, 0),
    );
    await page.locator("#dxf-file").setInputFiles({
      name: "room.dxf",
      mimeType: "application/dxf",
      buffer: bytes,
    });
    await page.locator("#dxf-room-layer").selectOption("ROOM");
    await page.locator("#dxf-wall-layer").selectOption("WALL");
    await page.locator("#dxf-preview polygon").first().waitFor();
    assert.equal(await page.locator("#dxf-preview polygon").count(), 2);
    await page.locator("#dxf-confirm-units").check();
    await page
      .getByRole("button", { name: "生成 3D 草稿", exact: true })
      .click();
    await page
      .locator("#scene-stats")
      .filter({ hasText: "2 个房间 · 1 段墙体" })
      .waitFor();
    await page.getByRole("button", { name: "保存新版本", exact: true }).click();
    await page.locator("#revision").filter({ hasText: "当前 v1" }).waitFor();
    await page
      .locator('canvas[data-room-material-loaded="true"]')
      .waitFor({ timeout: 90000 });
    assert.equal(errors.length, 0, errors.join("\n"));
    await restart();
    await page.getByRole("button", { name: "DXF 客户", exact: true }).click();
    await page
      .getByRole("button", { name: "DXF 房屋项目", exact: true })
      .click();
    await page
      .getByRole("button", { name: "DXF 本地方案", exact: true })
      .click();
    await page.locator("#revision").filter({ hasText: "当前 v1" }).waitFor();
    assert.equal(errors.length, 0, errors.join("\n"));
  },
);

test(
  "unitless DXF needs line calibration and a failed import preserves a dirty draft",
  { timeout: 120000 },
  async (t) => {
    const { page, errors, restart } = await setup(t);
    await localDxfProject(page, "待校准方案");
    await page
      .getByRole("button", { name: "载入两室一厅", exact: true })
      .click();
    await page
      .locator("#scene-stats")
      .filter({ hasText: "3 个房间" })
      .waitFor();
    const originalDraft = await page.locator("#scene-json").inputValue();
    await page
      .getByRole("button", { name: "导入 DXF 户型", exact: true })
      .click();
    await page.locator("#dxf-file").setInputFiles({
      name: "unitless.dxf",
      mimeType: "application/dxf",
      buffer: dxfBytes(dxfRoom(0, 0, 4, 3) + dxfLine("WALL", 0, 0, 4, 3), 0),
    });
    await page.locator("#dxf-room-layer").selectOption("WALL");
    await page.locator("#dxf-preview line").first().click();
    await page.locator("#dxf-length").fill("5000");
    await page.locator("#dxf-scale").filter({ hasText: "1000 mm" }).waitFor();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "生成 3D 草稿", exact: true })
      .click();
    await page
      .locator("#message")
      .filter({ hasText: "没有闭合房间轮廓" })
      .waitFor();
    assert.equal(await page.locator("#scene-json").inputValue(), originalDraft);
    await page.locator("#dxf-room-layer").selectOption("ROOM");
    await page.locator("#dxf-wall-layer").selectOption("WALL");
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "生成 3D 草稿", exact: true })
      .click();
    await page
      .locator("#scene-stats")
      .filter({ hasText: "1 个房间" })
      .waitFor();
    await page.getByRole("button", { name: "保存新版本", exact: true }).click();
    await page.locator("#revision").filter({ hasText: "当前 v1" }).waitFor();
    await page
      .locator('canvas[data-room-material-loaded="true"]')
      .waitFor({ timeout: 90000 });
    assert.equal(errors.length, 0, errors.join("\n"));
    await restart();
    await page.getByRole("button", { name: "DXF 客户", exact: true }).click();
    await page
      .getByRole("button", { name: "DXF 房屋项目", exact: true })
      .click();
    await page.getByRole("button", { name: "待校准方案", exact: true }).click();
    await page.locator("#revision").filter({ hasText: "当前 v1" }).waitFor();
    assert.equal(errors.length, 0, errors.join("\n"));
  },
);
test(
  "startup retries a transient local catalog failure",
  { timeout: 90000 },
  async (t) => {
    const { page } = await setup(t, { failFirstCatalog: true });
    await page.waitForFunction(
      () => document.querySelectorAll("#catalog-select option").length === 4,
    );
    assert.doesNotMatch(
      await page.locator("#message").textContent(),
      /家具目录暂不可用/,
    );
  },
);

test(
  "offline customer to project to scene survives service restart and keeps legacy scenes separate",
  { timeout: 120000 },
  async (t) => {
    const { page, errors, restart } = await setup(t);
    await page.locator("#project-name").fill("旧方案");
    await page.getByRole("button", { name: "新建方案", exact: true }).click();
    await page.locator("#customer-name").fill("张先生");
    await page.locator("#customer-phone").fill("13800000000");
    await page.locator("#customer-budget").fill("80000.50");
    await page.getByRole("button", { name: "保存客户", exact: true }).click();
    await page
      .locator("#selected-customer")
      .filter({ hasText: "张先生" })
      .waitFor();
    assert.equal(await page.locator("#project-name").inputValue(), "");
    await page.locator("#sales-project-name").fill("龙湖小区120㎡");
    await page.locator("#sales-project-address").fill("杭州龙湖小区");
    await page.getByRole("button", { name: "保存项目", exact: true }).click();
    await page
      .locator("#selected-project")
      .filter({ hasText: "龙湖小区120㎡" })
      .waitFor();
    await page
      .locator("#message")
      .filter({ hasText: "可以新建方案" })
      .waitFor();
    assert.equal(
      await page.getByRole("button", { name: "旧方案", exact: true }).count(),
      0,
    );
    await page.locator("#project-name").fill("客厅设计");
    await page.getByRole("button", { name: "新建方案", exact: true }).click();
    await page
      .getByRole("button", { name: "载入两室一厅", exact: true })
      .click();
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
    await page.locator('canvas[data-room-material-loaded="true"]').waitFor();
    await restart();
    await page.getByRole("button", { name: "张先生", exact: true }).click();
    await page
      .getByRole("button", { name: "龙湖小区120㎡", exact: true })
      .click();
    await page.getByRole("button", { name: "客厅设计", exact: true }).click();
    await page.locator("#revision").filter({ hasText: "当前 v3" }).waitFor();
    await page.getByRole("button", { name: "查看 v1", exact: true }).waitFor();
    await mkdir(join(root, ".local/windows-evidence"), { recursive: true });
    await page.screenshot({
      path: join(root, ".local/windows-evidence/offline-sales-room.png"),
    });
    assert.equal(
      await page.getByRole("button", { name: "查看 v1", exact: true }).count(),
      1,
    );
    assert.equal(
      await page.getByRole("button", { name: "查看 v2", exact: true }).count(),
      1,
    );
    await page.getByRole("button", { name: "旧方案入口", exact: true }).click();
    await page.getByRole("button", { name: "旧方案", exact: true }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: "客厅设计", exact: true }).count(),
      0,
    );
    assert.equal(errors.length, 0, errors.join("\n"));
    assert.equal(
      await page.evaluate(() => localStorage.length + sessionStorage.length),
      0,
    );
  },
);
test(
  "offline products create filter paginate edit and survive local-service restart",
  { timeout: 120000 },
  async (t) => {
    const { page, restart, errors } = await setup(t);
    await page.getByRole("button", { name: "商品管理", exact: true }).click();
    await page.locator("#product-category").fill("sofa");
    await page.locator("#product-brand").fill("示例品牌");
    await page.locator("#product-name").fill("三人沙发");
    await page.locator("#product-sku").fill("SOFA-001");
    await page.locator("#product-price").fill("6800.50");
    await page.locator("#product-width").fill("2400");
    await page.locator("#product-depth").fill("950");
    await page.locator("#product-height").fill("850");
    await page.locator("#product-metadata").fill('{"color":"浅灰"}');
    await page
      .getByRole("button", { name: "新建在售商品", exact: true })
      .click();
    await page
      .locator("#product-detail")
      .filter({ hasText: "SOFA-001" })
      .waitFor();
    await page
      .locator("#products-items")
      .filter({ hasText: "SOFA-001" })
      .waitFor();
    assert.match(
      await page.locator("#products-items").textContent(),
      /¥6,800.50/,
    );
    assert.match(
      await page.locator("#products-items").textContent(),
      /2400 × 950 × 850 mm/,
    );
    assert.match(
      await page.locator("#product-detail").textContent(),
      /暂无与该 SKU 对应的真实 3D 模型/,
    );
    const origin = new URL(page.url()).origin;
    const call = async (body) =>
      (
        await page.request.post(`${origin}/api/local`, {
          headers: { origin },
          data: body,
        })
      ).json();
    for (let i = 0; i < 22; i++) {
      const result = await call({
        action: "product_create",
        category: "bed",
        brand: "木作",
        name: `床架${i}`,
        sku: `BED-${String(i).padStart(3, "0")}`,
        price: "3999.90",
        width_mm: 2000,
        depth_mm: 1800,
        height_mm: 500,
      });
      assert.equal(result.status, 200);
    }
    await page.locator("#products-search").fill("床架");
    await page.locator("#products-category-filter").fill("bed");
    await page.getByRole("button", { name: "搜索商品", exact: true }).click();
    await page
      .locator("#products-count")
      .filter({ hasText: "共 22 件" })
      .waitFor();
    await page.setViewportSize({ width: 1024, height: 768 });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= 1024),
    );
    await page.locator("#products-page").evaluate((element) => {
      element.scrollTop = 0;
    });
    await mkdir(join(root, ".local/windows-evidence"), { recursive: true });
    await page.screenshot({
      path: join(root, ".local/windows-evidence/offline-products.png"),
    });
    await page
      .getByRole("button", { name: "下一页", exact: true })
      .last()
      .click();
    await page
      .locator("#products-count")
      .filter({ hasText: "显示 21–22" })
      .waitFor();
    assert.equal(await page.locator("#products-search").inputValue(), "床架");
    assert.equal(
      await page.locator("#products-category-filter").inputValue(),
      "bed",
    );
    await page.locator("#products-search").fill("SOFA");
    await page.locator("#products-category-filter").fill("sofa");
    await page.getByRole("button", { name: "搜索商品", exact: true }).click();
    await page
      .locator("#products-count")
      .filter({ hasText: "共 1 件" })
      .waitFor();
    await page
      .getByRole("button", { name: "查看 三人沙发", exact: true })
      .click();
    const product = (await call({ action: "products", search: "SOFA" })).data
      .items[0];
    await call({
      action: "product_update",
      id: product.id,
      base_revision: 1,
      category: "sofa",
      brand: "其他窗口",
      name: "三人沙发",
      sku: "SOFA-001",
      price: "7000.00",
      width_mm: 2400,
      depth_mm: 950,
      height_mm: 850,
    });
    await page.locator("#product-price").fill("6999.90");
    await page
      .getByRole("button", { name: "更新在售商品", exact: true })
      .click();
    await page
      .locator("#product-message")
      .filter({ hasText: /修改已保留|信息已变化/ })
      .waitFor();
    assert.equal(await page.locator("#product-price").inputValue(), "6999.90");
    await restart();
    await page.getByRole("button", { name: "商品管理", exact: true }).click();
    await page.locator("#products-search").fill("SOFA");
    await page.getByRole("button", { name: "搜索商品", exact: true }).click();
    await page
      .getByRole("button", { name: "查看 三人沙发", exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelector("#product-price").value === "7000.00",
    );
    assert.equal(await page.locator("#product-price").inputValue(), "7000.00");
    assert.equal(
      await page.evaluate(() => localStorage.length + sessionStorage.length),
      0,
    );
    assert.equal(
      errors.filter((error) => !error.includes("409 (Conflict)")).length,
      0,
      errors.join("\n"),
    );
  },
);
test(
  "offline product form rejects invalid metadata price and dimensions before any write",
  { timeout: 90000 },
  async (t) => {
    const { page } = await setup(t);
    await page.getByRole("button", { name: "商品管理", exact: true }).click();
    await page.locator("#product-category").fill("bed");
    await page.locator("#product-brand").fill("品牌");
    await page.locator("#product-name").fill("床架");
    await page.locator("#product-sku").fill("BED-1");
    await page.locator("#product-price").fill("3999.90");
    await page.locator("#product-width").fill("2000");
    await page.locator("#product-depth").fill("1800");
    await page.locator("#product-height").fill("500");
    let writes = 0;
    page.on("request", (request) => {
      if (
        request.url().endsWith("/api/local") &&
        /product_(create|update)/.test(request.postData() ?? "")
      )
        writes++;
    });
    for (const bad of ["{bad}", '{"x":1e400}', '{"nested":[-1e400]}', "[]"]) {
      await page.locator("#product-metadata").fill(bad);
      await page
        .getByRole("button", { name: "新建在售商品", exact: true })
        .click();
      await page
        .locator("#product-message")
        .filter({ hasText: /JSON|非法数值|对象/ })
        .waitFor();
    }
    await page.locator("#product-metadata").fill("");
    await page.locator("#product-price").fill("1e400");
    await page
      .getByRole("button", { name: "新建在售商品", exact: true })
      .click();
    await page
      .locator("#product-message")
      .filter({ hasText: "价格" })
      .waitFor();
    await page.locator("#product-price").fill("3999.90");
    await page.locator("#product-width").fill("0");
    await page
      .getByRole("button", { name: "新建在售商品", exact: true })
      .click();
    await page
      .locator("#product-message")
      .filter({ hasText: "尺寸" })
      .waitFor();
    assert.equal(writes, 0);
    await page.locator("#product-width").fill("2000");
    await page
      .getByRole("button", { name: "新建在售商品", exact: true })
      .click();
    await page
      .locator("#product-detail")
      .filter({ hasText: "BED-1" })
      .waitFor();
    assert.match(await page.locator("#product-detail").textContent(), /\{\}/);
  },
);
test(
  "saved sellable scene generates an immutable printable local quote",
  { timeout: 180000 },
  async (t) => {
    const { page, restart, errors } = await setup(t);
    let intentionalNetworkAborts = 0;
    const origin = new URL(page.url()).origin;
    const call = async (body) => {
      const response = await page.request.post(`${origin}/api/local`, {
        headers: { origin },
        data: body,
      });
      const result = await response.json();
      assert.equal(response.status(), 200, JSON.stringify(result));
      return result.data;
    };
    const product = await call({
      action: "product_create",
      category: "sofa",
      brand: "门店品牌",
      name: "门店三人沙发",
      sku: "QUOTE-SOFA-1",
      price: "6800.50",
      width_mm: 2400,
      depth_mm: 950,
      height_mm: 850,
    });
    const upload = await page.request.post(
      `${origin}/api/product-models/${product.id}`,
      {
        headers: {
          origin,
          "content-type": "model/gltf-binary",
          "x-base-revision": "1",
        },
        data: await readFile(
          join(root, "apps/windows-local/public/assets/sofa.glb"),
        ),
      },
    );
    assert.equal(upload.status(), 200);
    await page.reload();
    await page.locator("#customer-name").fill("张先生");
    await page.getByRole("button", { name: "保存客户", exact: true }).click();
    await page
      .locator("#selected-customer")
      .filter({ hasText: "张先生" })
      .waitFor();
    await page.locator("#sales-project-name").fill("龙湖小区120㎡");
    await page.getByRole("button", { name: "保存项目", exact: true }).click();
    await page
      .locator("#selected-project")
      .filter({ hasText: "龙湖小区120㎡" })
      .waitFor();
    await page.locator("#project-name").fill("客厅方案");
    await page.getByRole("button", { name: "新建方案", exact: true }).click();
    await page
      .getByRole("button", { name: "载入两室一厅", exact: true })
      .click();
    await page.locator("#catalog-select").selectOption(product.id);
    await page.getByRole("button", { name: "放入场景", exact: true }).click();
    await page.getByRole("button", { name: "保存新版本", exact: true }).click();
    await page.locator("#revision").filter({ hasText: "当前 v1" }).waitFor();
    await page.locator("#furniture-x").fill("2100");
    await page.getByRole("button", { name: "生成报价", exact: true }).click();
    await page.locator("#message").filter({ hasText: "先保存" }).waitFor();
    await page.locator("#furniture-x").fill("2036");
    await page.getByRole("button", { name: "生成报价", exact: true }).click();
    await page
      .locator("#quote-total")
      .filter({ hasText: "¥6,800.50" })
      .waitFor();
    await page
      .locator("#quote-lines")
      .filter({ hasText: "QUOTE-SOFA-1" })
      .waitFor();
    await page
      .locator("#quote-exclusions")
      .filter({ hasText: "1 件演示家具" })
      .waitFor();
    assert.match(
      await page.locator("#quote-exclusions").textContent(),
      /离线示例沙发/,
    );
    await page.locator("#quote-items button").first().waitFor();
    assert.equal(await page.locator("#quote-items button").count(), 1);
    await page
      .getByRole("button", { name: "由此报价创建订单", exact: true })
      .click();
    await page
      .locator("#order-total")
      .filter({ hasText: "¥6,800.50" })
      .waitFor();
    await page.locator("#order-status").filter({ hasText: "草稿" }).waitFor();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "确认订单", exact: true }).click();
    await page.locator("#order-status").filter({ hasText: "已确认" }).waitFor();
    await page.locator("#order-items button").first().waitFor();
    assert.equal(await page.locator("#order-items button").count(), 1);
    await mkdir(join(root, ".local/windows-evidence"), { recursive: true });
    await page.screenshot({
      path: join(root, ".local/windows-evidence/offline-order.png"),
    });
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator("#order-print-view").isVisible(), true);
    await page.pdf({
      path: join(root, ".local/windows-evidence/offline-order.pdf"),
      format: "A4",
      printBackground: true,
    });
    await page.emulateMedia({ media: "screen" });
    await page.locator("#customer-name").fill("尚未保存的新姓名");
    await page.getByRole("button", { name: "生成报价", exact: true }).click();
    await page.locator("#message").filter({ hasText: "先保存" }).waitFor();
    assert.equal(await page.locator("#quote-items button").count(), 1);
    await page.locator("#customer-name").fill("张先生");
    const failQuote = async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      if (body.action === "quotation") {
        intentionalNetworkAborts++;
        await route.abort("failed");
      } else await route.continue();
    };
    await page.route("**/api/local", failQuote);
    await page
      .locator("#quote-items button")
      .filter({ hasText: "¥6,800.50" })
      .click();
    await page
      .locator("#message")
      .filter({ hasText: "本地服务暂时不可用" })
      .waitFor();
    await page.unroute("**/api/local", failQuote);
    errors.length = 0;
    await page
      .locator("#quote-items button")
      .filter({ hasText: "¥6,800.50" })
      .click();
    await page
      .locator("#message")
      .filter({ hasText: "已打开本机报价" })
      .waitFor();
    await page.emulateMedia({ media: "print" });
    assert.equal(await page.locator("#quote-print-view").isVisible(), true);
    assert.equal(await page.locator("#nav-products").isVisible(), false);
    await mkdir(join(root, ".local/windows-evidence"), { recursive: true });
    await page.pdf({
      path: join(root, ".local/windows-evidence/offline-quotation.pdf"),
      format: "A4",
      printBackground: true,
    });
    await page.emulateMedia({ media: "screen" });
    await page.screenshot({
      path: join(root, ".local/windows-evidence/offline-quotation.png"),
    });
    const latest = await call({ action: "product", id: product.id });
    await call({
      action: "product_update",
      id: product.id,
      base_revision: latest.revision,
      category: latest.category,
      brand: latest.brand,
      name: latest.name,
      sku: latest.sku,
      price: "9999.99",
      width_mm: latest.width_mm,
      depth_mm: latest.depth_mm,
      height_mm: latest.height_mm,
      metadata: latest.metadata,
    });
    await page
      .locator("#quote-items button")
      .filter({ hasText: "¥6,800.50" })
      .click();
    await page
      .locator("#quote-total")
      .filter({ hasText: "¥6,800.50" })
      .waitFor();
    assert.match(await page.locator("#quote-total").textContent(), /¥6,800.50/);
    await page.getByRole("button", { name: "生成报价", exact: true }).click();
    await page
      .locator("#quote-items button")
      .filter({ hasText: "¥9,999.99" })
      .waitFor();
    await page.route("**/api/local", failQuote);
    await page.getByRole("button", { name: /¥9,999.99/ }).click();
    await page
      .locator("#message")
      .filter({ hasText: "本地服务暂时不可用" })
      .waitFor();
    assert.equal(await page.locator("#quote-detail").isVisible(), false);
    assert.equal(await page.locator("#quote-print").isEnabled(), false);
    await page.unroute("**/api/local", failQuote);
    errors.length = 0;
    await restart();
    await page.getByRole("button", { name: "张先生", exact: true }).click();
    await page
      .getByRole("button", { name: "龙湖小区120㎡", exact: true })
      .click();
    await page.getByRole("button", { name: "客厅方案", exact: true }).click();
    await page
      .locator("#quote-items button")
      .filter({ hasText: "¥6,800.50" })
      .click();
    await page
      .locator("#quote-total")
      .filter({ hasText: "¥6,800.50" })
      .waitFor();
    assert.match(await page.locator("#quote-total").textContent(), /¥6,800.50/);
    await page.locator("#order-items button").first().click();
    await page.locator("#order-status").filter({ hasText: "已确认" }).waitFor();
    assert.match(await page.locator("#order-total").textContent(), /¥6,800.50/);
    const failOrder = async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      if (body.action === "order") {
        intentionalNetworkAborts++;
        await route.abort("failed");
      } else await route.continue();
    };
    await page.route("**/api/local", failOrder);
    await page.locator("#order-items button").first().click();
    await page
      .locator("#message")
      .filter({ hasText: "本地服务暂时不可用" })
      .waitFor();
    assert.equal(await page.locator("#order-detail").isVisible(), false);
    assert.equal(await page.locator("#order-print").isEnabled(), false);
    await page.unroute("**/api/local", failOrder);
    errors.length = 0;
    await page.locator("#order-items button").first().click();
    await page.locator("#order-status").filter({ hasText: "已确认" }).waitFor();
    const failOrderList = async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      if (body.action === "orders") {
        intentionalNetworkAborts++;
        await route.abort("failed");
      } else await route.continue();
    };
    await page.route("**/api/local", failOrderList);
    await page.getByRole("button", { name: "刷新订单", exact: true }).click();
    await page
      .locator("#message")
      .filter({ hasText: "本地服务暂时不可用" })
      .waitFor();
    assert.equal(await page.locator("#order-detail").isVisible(), false);
    assert.equal(await page.locator("#order-print").isEnabled(), false);
    await page.unroute("**/api/local", failOrderList);
    errors.length = 0;
    await page.getByRole("button", { name: "刷新订单", exact: true }).click();
    await page.locator("#order-items button").first().waitFor();
    await page.waitForFunction(
      () => !document.querySelector("#order-refresh").disabled,
    );
    await page.locator("#sales-project-name").fill("第二项目");
    await page.getByRole("button", { name: "保存项目", exact: true }).click();
    await page
      .locator("#selected-project")
      .filter({ hasText: "第二项目" })
      .waitFor();
    await page
      .getByRole("button", { name: "龙湖小区120㎡", exact: true })
      .click();
    await page.locator("#order-items button").first().waitFor();
    let releaseOrderList;
    const heldOrderList = new Promise((resolve) => {
      releaseOrderList = resolve;
    });
    const slowOrderList = async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      if (body.action === "orders") await heldOrderList;
      await route.continue();
    };
    await page.route("**/api/local", slowOrderList);
    await page.getByRole("button", { name: "刷新订单", exact: true }).click();
    await page.getByRole("button", { name: "第二项目", exact: true }).click();
    await page
      .locator("#message")
      .filter({ hasText: "订单操作尚未完成" })
      .waitFor();
    assert.match(
      await page.locator("#selected-project").textContent(),
      /龙湖小区120㎡/,
    );
    releaseOrderList();
    await page.waitForFunction(
      () => !document.querySelector("#order-refresh").disabled,
    );
    await page.unroute("**/api/local", slowOrderList);
    assert.equal(
      await page.evaluate(() => localStorage.length + sessionStorage.length),
      0,
    );
    const unexpectedErrors = errors.filter(
      (error) => error !== "Failed to load resource: net::ERR_FAILED",
    );
    assert.equal(unexpectedErrors.length, 0, unexpectedErrors.join("\n"));
    assert.ok(
      errors.length <= intentionalNetworkAborts,
      `Unexpected failed resources: ${errors.join("\n")}`,
    );
  },
);
test(
  "imported SKU model stays pinned through scene save restore and service restart",
  { timeout: 180000 },
  async (t) => {
    const { page, restart, errors } = await setup(t);
    const origin = new URL(page.url()).origin;
    const call = async (body) =>
      await (
        await page.request.post(`${origin}/api/local`, {
          headers: { origin },
          data: body,
        })
      ).json();
    const created = await call({
      action: "product_create",
      category: "sofa",
      brand: "门店品牌",
      name: "门店三人沙发",
      sku: "SHOP-SOFA-1",
      price: "6800.50",
      width_mm: 2400,
      depth_mm: 950,
      height_mm: 850,
    });
    assert.equal(created.status, 200);
    const productId = created.data.id;
    await page.getByRole("button", { name: "商品管理", exact: true }).click();
    await page
      .getByRole("button", { name: "查看 门店三人沙发", exact: true })
      .click();
    await page
      .locator("#product-detail")
      .filter({ hasText: "SHOP-SOFA-1" })
      .waitFor();
    await page
      .locator("#product-model-file")
      .setInputFiles(join(root, "apps/windows-local/public/assets/sofa.glb"));
    await page
      .getByRole("button", { name: "导入当前商品 3D 模型", exact: true })
      .click();
    await page
      .locator("#product-detail")
      .filter({ hasText: "已有本机 3D 模型" })
      .waitFor();
    const firstAsset = (await call({ action: "product", id: productId })).data
      .active_asset_id;
    assert.ok(firstAsset);
    await page.getByRole("button", { name: "设计工作台", exact: true }).click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll("#catalog-select option")].some((option) =>
        option.textContent.includes("门店三人沙发"),
      ),
    );
    await page.locator("#customer-name").fill("张先生");
    await page.getByRole("button", { name: "保存客户", exact: true }).click();
    await page
      .locator("#selected-customer")
      .filter({ hasText: "张先生" })
      .waitFor();
    await page.locator("#sales-project-name").fill("龙湖小区120㎡");
    await page.getByRole("button", { name: "保存项目", exact: true }).click();
    await page
      .locator("#selected-project")
      .filter({ hasText: "龙湖小区120㎡" })
      .waitFor();
    await page.locator("#project-name").fill("客厅设计");
    await page.getByRole("button", { name: "新建方案", exact: true }).click();
    await page
      .getByRole("button", { name: "载入两室一厅", exact: true })
      .click();
    await page.locator("#catalog-select").selectOption(productId);
    await page.getByRole("button", { name: "放入场景", exact: true }).click();
    await page.waitForFunction(
      (asset) => document.getElementById("scene-json").value.includes(asset),
      firstAsset,
    );
    await page
      .locator('canvas[data-model-loaded="true"]')
      .waitFor({ timeout: 90000 });
    await mkdir(join(root, ".local/windows-evidence"), { recursive: true });
    await page.screenshot({
      path: join(root, ".local/windows-evidence/offline-sku-model.png"),
    });
    await page.getByRole("button", { name: "保存新版本", exact: true }).click();
    await page.locator("#revision").filter({ hasText: "当前 v1" }).waitFor();
    await page.getByRole("button", { name: "商品管理", exact: true }).click();
    await page
      .getByRole("button", { name: "查看 门店三人沙发", exact: true })
      .click();
    await page
      .locator("#product-detail")
      .filter({ hasText: "SHOP-SOFA-1" })
      .waitFor();
    await page.locator("#product-photo-file").setInputFiles({
      name: "broken.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    await page
      .getByRole("button", { name: "生成近似 3D 模型", exact: true })
      .click();
    await page
      .locator("#product-message")
      .filter({ hasText: "图片无法解码" })
      .waitFor();
    assert.equal(
      (await call({ action: "product", id: productId })).data.active_asset_id,
      firstAsset,
    );
    await page.locator("#product-photo-file").setInputFiles({
      name: "shop-sofa.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
    await page
      .getByRole("button", { name: "生成近似 3D 模型", exact: true })
      .click();
    await page
      .locator("#product-message")
      .filter({ hasText: "尺寸近似模型已保存在本机" })
      .waitFor();
    await page.waitForFunction(
      async ({ productId, firstAsset }) => {
        const response = await fetch("/api/local", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "product", id: productId }),
        });
        return (
          response.ok &&
          (await response.json()).data.active_asset_id !== firstAsset
        );
      },
      { productId, firstAsset },
    );
    const secondAsset = (await call({ action: "product", id: productId })).data
      .active_asset_id;
    assert.notEqual(secondAsset, firstAsset);
    await page.getByRole("button", { name: "设计工作台", exact: true }).click();
    await page.locator("#catalog-select").selectOption(productId);
    await page.getByRole("button", { name: "放入场景", exact: true }).click();
    await page.waitForFunction(
      (asset) => document.getElementById("scene-json").value.includes(asset),
      secondAsset,
    );
    await page.getByRole("button", { name: "保存新版本", exact: true }).click();
    await page.locator("#revision").filter({ hasText: "当前 v2" }).waitFor();
    await page.getByRole("button", { name: "查看 v1", exact: true }).click();
    assert.match(
      await page.locator("#history-json").textContent(),
      new RegExp(firstAsset),
    );
    assert.doesNotMatch(
      await page.locator("#history-json").textContent(),
      new RegExp(secondAsset),
    );
    await page.getByRole("button", { name: "恢复此版本", exact: true }).click();
    await page.getByRole("button", { name: "确认恢复", exact: true }).click();
    await page.locator("#revision").filter({ hasText: "当前 v3" }).waitFor();
    await page.locator('canvas[data-room-material-loaded="true"]').waitFor();
    await restart();
    await page.getByRole("button", { name: "张先生", exact: true }).click();
    await page
      .getByRole("button", { name: "龙湖小区120㎡", exact: true })
      .click();
    await page.getByRole("button", { name: "客厅设计", exact: true }).click();
    await page.locator("#revision").filter({ hasText: "当前 v3" }).waitFor();
    await page
      .locator('canvas[data-model-loaded="true"]')
      .waitFor({ timeout: 90000 });
    assert.match(
      await page.locator("#scene-json").inputValue(),
      new RegExp(firstAsset),
    );
    assert.doesNotMatch(
      await page.locator("#scene-json").inputValue(),
      new RegExp(secondAsset),
    );
    assert.equal(
      await page.evaluate(() => localStorage.length + sessionStorage.length),
      0,
    );
    assert.equal(errors.length, 0, errors.join("\n"));
  },
);
test(
  "invalid and stale SKU model uploads keep the chosen file and saved product",
  { timeout: 90000 },
  async (t) => {
    const { page } = await setup(t);
    const origin = new URL(page.url()).origin;
    const call = async (body) =>
      (
        await (
          await page.request.post(`${origin}/api/local`, {
            headers: { origin },
            data: body,
          })
        ).json()
      ).data;
    const product = await call({
      action: "product_create",
      category: "chair",
      brand: "门店",
      name: "测试椅",
      sku: "CHAIR-UI-1",
      price: "1200.00",
      width_mm: 700,
      depth_mm: 700,
      height_mm: 900,
    });
    await page.getByRole("button", { name: "商品管理", exact: true }).click();
    await page
      .getByRole("button", { name: "查看 测试椅", exact: true })
      .click();
    await page
      .locator("#product-detail")
      .filter({ hasText: "CHAIR-UI-1" })
      .waitFor();
    const picker = page.locator("#product-model-file");
    await page.locator("#product-price").fill("1300.00");
    await picker.setInputFiles(
      join(root, "apps/windows-local/public/assets/sofa.glb"),
    );
    await page
      .getByRole("button", { name: "导入当前商品 3D 模型", exact: true })
      .click();
    await page
      .locator("#product-message")
      .filter({ hasText: "商品资料有未保存的修改" })
      .waitFor();
    assert.equal(await page.locator("#product-price").inputValue(), "1300.00");
    assert.equal(
      (await call({ action: "product", id: product.id })).active_asset_id,
      null,
    );
    await page.locator("#product-price").fill("1200.00");
    await picker.setInputFiles({
      name: "broken.glb",
      mimeType: "model/gltf-binary",
      buffer: Buffer.from("not-a-glb"),
    });
    await page
      .getByRole("button", { name: "导入当前商品 3D 模型", exact: true })
      .click();
    await page
      .locator("#product-message")
      .filter({ hasText: /GLB.*不完整|GLB.*格式/ })
      .waitFor();
    assert.equal(
      (await call({ action: "product", id: product.id })).active_asset_id,
      null,
    );
    assert.equal((await picker.inputValue()).endsWith("broken.glb"), true);
    await picker.setInputFiles(
      join(root, "apps/windows-local/public/assets/sofa.glb"),
    );
    await call({
      action: "product_update",
      id: product.id,
      base_revision: product.revision,
      category: "chair",
      brand: "门店",
      name: "测试椅",
      sku: "CHAIR-UI-1",
      price: "1200.00",
      width_mm: 700,
      depth_mm: 700,
      height_mm: 900,
      metadata: {},
    });
    await page
      .getByRole("button", { name: "导入当前商品 3D 模型", exact: true })
      .click();
    await page
      .locator("#product-message")
      .filter({ hasText: "商品信息已变化" })
      .waitFor();
    assert.equal(
      (await call({ action: "product", id: product.id })).active_asset_id,
      null,
    );
    assert.equal((await picker.inputValue()).endsWith("sofa.glb"), true);
  },
);
test(
  "product write success survives list refresh failure and paging failure keeps old page",
  { timeout: 90000 },
  async (t) => {
    const { page } = await setup(t);
    const origin = new URL(page.url()).origin;
    const call = async (body) =>
      (
        await page.request.post(`${origin}/api/local`, {
          headers: { origin },
          data: body,
        })
      ).json();
    for (let i = 0; i < 21; i++) {
      assert.equal(
        (
          await call({
            action: "product_create",
            category: "bed",
            brand: "品牌",
            name: `床${i}`,
            sku: `B-${i}`,
            price: "100.00",
            width_mm: 2000,
            depth_mm: 1800,
            height_mm: 400,
          })
        ).status,
        200,
      );
    }
    await page.getByRole("button", { name: "商品管理", exact: true }).click();
    await page
      .locator("#products-count")
      .filter({ hasText: "共 21 件" })
      .waitFor();
    let failList = false;
    await page.route("**/api/local", async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      if (body.action === "products" && failList) {
        failList = false;
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            status: 503,
            error: "本地资料服务暂时不可用",
          }),
        });
      } else await route.continue();
    });
    failList = true;
    await page
      .getByRole("button", { name: "下一页", exact: true })
      .last()
      .click();
    await page
      .locator("#product-message")
      .filter({ hasText: /不可用|失败/ })
      .waitFor();
    assert.match(
      await page.locator("#products-count").textContent(),
      /显示 1–20/,
    );
    assert.match(await page.locator("#products-items").textContent(), /床20/);
    await page
      .getByRole("button", { name: "下一页", exact: true })
      .last()
      .click();
    await page
      .locator("#products-count")
      .filter({ hasText: "显示 21–21" })
      .waitFor();
    await page.locator("#product-category").fill("sofa");
    await page.locator("#product-brand").fill("品牌");
    await page.locator("#product-name").fill("双人沙发");
    await page.locator("#product-sku").fill("S-NEW");
    await page.locator("#product-price").fill("12345.67");
    await page.locator("#product-width").fill("2100");
    await page.locator("#product-depth").fill("900");
    await page.locator("#product-height").fill("800");
    failList = true;
    await page
      .getByRole("button", { name: "新建在售商品", exact: true })
      .click();
    await page
      .locator("#product-message")
      .filter({ hasText: /已保存.*刷新失败/ })
      .waitFor();
    assert.match(await page.locator("#product-detail").textContent(), /S-NEW/);
    assert.equal(await page.locator("#product-price").inputValue(), "12345.67");
    assert.equal(
      (await call({ action: "products", search: "S-NEW" })).data.total,
      1,
    );
    await page.locator("#product-price").fill("12346.00");
    failList = true;
    await page
      .getByRole("button", { name: "更新在售商品", exact: true })
      .click();
    await page
      .locator("#product-message")
      .filter({ hasText: /已更新.*刷新失败/ })
      .waitFor();
    assert.equal(await page.locator("#product-price").inputValue(), "12346.00");
    assert.equal(
      (await call({ action: "products", search: "S-NEW" })).data.items[0].price,
      "12346.00",
    );
    await page.locator("#products-search").fill("不存在的商品");
    await page.getByRole("button", { name: "搜索商品", exact: true }).click();
    await page
      .locator("#products-empty")
      .filter({ hasText: "没有匹配的商品" })
      .waitFor();
  },
);
test(
  "customer and project stale edits preserve form values and layout fits landscape width",
  { timeout: 90000 },
  async (t) => {
    const { page } = await setup(t);
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.locator("#customer-name").fill("李女士");
    await page.getByRole("button", { name: "保存客户", exact: true }).click();
    await page
      .locator("#message")
      .filter({ hasText: "已保存在本机" })
      .waitFor();
    await page.locator("#sales-project-name").fill("江景苑");
    await page.getByRole("button", { name: "保存项目", exact: true }).click();
    await page
      .locator("#message")
      .filter({ hasText: "可以新建方案" })
      .waitFor();
    const origin = new URL(page.url()).origin;
    const call = async (body) =>
      (
        await page.request.post(`${origin}/api/local`, {
          headers: { origin },
          data: body,
        })
      ).json();
    const customers = await call({ action: "customers" });
    assert.equal(customers.status, 200, JSON.stringify(customers));
    const customer = customers.data.items[0];
    await call({
      action: "customer_update",
      id: customer.id,
      base_revision: 1,
      name: "其他窗口修改",
      status: "following",
    });
    await page.locator("#customer-name").fill("我的未保存修改");
    await page.getByRole("button", { name: "更新客户", exact: true }).click();
    await page
      .locator("#message")
      .filter({ hasText: /修改已保留|数据已变化/ })
      .waitFor();
    assert.equal(
      await page.locator("#customer-name").inputValue(),
      "我的未保存修改",
    );
    const project = (
      await call({ action: "projects", customer_id: customer.id })
    ).data.items[0];
    await call({
      action: "project_update",
      id: project.id,
      base_revision: 1,
      name: "其他项目名",
      status: "active",
    });
    await page.locator("#sales-project-name").fill("我的项目改动");
    await page.getByRole("button", { name: "更新项目", exact: true }).click();
    await page
      .locator("#message")
      .filter({ hasText: /修改已保留|数据已变化/ })
      .waitFor();
    assert.equal(
      await page.locator("#sales-project-name").inputValue(),
      "我的项目改动",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
  },
);
test(
  "unsaved customer and project forms ask before navigation or close",
  { timeout: 90000 },
  async (t) => {
    const { page } = await setup(t);
    await page.locator("#customer-name").fill("甲客户");
    await page.getByRole("button", { name: "保存客户", exact: true }).click();
    await page
      .locator("#message")
      .filter({ hasText: "已保存在本机" })
      .waitFor();
    await page.locator("#sales-project-name").fill("甲项目");
    await page.getByRole("button", { name: "保存项目", exact: true }).click();
    await page
      .locator("#message")
      .filter({ hasText: "可以新建方案" })
      .waitFor();
    await page.locator("#sales-project-name").fill("未保存的项目名");
    assert.equal(
      await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        dispatchEvent(event);
        return event.defaultPrevented;
      }),
      true,
    );
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "旧方案入口", exact: true }).click();
    assert.equal(
      await page.locator("#sales-project-name").inputValue(),
      "未保存的项目名",
    );
    await page.locator("#sales-project-name").fill("甲项目");
    await page.locator("#customer-name").fill("乙客户");
    await page.getByRole("button", { name: "保存客户", exact: true }).click();
    await page
      .locator("#message")
      .filter({ hasText: "已保存在本机" })
      .waitFor();
    await page.getByRole("button", { name: "甲客户", exact: true }).click();
    await page.locator("#customer-name").fill("未保存的客户名");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "乙客户", exact: true }).click();
    assert.equal(
      await page.locator("#selected-customer").textContent(),
      "甲客户",
    );
    assert.equal(
      await page.locator("#customer-name").inputValue(),
      "未保存的客户名",
    );
  },
);
test(
  "actual offline render, furniture edit v2, immutable restore v3 and page reload",
  { timeout: 120000 },
  async (t) => {
    const { page, errors } = await setup(t, { trackFrames: true });
    await project(page, true);
    await page.waitForTimeout(150);
    const beforeIdle = await page.evaluate(() => window.__frameRequests());
    await page.waitForTimeout(750);
    const idleFrames =
      (await page.evaluate(() => window.__frameRequests())) - beforeIdle;
    assert.ok(
      idleFrames <= 8,
      `idle render loop requested ${idleFrames} frames`,
    );
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
  { timeout: 90000 },
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
  { timeout: 90000 },
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
  { timeout: 90000 },
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

test(
  "pending JSON cannot be silently saved or discarded when switching projects",
  { timeout: 90000 },
  async (t) => {
    const { page } = await setup(t);
    await project(page);
    await page.getByRole("button", { name: "保存新版本", exact: true }).click();
    await page.locator("#message").filter({ hasText: "已保存 v1" }).waitFor();
    await page.locator("#advanced").click();
    const edited = (await page.locator("#scene-json").inputValue()).replace(
      "客厅",
      "我编辑的客厅",
    );
    await page.locator("#scene-json").fill(edited);
    await page.getByRole("button", { name: "保存新版本", exact: true }).click();
    await page.locator("#message").filter({ hasText: "请先应用" }).waitFor();
    assert.match(await page.locator("#revision").textContent(), /未保存修改/);
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.locator("#project-name").fill("不会切换的方案");
    await page.getByRole("button", { name: "新建方案", exact: true }).click();
    assert.equal(await page.locator("#scene-json").inputValue(), edited);
    assert.match(await page.locator("#project-title").textContent(), /张先生/);
    await page.getByRole("button", { name: "应用 JSON", exact: true }).click();
    await page.locator("#message").filter({ hasText: "场景已更新" }).waitFor();
    await page.getByRole("button", { name: "保存新版本", exact: true }).click();
    await page.locator("#revision").filter({ hasText: "当前 v2" }).waitFor();
  },
);

test(
  "pending furniture fields warn before project switch and pending history is cleared",
  { timeout: 90000 },
  async (t) => {
    const { page } = await setup(t);
    await project(page);
    await page.getByRole("button", { name: "保存新版本", exact: true }).click();
    await page.locator("#message").filter({ hasText: "已保存 v1" }).waitFor();
    await page.getByRole("button", { name: "查看 v1", exact: true }).click();
    assert.equal(
      await page.locator("#history-json-panel").evaluate((el) => el.open),
      true,
    );
    await page.locator("#furniture-x").fill("3555");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.locator("#project-name").fill("别的方案");
    await page.getByRole("button", { name: "新建方案", exact: true }).click();
    assert.equal(await page.locator("#furniture-x").inputValue(), "3555");
    assert.match(await page.locator("#project-title").textContent(), /张先生/);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "新建方案", exact: true }).click();
    await page.locator("#message").filter({ hasText: "方案已建立" }).waitFor();
    assert.equal(
      await page.locator("#history-json-panel").evaluate((el) => el.open),
      false,
    );
    assert.equal(await page.locator("#history-json").textContent(), "");
  },
);

test(
  "switching existing projects clears the prior history JSON and pending edits trigger unload protection",
  { timeout: 90000 },
  async (t) => {
    const { page } = await setup(t);
    await project(page);
    await page.getByRole("button", { name: "保存新版本", exact: true }).click();
    await page.locator("#message").filter({ hasText: "已保存 v1" }).waitFor();
    await page.locator("#project-name").fill("第二个方案");
    await page.getByRole("button", { name: "新建方案", exact: true }).click();
    await page.locator("#message").filter({ hasText: "方案已建立" }).waitFor();
    await page
      .getByRole("button", { name: "张先生 · 龙湖小区120㎡", exact: true })
      .click();
    await page.getByRole("button", { name: "查看 v1", exact: true }).click();
    assert.equal(
      await page.locator("#history-json-panel").evaluate((el) => el.open),
      true,
    );
    await page.getByRole("button", { name: "第二个方案", exact: true }).click();
    await page
      .locator("#project-title")
      .filter({ hasText: "第二个方案" })
      .waitFor();
    assert.equal(
      await page.locator("#history-json-panel").evaluate((el) => el.open),
      false,
    );
    assert.equal(await page.locator("#history-json").textContent(), "");
    await page
      .getByRole("button", { name: "张先生 · 龙湖小区120㎡", exact: true })
      .click();
    await page
      .locator("#project-title")
      .filter({ hasText: "张先生 · 龙湖小区120㎡" })
      .waitFor();
    await page.locator("#furniture-y").fill("4000");
    assert.equal(
      await page.evaluate(() => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      }),
      true,
    );
  },
);

test("missing room texture keeps the design visible and reports a fallback", async (t) => {
  const { page } = await setup(t);
  await page.route("**/assets/room/wood-floor-diffuse.jpg", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
  await project(page, true);
  await page.locator('canvas[data-room-material-loaded="false"]').waitFor();
  await page
    .locator("#render-status")
    .filter({ hasText: "房间贴图未能全部加载" })
    .waitFor();
  assert.equal(await page.locator("#viewport canvas").isVisible(), true);
});

test(
  "offline catalog loads sofa chair velvet sofa and refrigerator and persists them",
  { timeout: 180000 },
  async (t) => {
    const { page, errors } = await setup(t);
    await project(page, true);
    await page.locator('canvas[data-room-material-loaded="true"]').waitFor();
    assert.equal(await page.locator("#catalog-select option").count(), 4);
    await page
      .locator("#catalog-select")
      .selectOption("40000000-0000-4000-8000-000000000003");
    await page
      .locator("#room-select")
      .selectOption("30000000-0000-4000-8000-000000000003");
    await page.getByRole("button", { name: "放入场景", exact: true }).click();
    await page.locator("#message").filter({ hasText: "已放入" }).waitFor();
    assert.match(
      await page.locator("#scene-json").inputValue(),
      /40000000-0000-4000-8000-000000000003/,
    );
    await page
      .locator('canvas[data-model-loaded="true"]')
      .waitFor({ timeout: 90000 });
    await page.getByRole("button", { name: "保存新版本", exact: true }).click();
    await page.locator("#message").filter({ hasText: "已保存 v1" }).waitFor();
    await page.reload();
    await page
      .getByRole("button", { name: "张先生 · 龙湖小区120㎡", exact: true })
      .click();
    await page.locator("#revision").filter({ hasText: "当前 v1" }).waitFor();
    assert.equal(await page.locator("#furniture-select option").count(), 2);
    await page
      .locator('canvas[data-model-loaded="true"]')
      .waitFor({ timeout: 90000 });
    await page
      .locator("#catalog-select")
      .selectOption("40000000-0000-4000-8000-000000000004");
    await page
      .locator("#room-select")
      .selectOption("30000000-0000-4000-8000-000000000004");
    await page.getByRole("button", { name: "放入场景", exact: true }).click();
    await page.locator("#message").filter({ hasText: "已放入" }).waitFor();
    await page
      .locator("#catalog-select")
      .selectOption("40000000-0000-4000-8000-000000000005");
    await page
      .locator("#room-select")
      .selectOption("30000000-0000-4000-8000-000000000005");
    await page.getByRole("button", { name: "放入场景", exact: true }).click();
    await page
      .locator("#render-status")
      .filter({ hasText: "4 件家具模型" })
      .waitFor({ timeout: 90000 });
    await page.getByRole("button", { name: "保存新版本", exact: true }).click();
    await page.locator("#message").filter({ hasText: "已保存 v2" }).waitFor();
    await page.reload();
    await page
      .getByRole("button", { name: "张先生 · 龙湖小区120㎡", exact: true })
      .click();
    await page.locator("#revision").filter({ hasText: "当前 v2" }).waitFor();
    assert.equal(await page.locator("#furniture-select option").count(), 4);
    await page
      .locator("#render-status")
      .filter({ hasText: "4 件家具模型" })
      .waitFor({ timeout: 90000 });
    await mkdir(join(root, ".local/windows-evidence"), { recursive: true });
    await page.screenshot({
      path: join(root, ".local/windows-evidence/catalog-room.png"),
    });
    await page.getByRole("button", { name: "户型总览", exact: true }).click();
    await page.waitForTimeout(500);
    await page.screenshot({
      path: join(root, ".local/windows-evidence/catalog-overview.png"),
    });
    assert.equal(errors.length, 0, errors.join("\n"));
  },
);

test(
  "middle drag moves selected furniture and right drag rotates it",
  { timeout: 120000 },
  async (t) => {
    const { page, errors } = await setup(t);
    await project(page, true);
    const canvas = page.locator("#viewport canvas");
    const box = await canvas.boundingBox();
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    const before = JSON.parse(await page.locator("#scene-json").inputValue())
      .furniture_instances[0];
    await page.mouse.move(x, y);
    await page.mouse.down({ button: "middle" });
    await page.mouse.move(x + 30, y, { steps: 6 });
    await page.mouse.up({ button: "middle" });
    await page.waitForFunction(
      (previous) =>
        JSON.parse(document.querySelector("#scene-json").value)
          .furniture_instances[0].position.x !== previous,
      before.position.x,
    );
    const moved = JSON.parse(await page.locator("#scene-json").inputValue())
      .furniture_instances[0];
    await page.mouse.move(x, y);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(x + 30, y, { steps: 6 });
    await page.mouse.up({ button: "right" });
    await page.waitForFunction(
      (previous) =>
        JSON.parse(document.querySelector("#scene-json").value)
          .furniture_instances[0].rotation_deg !== previous,
      moved.rotation_deg,
    );
    assert.match(
      await page.locator("#gesture-hint").textContent(),
      /保存新版本/,
    );
    assert.equal(errors.length, 0, errors.join("\n"));
  },
);

test(
  "repeated large sofas in a bedroom stay inside its walls and reject a fourth",
  { timeout: 90000 },
  async (t) => {
    const { page } = await setup(t);
    await project(page);
    await page
      .locator("#catalog-select")
      .selectOption("40000000-0000-4000-8000-000000000004");
    await page
      .locator("#room-select")
      .selectOption("30000000-0000-4000-8000-000000000004");
    for (let expected = 1; expected <= 3; expected++) {
      await page.getByRole("button", { name: "放入场景", exact: true }).click();
      await page.waitForFunction(
        (count) =>
          JSON.parse(
            document.querySelector("#scene-json").value,
          ).furniture_instances.filter(
            (item) => item.room_id === "30000000-0000-4000-8000-000000000004",
          ).length === count,
        expected,
      );
      const scene = JSON.parse(await page.locator("#scene-json").inputValue());
      const bedroom = scene.furniture_instances.filter(
        (item) => item.room_id === "30000000-0000-4000-8000-000000000004",
      );
      assert.equal(bedroom.length, expected);
      for (const item of bedroom) {
        assert.ok(item.position.x - item.width_mm / 2 >= 0);
        assert.ok(item.position.x + item.width_mm / 2 <= 4000);
        assert.ok(item.position.y - item.depth_mm / 2 >= 4000);
        assert.ok(item.position.y + item.depth_mm / 2 <= 8000);
      }
    }
    const previous = await page.locator("#scene-json").inputValue();
    await page.getByRole("button", { name: "放入场景", exact: true }).click();
    await page
      .locator("#message")
      .filter({ hasText: "没有足够空间" })
      .waitFor();
    assert.equal(await page.locator("#scene-json").inputValue(), previous);
  },
);

test(
  "missing bundled furniture reports a clear error without pretending to render it",
  { timeout: 90000 },
  async (t) => {
    const { page } = await setup(t);
    await page.route("**/assets/chair.glb", (route) => route.abort());
    await project(page, true);
    await page
      .locator("#catalog-select")
      .selectOption("40000000-0000-4000-8000-000000000003");
    await page.getByRole("button", { name: "放入场景", exact: true }).click();
    await page
      .locator("#render-status")
      .filter({ hasText: "1 件家具模型未能加载" })
      .waitFor();
    assert.equal(
      await page.locator("canvas").getAttribute("data-model-loaded"),
      "partial",
    );
  },
);
