function uuid(value) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/^urn:uuid:/i, "").toLowerCase();
  return /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(normalized) &&
    normalized !== "00000000-0000-0000-0000-000000000000"
    ? normalized
    : null;
}

export function replaceFurnitureAsset(scene, id, product) {
  const item = scene?.furniture_instances?.find((value) => value.id === id);
  if (!id || !item) throw Error("请先选择要更换模型的家具。");
  const productId = uuid(product?.id);
  if (!productId || productId !== uuid(item.product_id))
    throw Error("当前目录商品与所选家具不匹配，请刷新目录后重试。");
  const assetId = uuid(product?.asset_id);
  if (!assetId)
    throw Error("该商品暂无可用的当前 3D 模型，请先在商品管理中导入模型。");
  const copy = structuredClone(scene);
  const updated = copy.furniture_instances.find((value) => value.id === id);
  updated.asset_id = assetId;
  updated.metadata = {
    ...updated.metadata,
    model_kind: "glb",
    offline_catalog_only: false,
  };
  return copy;
}
