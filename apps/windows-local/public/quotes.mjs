import { formatMoney } from "./money.mjs";

const $ = (id) => document.getElementById(id);
const make = (tag, text, className) => {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
};

export function mountQuotes({
  api,
  notify,
  scope,
  hasUnsavedChanges,
  onQuoteShown,
  onQuoteCleared,
}) {
  let offset = 0;
  let total = 0;
  let busy = false;
  let serial = 0;

  function clear() {
    serial++;
    onQuoteCleared();
    offset = total = 0;
    $("quote-items").replaceChildren();
    $("quote-detail").hidden = true;
    $("quote-print-view").replaceChildren();
    $("quote-print").disabled = true;
    $("quote-count").textContent = "请先选择客户项目";
  }

  function show(quote) {
    onQuoteShown(quote);
    document.body.dataset.printTarget = "quote";
    $("quote-detail").hidden = false;
    $("quote-print").disabled = false;
    $("quote-summary").textContent =
      `${quote.customer_name} · ${quote.project_name} · ${quote.scene_name} v${quote.scene_version}\n${new Date(quote.created_at).toLocaleString("zh-CN")}`;
    $("quote-lines").replaceChildren();
    for (const line of quote.lines) {
      $("quote-lines").append(
        make(
          "div",
          `${line.name} · ${line.sku}\n${formatMoney(line.unit_price)} × ${line.quantity} = ${formatMoney(line.line_total)}`,
          "quote-line",
        ),
      );
    }
    $("quote-total").textContent = `合计 ${formatMoney(quote.total)}`;
    $("quote-exclusions").textContent = quote.exclusions.length
      ? `${quote.exclusions.length} 件演示家具未计价：${quote.exclusions.map((item) => item.name).join("、")}。`
      : "无未计价演示家具。";

    const print = $("quote-print-view");
    print.replaceChildren(make("h1", "智能家居 · 商品参考报价"));
    print.append(make("p", `${quote.customer_name}　${quote.project_name}`));
    print.append(
      make(
        "p",
        `方案：${quote.scene_name} v${quote.scene_version}　生成时间：${new Date(quote.created_at).toLocaleString("zh-CN")}`,
      ),
    );
    const table = document.createElement("table");
    const header = document.createElement("tr");
    for (const label of ["商品", "SKU", "单价", "数量", "小计"])
      header.append(make("th", label));
    table.append(header);
    for (const line of quote.lines) {
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
    print.append(table, make("h2", `合计 ${formatMoney(quote.total)}`));
    if (quote.exclusions.length)
      print.append(
        make(
          "p",
          `${quote.exclusions.length} 件演示家具未计价：${quote.exclusions.map((item) => item.name).join("、")}。`,
        ),
      );
    print.append(make("p", "商品参考价；运费、安装费和税费以最终约定为准。"));
  }

  async function load(nextOffset = offset) {
    const current = scope();
    if (!current.customer_id || !current.project_id) return clear();
    const request = ++serial;
    const page = await api("quotations", {
      customer_id: current.customer_id,
      project_id: current.project_id,
      limit: 20,
      offset: nextOffset,
    });
    if (request !== serial || scope().project_id !== current.project_id) return;
    offset = nextOffset;
    total = page.total;
    $("quote-items").replaceChildren();
    for (const quote of page.items) {
      const button = make(
        "button",
        `${formatMoney(quote.total)} · ${quote.scene_name} v${quote.scene_version}`,
      );
      button.onclick = () =>
        operate(async () => {
          onQuoteCleared();
          $("quote-detail").hidden = true;
          $("quote-print-view").replaceChildren();
          $("quote-print").disabled = true;
          const item = await api("quotation", {
            customer_id: current.customer_id,
            project_id: current.project_id,
            id: quote.id,
          });
          if (scope().project_id === current.project_id) {
            show(item);
            notify("已打开本机报价。");
          }
        });
      $("quote-items").append(button);
    }
    $("quote-count").textContent = `共 ${total} 份报价`;
    $("quote-prev").disabled = offset === 0;
    $("quote-next").disabled = offset + page.items.length >= total;
  }

  async function operate(operation) {
    if (busy) return;
    busy = true;
    for (const id of [
      "quote-create",
      "quote-prev",
      "quote-next",
      "quote-print",
    ])
      $(id).disabled = true;
    try {
      await operation();
    } catch (error) {
      notify(error?.message || "本地报价服务暂时不可用，请重试。", true);
    } finally {
      busy = false;
      $("quote-create").disabled = false;
      $("quote-print").disabled = $("quote-detail").hidden;
      $("quote-prev").disabled = offset === 0;
      $("quote-next").disabled = offset + 20 >= total;
    }
  }

  $("quote-create").onclick = () =>
    operate(async () => {
      const current = scope();
      if (
        !current.customer_id ||
        !current.project_id ||
        !current.id ||
        !current.scene_version
      )
        throw Error("请先打开客户项目并保存方案版本。 ");
      if (hasUnsavedChanges())
        throw Error("资料或场景还有未保存的修改，请先保存，再生成报价。");
      const quote = await api("quotation_create", current);
      show(quote);
      notify(`已生成 ${formatMoney(quote.total)} 的本机报价。`);
      try {
        await load(0);
      } catch {
        notify("报价已生成，但列表刷新失败，请重试。", true);
      }
    });
  $("quote-prev").onclick = () => operate(() => load(Math.max(0, offset - 20)));
  $("quote-next").onclick = () => operate(() => load(offset + 20));
  $("quote-print").onclick = () => window.print();
  clear();
  return { clear, load };
}
