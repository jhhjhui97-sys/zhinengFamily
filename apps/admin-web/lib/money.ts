export function formatMoney(value: string | null | undefined): string {
  if (value === null || value === undefined) return '—';

  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return '—';

  const [, sign, rawWhole, rawFraction = ''] = match;
  const whole = rawWhole.replace(/^0+(?=\d)/, '');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = /^0*$/.test(rawFraction) ? '' : `.${rawFraction}`;

  return `${sign}¥${grouped}${fraction}`;
}
