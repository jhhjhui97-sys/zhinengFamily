import test from "node:test";
import assert from "node:assert/strict";
import { formatMoney } from "../public/money.mjs";

test("formats decimal price strings without floating point loss", () => {
  assert.equal(formatMoney("80000.00"), "¥80,000");
  assert.equal(formatMoney("80000.50"), "¥80,000.50");
  assert.equal(formatMoney("12345.67"), "¥12,345.67");
  assert.equal(formatMoney(null), "—");
});
