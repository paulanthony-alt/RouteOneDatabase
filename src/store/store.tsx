import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react';
import type { Card, CardInput, DB, Estimate, Payment, Show, ShowLine } from '../types';
import { today } from '../lib/format';
import { seed } from './seed';

/*
 * All app data lives in one DB object, saved to localStorage on every change.
 * To move to Firebase, replace load()/save() with Firestore reads/writes (for
 * example this whole object in one document). The reducer and UI stay the same.
 */
const KEY = 'route-one-ledger-v1';

export function freshDB(): DB {
  const db = seed();
  return { ...db, bankroll: { ...db.bankroll, startedOn: today() } };
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as DB;
      if (db.version === 1) return db;
    }
  } catch {
    /* fall through to sample data */
  }
  return freshDB();
}

function save(db: DB) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* storage full or blocked */
  }
}

type SaleInput = { price: number; on: string; payment: Payment; buyer: string; showId: string | null };

export type Action =
  | { type: 'addCard'; input: CardInput; event: string; on: string; note: string; paid: boolean; showId: string | null }
  | { type: 'updateCard'; id: string; input: CardInput; sale?: SaleInput }
  | ({ type: 'sellCard'; id: string; qty: number; note: string } & SaleInput)
  | { type: 'setEstimate'; id: string; estimate: Estimate }
  | { type: 'applyEstimate'; id: string }
  | { type: 'setBankroll'; starting: number; startedOn: string }
  | { type: 'addAdjustment'; on: string; amount: number; note: string }
  | { type: 'removeAdjustment'; id: number }
  | { type: 'addShow'; show: Pick<Show, 'name' | 'date' | 'hours' | 'venue' | 'float'> }
  | { type: 'updateShow'; id: string; patch: Partial<Pick<Show, 'name' | 'date' | 'hours' | 'venue' | 'float'>> }
  | { type: 'addShowLine'; id: string; line: Omit<ShowLine, 'id'> }
  | { type: 'removeShowLine'; id: string; lineId: number }
  | { type: 'count'; id: string; who: 'new' | 'returning'; delta: 1 | -1 }
  | { type: 'openShow'; id: string }
  | { type: 'setMultiplier'; grade: string; value: number }
  | { type: 'removeMultiplier'; grade: string }
  | { type: 'setApiKey'; key: string }
  | { type: 'replace'; db: DB };

const mapCard = (db: DB, id: string, f: (c: Card) => Card): DB => ({ ...db, cards: db.cards.map((c) => (c.id === id ? f(c) : c)) });
const mapShow = (db: DB, id: string, f: (s: Show) => Show): DB => ({ ...db, shows: db.shows.map((s) => (s.id === id ? f(s) : s)) });
const cardId = (n: number) => 'R1-' + String(n).padStart(4, '0');

