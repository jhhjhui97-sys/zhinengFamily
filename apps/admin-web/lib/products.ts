import { dateTime, display } from './customers';
export { dateTime, display };
export { formatMoney as money } from './money';

export function dimensions(width: number, depth: number, height: number) {
  return `${width} × ${depth} × ${height} mm`;
}
