import test from "node:test";
import assert from "node:assert/strict";
import { makePhotoGlb, photoDimensions } from "../public/photo-model.mjs";
import { validateGlb } from "../glb.mjs";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
  "base64",
);

test("a photo and millimetre dimensions generate a self-contained GLB proxy", () => {
  const bytes = makePhotoGlb({
    width_mm: 2400,
    depth_mm: 950,
    height_mm: 850,
    category: "sofa",
    imageBytes: png,
  });
  const document = validateGlb(Buffer.from(bytes));
  assert.equal(document.images[0].mimeType, "image/png");
  assert.equal(document.images[0].bufferView >= 0, true);
  assert.equal(document.buffers[0].byteLength > png.length, true);
  assert.equal(document.meshes.length, 2);
  assert.ok(document.nodes.length >= 4, "sofa has body, back, arms and photo");
  assert.ok(document.nodes.some((node) => node.mesh === 1));
  assert.deepEqual(photoDimensions(png), {
    width: 1,
    height: 1,
    mimeType: "image/png",
  });
});

test("invalid image and impossible dimensions cannot create a model", () => {
  assert.throws(
    () =>
      makePhotoGlb({
        width_mm: 0,
        depth_mm: 900,
        height_mm: 800,
        category: "sofa",
        imageBytes: png,
      }),
    /尺寸/,
  );
  assert.throws(() => photoDimensions(Buffer.from("not an image")), /图片/);
  const jpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x02, 0x00, 0x03, 0x03, 1,
    0x11, 0, 2, 0x11, 0, 3, 0x11, 0, 0xff, 0xd9,
  ]);
  assert.equal(photoDimensions(jpeg).mimeType, "image/jpeg");
  assert.throws(
    () => photoDimensions(Buffer.alloc(5 * 1024 * 1024 + 1)),
    /图片/,
  );
});
