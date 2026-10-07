import test from "node:test";
import assert from "node:assert/strict";
import * as assets from "../public/furniture-assets.mjs";

const productId = "40000000-0000-4000-8000-000000000001";
const assetId = "50000000-0000-4000-8000-000000000001";
const scene = {
  scene_id: "10000000-0000-4000-8000-000000000001",
  floors: [{ id: "20000000-0000-4000-8000-000000000001", elevation_mm: 1200 }],
  furniture_instances: [
    {
      id: "60000000-0000-4000-8000-000000000001",
      product_id: productId,
      asset_id: null,
      position: { x: 1234, y: 2345, z: 850 },
      rotation_deg: 30,
      width_mm: 800,
      depth_mm: 700,
      height_mm: 900,
      metadata: {
        model_kind: "dimensions",
        offline_catalog_only: true,
        name: "历史椅",
        extra: { retained: true },
      },
    },
  ],
};
const instanceId = scene.furniture_instances[0].id;
test("explicit model replacement changes the draft asset while retaining saved dimensions and pose", () => {
  const before = structuredClone(scene);
  const updated = assets.replaceFurnitureAsset(scene, instanceId, {
    id: productId,
    asset_id: assetId,
    model_kind: "glb",
    sellable: true,
    width_mm: 1800,
    depth_mm: 1700,
    height_mm: 1900,
  });
  assert.deepEqual(scene, before);
  assert.deepEqual(updated.furniture_instances[0], {
    ...before.furniture_instances[0],
    asset_id: assetId,
    metadata: {
      ...before.furniture_instances[0].metadata,
      model_kind: "glb",
      offline_catalog_only: false,
    },
  });
  updated.furniture_instances[0].metadata.extra.retained = false;
  assert.equal(scene.furniture_instances[0].metadata.extra.retained, true);
  assert.deepEqual(updated.floors, before.floors);
});
test("catalogue asset_id selects the current model while UUID prefixes remain compatible", () => {
  const source = structuredClone(scene);
  source.furniture_instances[0].product_id = `urn:uuid:${productId.toUpperCase()}`;
  const updated = assets.replaceFurnitureAsset(source, instanceId, {
    id: productId,
    asset_id: `urn:uuid:${assetId.toUpperCase()}`,
    active_asset_id: "ignored-product-detail-field",
    sellable: true,
  });
  assert.equal(updated.furniture_instances[0].asset_id, assetId);
  assert.equal(
    updated.furniture_instances[0].product_id,
    source.furniture_instances[0].product_id,
  );
});
test("missing or mismatched catalogue assets cannot change a saved furniture instance", () => {
  const before = structuredClone(scene);
  const badProducts = [
    null,
    {
      id: "40000000-0000-4000-8000-000000000002",
      asset_id: assetId,
      sellable: true,
    },
    { id: productId, asset_id: null, active_asset_id: assetId, sellable: true },
    { id: productId, asset_id: "invalid", sellable: true },
    {
      id: productId,
      asset_id: "00000000-0000-0000-0000-000000000000",
      sellable: true,
    },
  ];
  for (const product of badProducts)
    assert.throws(() =>
      assets.replaceFurnitureAsset(scene, instanceId, product),
    );
  assert.throws(
    () =>
      assets.replaceFurnitureAsset(scene, "missing", {
        id: productId,
        asset_id: assetId,
        sellable: true,
      }),
    /家具/,
  );
  assert.deepEqual(scene, before);
});
