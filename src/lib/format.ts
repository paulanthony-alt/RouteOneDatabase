export const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
export const signed = (n: number) => (n >= 0 ? '+' : '−') + money(Math.abs(n));
export const pct = (cost: number, value: number) => {
  if (cost === 0) return value === 0 ? '0.0%' : '—';
  const v = ((value - cost) / cost) * 100;
  return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '%';
};
export const tone = (cost: number, value: number) => (value >= cost ? 'gain' : 'loss');

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
/** '2026-11-14' → 'NOV 14' (no timezone shift). */
export const shortDate = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${MONTHS[Number(m) - 1]} ${d}`;
};
/** Today's date as YYYY-MM-DD in local time. */
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const clock = (d: Date) => d.toTimeString().slice(0, 5);
