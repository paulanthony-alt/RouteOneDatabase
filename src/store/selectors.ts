import type { Card, DB, Show } from '../types';
import { today } from '../lib/format';

export const units = (cards: Card[]) => cards.reduce((n, c) => n + c.qty, 0);
export const total = (cards: Card[], pick: (c: Card) => number) => cards.reduce((s, c) => s + pick(c) * c.qty, 0);
export const soldCards = (db: DB) => db.cards.filter((c) => c.status === 'Sold' && c.sale);
export const openCards = (db: DB) => db.cards.filter((c) => c.status !== 'Sold');
export const acquiredOn = (c: Card) => c.events[0]?.on ?? '';

export interface LedgerLine {
  on: string;
  label: string;
  amount: number;
  kind: 'START' | 'BUY' | 'SALE' | 'SHOW' | 'AD' | 'ADJUST';
  adjId?: number;
}

/**
 * Bankroll movements. Purchases flagged "paid" come out, sales come in (trades
 * bring in no money), show income/expense lines and manual adjustments apply.
 * A split purchase is counted once, against its original record. Anything dated
 * before the bankroll's start date is left out.
 */
export function cashLedger(db: DB): LedgerLine[] {
  const out: LedgerLine[] = [{ on: db.bankroll.startedOn, label: 'Starting money', amount: db.bankroll.starting, kind: 'START' }];

  const buys = new Map<string, { card: Card; amount: number; units: number }>();
  for (const c of db.cards) {
    if (!c.paid) continue;
    const root = c.splitFrom ?? c.id;
    const b = buys.get(root) ?? { card: c, amount: 0, units: 0 };
    b.amount += c.cost * c.qty;
    b.units += c.qty;
    if (!c.splitFrom) b.card = c;
    buys.set(root, b);
  }
  for (const [root, b] of buys) {
    out.push({ on: acquiredOn(b.card), label: `Bought ${b.card.name} ×${b.units} (${root})`, amount: -b.amount, kind: 'BUY' });
  }

  for (const c of soldCards(db)) {
    if (c.sale!.payment === 'Trade') continue;
    out.push({ on: c.sale!.on, label: `Sold ${c.name} ×${c.qty} (${c.id}) · ${c.sale!.payment}`, amount: c.sale!.price * c.qty, kind: 'SALE' });
  }

  for (const s of db.shows) {
    for (const l of s.lines) {
      out.push({ on: s.date, label: `${s.name} · ${l.label}`, amount: l.kind === 'income' ? l.amount : -l.amount, kind: 'SHOW' });
    }
  }

  for (const ad of db.ads) out.push({ on: ad.on, label: `Ad · ${ad.name} (${ad.channel})`, amount: -ad.spend, kind: 'AD' });

  for (const a of db.bankroll.adjustments) out.push({ on: a.on, label: a.note || 'Adjustment', amount: a.amount, kind: 'ADJUST', adjId: a.id });

  // Money that moved before the starting date is already reflected in the starting amount.
  return out
    .filter((l) => l.kind === 'START' || l.on >= db.bankroll.startedOn)
    .sort((x, y) => x.on.localeCompare(y.on) || (x.kind === 'START' ? -1 : y.kind === 'START' ? 1 : 0));
}

export const cashOnHand = (db: DB) => cashLedger(db).reduce((s, l) => s + l.amount, 0);

const who = (s: string) => s.trim().toLowerCase();

