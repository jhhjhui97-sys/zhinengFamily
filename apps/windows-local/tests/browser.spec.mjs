import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdtemp, mkdir } from "node:fs/promises";
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
async function setup(t, { trackFrames = false } = {}) {
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
  const browser = await chromium.launch({ channel: "msedge", headless: true });
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

test(
  "offline catalog loads sofa chair velvet sofa and refrigerator and persists them",
  { timeout: 180000 },
  async (t) => {
    const { page, errors } = await setup(t);
    await project(page, true);
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
      .filter({ hasText: "4 件真实家具模型" })
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
      .filter({ hasText: "4 件真实家具模型" })
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
