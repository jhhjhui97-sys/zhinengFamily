export function createCatalogRefresh(load, apply) {
  let requested = 0;
  return async () => {
    const request = ++requested;
    let items;
    try {
      items = await load();
    } catch (error) {
      if (request !== requested) return;
      throw error;
    }
    if (request === requested) apply(items);
  };
}
