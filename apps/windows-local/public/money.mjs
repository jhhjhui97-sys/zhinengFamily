export function formatMoney(value) {
  if (value == null || value === "") return "—";
  const text = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return "—";
  const [integer, fraction = ""] = text.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimal = fraction === "00" ? "" : fraction;
  return `¥${grouped}${decimal ? "." + decimal : ""}`;
}