function reducer(db: DB, a: Action): DB {
  let nid = db.nextId;
  const ev = (event: string, on: string, note = '') => ({ id: nid++, event, on, note });
  const done = (next: DB): DB => ({ ...next, nextId: nid });

  switch (a.type) {
    case 'addCard': {
      const events = [ev(a.event, a.on, a.note)];
      if (a.input.status === 'Listed') events.push(ev('LISTED', a.on));
      const card: Card = {
        ...a.input, id: cardId(db.nextCard), paid: a.paid, acquiredShowId: a.showId,
        splitFrom: null, sale: null, estimate: null, events,
      };
      return done({ ...db, nextCard: db.nextCard + 1, cards: [...db.cards, card] });
    }
    case 'updateCard':
      return done(mapCard(db, a.id, (c) => {
        const events = [...c.events];
        const status = c.status === 'Sold' ? 'Sold' : a.input.status;
        if (status !== c.status) events.push(ev(status === 'Listed' ? 'LISTED' : 'UNLISTED', today()));
        if (c.market !== a.input.market) events.push(ev('REPRICED', today(), `$${c.market} → $${a.input.market} · manual`));
        const sale = c.sale && a.sale ? { ...c.sale, ...a.sale } : c.sale;
        return { ...c, ...a.input, status, sale, events };
      }));
    case 'sellCard': {
      const src = db.cards.find((c) => c.id === a.id);
      if (!src || src.status === 'Sold' || a.qty < 1 || a.qty > src.qty) return db;
      const sale = { price: a.price, on: a.on, at: new Date().toISOString(), payment: a.payment, buyer: a.buyer.trim(), showId: a.showId };
      const show = a.showId ? db.shows.find((s) => s.id === a.showId)?.name : '';
      const note = [a.note || show, a.payment, a.buyer && `to ${a.buyer}`].filter(Boolean).join(' · ');
      if (a.qty === src.qty) {
        return done(mapCard(db, a.id, (c) => ({ ...c, status: 'Sold', location: '—', sale, events: [...c.events, ev('SOLD', a.on, note)] })));
      }
      const id = cardId(db.nextCard);
      const soldCard: Card = {
        ...src, id, qty: a.qty, status: 'Sold', location: '—', splitFrom: src.id, sale,
        events: [
          ...src.events.map((e) => ev(e.event, e.on, e.note)),
          ev('SPLIT', a.on, `${a.qty} of ${src.qty} units from ${src.id}`),
          ev('SOLD', a.on, note),
        ],
      };
      const next = mapCard(db, a.id, (c) => ({ ...c, qty: c.qty - a.qty, events: [...c.events, ev('SPLIT', a.on, `${a.qty} sold → ${id}`)] }));
      return done({ ...next, nextCard: db.nextCard + 1, cards: [...next.cards, soldCard] });
    }
    case 'setEstimate':
      return mapCard(db, a.id, (c) => ({ ...c, estimate: a.estimate }));
    case 'applyEstimate':
      return done(mapCard(db, a.id, (c) => {
        if (!c.estimate || c.status === 'Sold') return c;
        const value = Math.round(c.estimate.value * 100) / 100;
        if (value === c.market) return c;
        return { ...c, market: value, events: [...c.events, ev('REPRICED', today(), `$${c.market} → $${value} · ${c.estimate.source}`)] };
      }));
    case 'setBankroll':
      return { ...db, bankroll: { ...db.bankroll, starting: a.starting, startedOn: a.startedOn } };
    case 'addAdjustment':
      return done({ ...db, bankroll: { ...db.bankroll, adjustments: [...db.bankroll.adjustments, { id: nid++, on: a.on, amount: a.amount, note: a.note }] } });
    case 'removeAdjustment':
      return { ...db, bankroll: { ...db.bankroll, adjustments: db.bankroll.adjustments.filter((x) => x.id !== a.id) } };
    case 'addShow':
      return done({ ...db, shows: [...db.shows, { ...a.show, id: 'show-' + nid++, lines: [], attendance: { new: 0, returning: 0 }, opening: null }] });
    case 'updateShow':
      return mapShow(db, a.id, (s) => ({ ...s, ...a.patch }));
    case 'addShowLine':
      return done(mapShow(db, a.id, (s) => ({ ...s, lines: [...s.lines, { ...a.line, id: nid++ }] })));
    case 'removeShowLine':
      return mapShow(db, a.id, (s) => ({ ...s, lines: s.lines.filter((l) => l.id !== a.lineId) }));
    case 'count':
      return mapShow(db, a.id, (s) => ({ ...s, attendance: { ...s.attendance, [a.who]: Math.max(0, s.attendance[a.who] + a.delta) } }));
    case 'openShow': {
      const listed = db.cards.filter((c) => c.status === 'Listed');
      return mapShow(db, a.id, (s) => ({
        ...s,
        opening: {
          at: new Date().toISOString(),
          units: listed.reduce((n, c) => n + c.qty, 0),
          value: listed.reduce((n, c) => n + c.market * c.qty, 0),
        },
      }));
    }
    case 'setMultiplier':
      return { ...db, settings: { ...db.settings, multipliers: { ...db.settings.multipliers, [a.grade]: a.value } } };
    case 'removeMultiplier': {
      const multipliers = { ...db.settings.multipliers };
      delete multipliers[a.grade];
      return { ...db, settings: { ...db.settings, multipliers } };
    }
    case 'setApiKey':
      return { ...db, settings: { ...db.settings, pokemonApiKey: a.key } };
    case 'replace':
      return a.db;
  }
}

const Ctx = createContext<{ db: DB; dispatch: (a: Action) => void } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => save(db), [db]);
  return <Ctx.Provider value={{ db, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
