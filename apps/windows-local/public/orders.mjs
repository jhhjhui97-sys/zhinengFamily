import { formatMoney } from "./money.mjs";

const $ = (id) => document.getElementById(id);
const make = (tag, value) => {
  const element = document.createElement(tag);
  element.textContent = value;
  return element;
};
const labels = { draft: "草稿", confirmed: "已确认", cancelled: "已取消" };

export function mountOrders({ api, notify, scope }) {
  let quoteId = null;
  let current = null;
  let offset = 0;
  let total = 0;
  let busy = false;
  let serial = 0;

  function hideDetail() {
    current = null;
    $("order-detail").hidden = true;
    $("order-print-view").replaceChildren();
    $("order-print").disabled = true;
  }
  function clear() {
    serial++;
    quoteId = null;
    offset = total = 0;
    $("order-items").replaceChildren();
    $("order-count").textContent = "请先选择客户项目";
    $("order-refresh").disabled = true;
    $("order-from-quote").disabled = true;
    hideDetail();
  }
  function fromQuote(quote) {
    quoteId = quote?.id ?? null;
    $("order-from-quote").disabled = !quoteId;
  }
  function show(order) {
    current = order;
    $("quote-detail").hidden = true;
    $("quote-print").disabled = true;
    $("quote-print-view").replaceChildren();
    $("order-detail").hidden = false;
    $("order-print").disabled = false;
    document.body.dataset.printTarget = "order";
    $("order-summary").textContent =
      `${order.number}\n${order.customer_name} · ${order.project_name} · ${order.scene_name} v${order.scene_version}`;
    $("order-status").textContent = `状态：${labels[order.status]}`;
    $("order-lines").replaceChildren();
    for (const line of order.lines) {
      const item = make(
        "div",
        `${line.name} · ${line.sku}\n${formatMoney(line.unit_price)} × ${line.quantity} = ${formatMoney(line.line_total)}`,
      );
      item.className = "quote-line";
      $("order-lines").append(item);
    }
    $("order-total").textContent = `合计 ${formatMoney(order.total)}`;
    $("order-exclusions").textContent = order.exclusions.length
      ? `未计价演示家具：${order.exclusions.map((item) => item.name).join("、")}。`
      : "无未计价演示家具。";
    $("order-history").textContent = order.events
      .map(
        (event) =>
          `${labels[event.status]} · ${new Date(event.created_at).toLocaleString("zh-CN")}`,
      )
      .join("\n");
    $("order-confirm").hidden = order.status !== "draft";
    $("order-cancel").hidden = order.status === "cancelled";

    const print = $("order-print-view");
    print.replaceChildren(make("h1", "智能家居 · 销售订单"));
    print.append(make("p", `${order.number}　${labels[order.status]}`));
    print.append(
      make(
        "p",
        `${order.customer_name}　${order.project_name}　${order.scene_name} v${order.scene_version}`,
      ),
    );
    const table = document.createElement("table");
    const heading = document.createElement("tr");
    for (const value of ["商品", "SKU", "单价", "数量", "小计"])
      heading.append(make("th", value));
    table.append(heading);
    for (const line of order.lines) {
      const row = document.createElement("tr");
      for (const value of [
        line.name,
        line.sku,
        formatMoney(line.unit_price),
        String(line.quantity),
        formatMoney(line.line_total),
      ])
        row.append(make("td", value));
      table.append(row);
    }
    print.append(table, make("h2", `合计 ${formatMoney(order.total)}`));
    if (order.exclusions.length)
      print.append(
        make(
          "p",
          `未计价演示家具：${order.exclusions.map((item) => item.name).join("、")}。`,
        ),
      );
    print.append(
      make(
        "p",
        "本订单不代表已付款或锁定库存；交付、税费和安装以最终约定为准。",
      ),
    );
  }
  async function load(nextOffset = offset, { keepNewDetail = false } = {}) {
    const selected = scope();
    if (!selected.customer_id || !selected.project_id) return clear();
    if (!keepNewDetail) hideDetail();
    const request = ++serial;
    const page = await api("orders", {
      ...selected,
      limit: 20,
      offset: nextOffset,
    });
    if (request !== serial || scope().project_id !== selected.project_id)
      return;
    offset = nextOffset;
    total = page.total;
    $("order-items").replaceChildren();
    for (const order of page.items) {
      const button = make(
        "button",
        `${order.number} · ${labels[order.status]} · ${formatMoney(order.total)}`,
      );
      button.onclick = () =>
        operate(async () => {
          hideDetail();
          $("quote-detail").hidden = true;
          $("quote-print").disabled = true;
          $("quote-print-view").replaceChildren();
          const detail = await api("order", { ...selected, id: order.id });
          if (scope().project_id === selected.project_id) show(detail);
        });
      $("order-items").append(button);
    }
    $("order-count").textContent = `共 ${total} 张订单`;
    $("order-refresh").disabled = false;
    $("order-prev").disabled = offset === 0;
    $("order-next").disabled = offset + page.items.length >= total;
  }
  async function operate(callback) {
    if (busy) return;
    busy = true;
    for (const id of [
      "order-from-quote",
      "order-refresh",
      "order-prev",
      "order-next",
      "order-confirm",
      "order-cancel",
      "order-print",
    ])
      $(id).disabled = true;
    try {
      await callback();
    } catch (error) {
      notify(error?.message || "本机订单服务暂时不可用，请重试。", true);
    } finally {
      busy = false;
      $("order-from-quote").disabled = !quoteId;
      $("order-refresh").disabled = !scope().project_id;
      $("order-prev").disabled = offset === 0;
      $("order-next").disabled = offset + 20 >= total;
      $("order-confirm").disabled = !current || current.status !== "draft";
      $("order-cancel").disabled = !current || current.status === "cancelled";
      $("order-print").disabled = !current;
    }
  }
  $("order-from-quote").onclick = () =>
    operate(async () => {
      const selected = scope();
      const request = serial;
      if (!quoteId || !selected.project_id)
        throw Error("请先打开一份已保存的报价。");
      const order = await api("order_create", { ...selected, id: quoteId });
      if (request !== serial || scope().project_id !== selected.project_id)
        return;
      show(order);
      notify(`已生成订单 ${order.number}。`);
      try {
        await load(0, { keepNewDetail: true });
      } catch {
        notify("订单已保存，但列表刷新失败，请重试。", true);
      }
    });
  async function change(status) {
    if (!current) return;
    const label = status === "confirmed" ? "确认" : "取消";
    if (!window.confirm(`确定${label}这张订单吗？操作会记录在状态历史中。`))
      return;
    await operate(async () => {
      const selected = scope();
      const request = serial;
      const next = await api("order_status", {
        ...selected,
        id: current.id,
        base_revision: current.revision,
        status,
      });
      if (request !== serial || scope().project_id !== selected.project_id)
        return;
      show(next);
      notify(`订单已${label}。`);
      try {
        await load(0, { keepNewDetail: true });
      } catch {
        notify("订单状态已保存，但列表刷新失败，请重试。", true);
      }
    });
  }
  $("order-confirm").onclick = () => change("confirmed");
  $("order-cancel").onclick = () => change("cancelled");
  $("order-prev").onclick = () => operate(() => load(Math.max(0, offset - 20)));
  $("order-next").onclick = () => operate(() => load(offset + 20));
  $("order-refresh").onclick = () => operate(() => load(0));
  $("order-print").onclick = () => window.print();
  clear();
  return { clear, fromQuote, hideDetail, load, canLeave: () => !busy };
}
