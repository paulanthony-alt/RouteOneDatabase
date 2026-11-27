export const money = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
export const cents = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const signed = (n: number) => (n >= 0 ? '+' : '−') + money(Math.abs(n));
export const pct = (cost: number, value: number) => {
  if (cost === 0) return value === 0 ? '0.0%' : '—';
  const v = ((value - cost) / cost) * 100;
  return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(1) + '%';
};
export const rate = (part: number, whole: number) => (whole ? ((part / whole) * 100).toFixed(0) + '%' : '—');
export const tone = (cost: number, value: number) => (value >= cost ? 'gain' : 'loss');

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
/** '2026-11-14' → 'NOV 14' (no timezone shift). */
export const shortDate = (iso: string) => {
  const [, m, d] = iso.split('-');
  return `${MONTHS[Number(m) - 1]} ${d}`;
};
/** '2026-12-12' → 'SAT DEC 12' */
export const longDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${DAYS[new Date(y, m - 1, d).getDay()]} ${MONTHS[m - 1]} ${d}`;
};
export const daysUntil = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date();
  return Math.round((new Date(y, m - 1, d).getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / 86400000);
};
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const clock = (d: Date) => d.toTimeString().slice(0, 5);
export const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
