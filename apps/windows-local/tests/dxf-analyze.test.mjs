import test from "node:test";
import assert from "node:assert/strict";
import { analyzeDxf, MAX_DXF_BYTES } from "../dxf-analyze.mjs";

function dxf(header, entities) {
  return Buffer.from(
    `0\nSECTION\n2\nHEADER\n${header}0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`,
    "utf8",
  );
}

const line = "0\nLINE\n8\nWALL\n10\n0\n20\n0\n11\n4200\n21\n0\n";
const room =
  "0\nLWPOLYLINE\n8\nROOM\n90\n4\n70\n1\n10\n0\n20\n0\n10\n4200\n20\n0\n10\n4200\n20\n3000\n10\n0\n20\n3000\n";

test("analyzes common room and wall entities with source units", async () => {
  const result = await analyzeDxf(dxf("9\n$INSUNITS\n70\n4\n", line + room));
  assert.equal(result.unitsCode, 4);
  assert.deepEqual(result.layers, ["ROOM", "WALL"]);
  assert.deepEqual(result.segments, [
    { layer: "WALL", start: { x: 0, y: 0 }, end: { x: 4200, y: 0 } },
  ]);
  assert.deepEqual(result.closedPaths, [
    {
      layer: "ROOM",
      points: [
        { x: 0, y: 0 },
        { x: 4200, y: 0 },
        { x: 4200, y: 3000 },
        { x: 0, y: 3000 },
      ],
    },
  ]);
  assert.match(result.sha256, /^[0-9a-f]{64}$/);
});

test("rejects binary and invalid UTF-8 DXF without guessing geometry", async () => {
  await assert.rejects(
    analyzeDxf(Buffer.from("AutoCAD Binary DXF\r\n")),
    /文本 DXF/,
  );
  await assert.rejects(
    analyzeDxf(Buffer.from([0xff, 0xfe, 0x00, 0x01])),
    /文本 DXF/,
  );
});

test("reports unsupported geometry instead of silently importing it", async () => {
  const curved = room.replace(
    "10\n4200\n20\n0\n",
    "10\n4200\n20\n0\n42\n0.5\n",
  );
  const result = await analyzeDxf(
    dxf("", line + curved + "0\nCIRCLE\n8\nOTHER\n10\n1\n20\n1\n40\n1\n"),
  );
  assert.equal(result.closedPaths.length, 0);
  assert.ok(result.skipped >= 2);
});

test("turns a straight open polyline into selectable line segments", async () => {
  const open = room.replace("70\n1\n", "70\n0\n");
  const result = await analyzeDxf(dxf("", open));
  assert.equal(result.closedPaths.length, 0);
  assert.equal(result.segments.length, 3);
  assert.deepEqual(result.segments[2].end, { x: 0, y: 3000 });
});

test("refuses empty, oversized and unbounded analysis", async () => {
  await assert.rejects(analyzeDxf(Buffer.alloc(0)), /8 MiB/);
  await assert.rejects(analyzeDxf(Buffer.alloc(MAX_DXF_BYTES + 1)), /8 MiB/);
  await assert.rejects(analyzeDxf(dxf("", "")), /没有可用/);
  await assert.rejects(analyzeDxf(dxf("", line), 0), /超时/);
  const vertices = Array.from(
    { length: 20_001 },
    (_, i) => `10\n${i}\n20\n0\n`,
  ).join("");
  await assert.rejects(
    analyzeDxf(
      dxf("", `0\nLWPOLYLINE\n8\nROOM\n90\n20001\n70\n0\n${vertices}`),
    ),
    /图元过多/,
  );
});