export function showStats(db: DB, show: Show) {
  const sales = soldCards(db)
    .filter((c) => c.sale!.showId === show.id)
    .sort((a, b) => a.sale!.at.localeCompare(b.sale!.at));
  const gross = total(sales, (c) => c.sale!.price);
  const cogs = total(sales, (c) => c.cost);
  const cardProfit = gross - cogs;
  const income = show.lines.filter((l) => l.kind === 'income').reduce((s, l) => s + l.amount, 0);
  const expenses = show.lines.filter((l) => l.kind === 'expense').reduce((s, l) => s + l.amount, 0);
  const net = cardProfit + income - expenses;

  const buys = db.cards.filter((c) => c.acquiredShowId === show.id);
  const spent = total(buys.filter((c) => c.paid), (c) => c.cost);
  const cashSales = total(sales.filter((c) => c.sale!.payment === 'Cash'), (c) => c.sale!.price);
  const drawer = show.float + cashSales - spent;

  // Attendance retention: door counts tallied on the day.
  const visitors = show.attendance.new + show.attendance.returning;

  // Customer retention: buyers at this show who had bought from us before it.
  const earlier = new Set(
    soldCards(db)
      .filter((c) => c.sale!.buyer && c.sale!.showId !== show.id && c.sale!.on <= show.date)
      .map((c) => who(c.sale!.buyer)),
  );
  const buyers = [...new Set(sales.filter((c) => c.sale!.buyer).map((c) => who(c.sale!.buyer)))];
  const repeatBuyers = buyers.filter((b) => earlier.has(b));

  // Inventory retention: what came to the show vs. what went home.
  const soldUnits = units(sales);
  const listedNow = units(db.cards.filter((c) => c.status === 'Listed'));
  const broughtUnits = show.opening ? show.opening.units : listedNow + soldUnits;

  return {
    sales, gross, cogs, cardProfit, income, expenses, net, margin: gross ? cardProfit / gross : 0,
    buys, spent, cashSales, drawer,
    visitors, returningVisitors: show.attendance.returning,
    buyers: buyers.length, repeatBuyers: repeatBuyers.length,
    soldUnits, broughtUnits, keptUnits: Math.max(0, broughtUnits - soldUnits),
  };
}

/** The next show on or after today, else the most recent one. */
export function nextShow(db: DB): Show | undefined {
  const t = today();
  const sorted = [...db.shows].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.find((s) => s.date >= t) ?? sorted[sorted.length - 1];
}

/* ---------- Profit & loss ---------- */

/** 'all', a year ('2026') or a month ('2026-12'). */
export type Period = string;
export const inPeriod = (date: string, period: Period) => period === 'all' || date.startsWith(period);

export function periodsIn(db: DB): string[] {
  const dates = [
    ...soldCards(db).map((c) => c.sale!.on),
    ...db.shows.filter((s) => s.lines.length).map((s) => s.date),
    ...db.ads.map((a) => a.on),
  ];
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))].sort().reverse();
  const years = [...new Set(months.map((m) => m.slice(0, 4)))];
  return [...years, ...months].sort((a, b) => b.localeCompare(a) || a.length - b.length);
}

export function pnl(db: DB, period: Period) {
  const sales = soldCards(db).filter((c) => inPeriod(c.sale!.on, period));
  const revenue = total(sales, (c) => c.sale!.price);
  const cost = total(sales, (c) => c.cost);
  const profitOf = (cs: Card[]) => total(cs, (c) => c.sale!.price - c.cost);
  const cards = {
    sales, units: units(sales), revenue, cost, profit: revenue - cost,
    atShows: profitOf(sales.filter((c) => c.sale!.showId)),
    fromAds: profitOf(sales.filter((c) => c.sale!.adId != null)),
  };

  const shows = db.shows
    .filter((s) => inPeriod(s.date, period))
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((show) => {
      const st = showStats(db, show);
      return { show, cardProfit: st.cardProfit, income: st.income, expenses: st.expenses, other: st.income - st.expenses, net: st.net };
    });
  const showOther = shows.reduce((s, x) => s + x.other, 0);

  const ads = db.ads
    .filter((a) => inPeriod(a.on, period))
    .sort((a, b) => b.on.localeCompare(a.on))
    .map((ad) => {
      const brought = soldCards(db).filter((c) => c.sale!.adId === ad.id);
      const profit = profitOf(brought);
      return { ad, sales: brought.length, revenue: total(brought, (c) => c.sale!.price), profit, net: profit - ad.spend };
    });
  const adSpend = ads.reduce((s, x) => s + x.ad.spend, 0);

  return {
    cards, shows, ads, adSpend, showOther,
    /** Card profit is counted once (under Cards) even when the sale happened at a show or came from an ad. */
    net: cards.profit + showOther - adSpend,
  };
}

export function monthly(db: DB, year: string | null) {
  const months = periodsIn(db).filter((p) => p.length === 7 && (!year || p.startsWith(year)));
  return months.map((m) => {
    const p = pnl(db, m);
    return { month: m, cards: p.cards.profit, shows: p.showOther, ads: -p.adSpend, net: p.net };
  });
}
