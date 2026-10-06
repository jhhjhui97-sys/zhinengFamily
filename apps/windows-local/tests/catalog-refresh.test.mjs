import test from "node:test";
import assert from "node:assert/strict";
import { createCatalogRefresh } from "../public/catalog-refresh.mjs";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

test("a late pre-delete catalogue cannot restore a deleted product", async () => {
  const before = deferred(),
    after = deferred();
  const requests = [before, after];
  let current = [{ id: "deleted" }];
  const refresh = createCatalogRefresh(
    () => requests.shift().promise,
    (items) => {
      current = items;
    },
  );
  const older = refresh(),
    newer = refresh();
  after.resolve([]);
  await newer;
  before.resolve([{ id: "deleted" }]);
  await older;
  assert.deepEqual(current, []);
});

test("a stale catalogue failure cannot replace a successful new-product refresh", async () => {
  const before = deferred(),
    after = deferred();
  const requests = [before, after];
  let current = [];
  const refresh = createCatalogRefresh(
    () => requests.shift().promise,
    (items) => {
      current = items;
    },
  );
  const older = refresh(),
    newer = refresh();
  after.resolve([{ id: "created" }]);
  await newer;
  before.reject(Error("old read failed"));
  await older;
  assert.deepEqual(current, [{ id: "created" }]);
});

test("a failed current catalogue request retains the last list and reports the error", async () => {
  const current = [{ id: "existing" }];
  const refresh = createCatalogRefresh(
    async () => {
      throw Error("service unavailable");
    },
    () => {
      current.length = 0;
    },
  );
  await assert.rejects(refresh(), /service unavailable/);
  assert.deepEqual(current, [{ id: "existing" }]);
});
