import type { Ad, Card, CardInput, DB, Estimate, Interest, Payment, Show, ShowLine, Task } from '../types';
import { today } from '../lib/format';

/*
 * Every change to the ledger is an Action run through this pure reducer.
 * The local backend applies it to the copy in this browser; the Firestore
 * backend applies it inside a transaction to the latest server copy, so two
 * devices recording sales at once can't overwrite each other.
 *
 * Card actions only ever look at the card named by `id` (plus the ledger
 * document), which is what lets Firestore load just those documents.
 */

export type SaleInput = { price: number; on: string; payment: Payment; buyer: string; showId: string | null; adId: number | null };

export type Action =
  | { type: 'addCard'; input: CardInput; event: string; on: string; note: string; paid: boolean; showId: string | null; estimate?: Estimate | null }
  | { type: 'updateCard'; id: string; input: CardInput; sale?: SaleInput; estimate?: Estimate | null }
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
  | { type: 'openShow'; id: string; opening: NonNullable<Show['opening']> }
  | { type: 'setMultiplier'; grade: string; value: number }
  | { type: 'removeMultiplier'; grade: string }
  | { type: 'setApiKey'; key: string }
  | { type: 'addTask'; task: Omit<Task, 'id' | 'createdOn' | 'doneOn'> }
  | { type: 'updateTask'; id: number; patch: Partial<Omit<Task, 'id'>> }
  | { type: 'removeTask'; id: number }
  | { type: 'addInterest'; interest: Omit<Interest, 'id' | 'createdOn'> }
  | { type: 'updateInterest'; id: number; patch: Partial<Omit<Interest, 'id'>> }
  | { type: 'removeInterest'; id: number }
  | { type: 'addAd'; ad: Omit<Ad, 'id'> }
  | { type: 'updateAd'; id: number; patch: Partial<Omit<Ad, 'id'>> }
  | { type: 'removeAd'; id: number }
  | { type: 'replace'; db: DB };

const mapCard = (db: DB, id: string, f: (c: Card) => Card): DB => ({ ...db, cards: db.cards.map((c) => (c.id === id ? f(c) : c)) });
const mapShow = (db: DB, id: string, f: (s: Show) => Show): DB => ({ ...db, shows: db.shows.map((s) => (s.id === id ? f(s) : s)) });
const cardId = (n: number) => 'R1-' + String(n).padStart(4, '0');

export function reducer(db: DB, a: Action): DB {
  let nid = db.nextId;
  const ev = (event: string, on: string, note = '') => ({ id: nid++, event, on, note });
  const done = (next: DB): DB => ({ ...next, nextId: nid });

  switch (a.type) {
    case 'addCard': {
      const events = [ev(a.event, a.on, a.note)];
      if (a.input.status === 'Listed') events.push(ev('LISTED', a.on));
      const card: Card = {
        ...a.input, id: cardId(db.nextCard), paid: a.paid, acquiredShowId: a.showId,
        splitFrom: null, sale: null, estimate: a.estimate ?? null, events,
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
        return { ...c, ...a.input, status, sale, events, estimate: a.estimate ?? c.estimate };
      }));
    case 'sellCard': {
      const src = db.cards.find((c) => c.id === a.id);
      if (!src || src.status === 'Sold' || a.qty < 1 || a.qty > src.qty) return db;
      const sale = { price: a.price, on: a.on, at: new Date().toISOString(), payment: a.payment, buyer: a.buyer.trim(), showId: a.showId, adId: a.adId };
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
    case 'openShow':
      return mapShow(db, a.id, (s) => ({ ...s, opening: a.opening }));
    case 'setMultiplier':
      return { ...db, settings: { ...db.settings, multipliers: { ...db.settings.multipliers, [a.grade]: a.value } } };
    case 'removeMultiplier': {
      const multipliers = { ...db.settings.multipliers };
      delete multipliers[a.grade];
      return { ...db, settings: { ...db.settings, multipliers } };
    }
    case 'setApiKey':
      return { ...db, settings: { ...db.settings, pokemonApiKey: a.key } };
    case 'addTask':
      return done({ ...db, tasks: [...db.tasks, { ...a.task, id: nid++, createdOn: today(), doneOn: a.task.status === 'done' ? today() : null }] });
    case 'updateTask':
      return {
        ...db,
        tasks: db.tasks.map((t) => {
          if (t.id !== a.id) return t;
          const next = { ...t, ...a.patch };
          if (a.patch.status) next.doneOn = a.patch.status === 'done' ? (t.doneOn ?? today()) : null;
          return next;
        }),
      };
    case 'removeTask':
      return { ...db, tasks: db.tasks.filter((t) => t.id !== a.id) };
    case 'addInterest':
      return done({ ...db, interests: [...db.interests, { ...a.interest, id: nid++, createdOn: today() }] });
    case 'updateInterest':
      return { ...db, interests: db.interests.map((x) => (x.id === a.id ? { ...x, ...a.patch } : x)) };
    case 'removeInterest':
      return { ...db, interests: db.interests.filter((x) => x.id !== a.id) };
    case 'addAd':
      return done({ ...db, ads: [...db.ads, { ...a.ad, id: nid++ }] });
    case 'updateAd':
      return { ...db, ads: db.ads.map((x) => (x.id === a.id ? { ...x, ...a.patch } : x)) };
    case 'removeAd':
      return { ...db, ads: db.ads.filter((x) => x.id !== a.id) };
    case 'replace':
      return normalize(a.db);
  }
}


/** Fills in lists added after a ledger was first saved, so older data keeps working. */
export function normalize(db: DB): DB {
  return { ...db, tasks: db.tasks ?? [], interests: db.interests ?? [], ads: db.ads ?? [] };
}

/** Actions that read or change one existing card, named by `id`. */
export const CARD_ACTIONS = new Set<Action['type']>(['updateCard', 'sellCard', 'setEstimate', 'applyEstimate']);

export interface Result {
  db: DB;
  newCardIds: string[];
  newShowIds: string[];
}

export function diffResult(before: DB, after: DB): Result {
  const cards = new Set(before.cards.map((c) => c.id));
  const shows = new Set(before.shows.map((s) => s.id));
  return {
    db: after,
    newCardIds: after.cards.filter((c) => !cards.has(c.id)).map((c) => c.id),
    newShowIds: after.shows.filter((s) => !shows.has(s.id)).map((s) => s.id),
  };
}
