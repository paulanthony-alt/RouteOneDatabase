import {
  collection, doc, getDocs, onSnapshot, runTransaction, writeBatch, type DocumentReference,
} from 'firebase/firestore';
import type { Card, DB } from '../types';
import { fb } from '../lib/firebase';
import type { Backend, Snapshot } from './backend';
import { CARD_ACTIONS, diffResult, reducer, type Action } from './reducer';

/*
 * Firestore layout
 *   ledger/main   everything except cards: shows, bankroll, settings, ID counters
 *   cards/{id}    one document per inventory record (R1-0001, …)
 */
type Meta = Omit<DB, 'cards'>;

/** Key-order-independent comparison, so unchanged documents aren't rewritten. */
function same(a: unknown, b: unknown): boolean {
  const norm = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(norm)
      : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort().map((k) => [k, norm((v as Record<string, unknown>)[k])]))
      : v;
  return JSON.stringify(norm(a)) === JSON.stringify(norm(b));
}

const split = (db: DB): { meta: Meta; cards: Card[] } => {
  const { cards, ...meta } = db;
  return { meta, cards };
};

export function firestoreBackend(): Backend {
  const { db: fs } = fb();
  const metaRef = doc(fs, 'ledger', 'main') as DocumentReference<Meta>;
  const cardRef = (id: string) => doc(fs, 'cards', id) as DocumentReference<Card>;
  const cardsCol = collection(fs, 'cards');

  async function replaceAll(next: DB) {
    const existing = await getDocs(cardsCol);
    const keep = new Set(next.cards.map((c) => c.id));
    const ops: ((b: ReturnType<typeof writeBatch>) => void)[] = [
      ...existing.docs.filter((d) => !keep.has(d.id)).map((d) => (b: ReturnType<typeof writeBatch>) => b.delete(d.ref)),
      ...next.cards.map((c) => (b: ReturnType<typeof writeBatch>) => b.set(cardRef(c.id), c)),
    ];
    for (let i = 0; i < ops.length; i += 400) {
      const b = writeBatch(fs);
      ops.slice(i, i + 400).forEach((op) => op(b));
      await b.commit();
    }
    const b = writeBatch(fs);
    b.set(metaRef, split(next).meta);
    await b.commit();
    return { db: next, newCardIds: [], newShowIds: [] };
  }

  return {
    kind: 'firestore',

    subscribe(onData, onError) {
      let meta: Meta | null | undefined;
      let cards: Card[] | undefined;
      const emit = () => {
        if (meta === undefined || cards === undefined) return;
        const s: Snapshot = meta === null ? { status: 'empty' } : { status: 'ready', db: { ...meta, cards } };
        onData(s);
      };
      const stopMeta = onSnapshot(metaRef, (s) => { meta = s.exists() ? s.data() : null; emit(); }, onError);
      const stopCards = onSnapshot(cardsCol, (s) => {
        cards = s.docs.map((d) => d.data() as Card).sort((a, b) => a.id.localeCompare(b.id));
        emit();
      }, onError);
      return () => { stopMeta(); stopCards(); };
    },

    async apply(action: Action) {
      if (action.type === 'replace') return replaceAll(action.db);

      return runTransaction(fs, async (tx) => {
        const metaSnap = await tx.get(metaRef);
        if (!metaSnap.exists()) throw new Error('The shared ledger has not been set up yet.');
        const meta = metaSnap.data();

        const cards: Card[] = [];
        if (CARD_ACTIONS.has(action.type)) {
          const s = await tx.get(cardRef((action as { id: string }).id));
          if (!s.exists()) throw new Error('That record no longer exists.');
          cards.push(s.data());
        }

        const before: DB = { ...meta, cards };
        const after = reducer(before, action);
        const next = split(after);

        // All reads must happen before any write in a transaction.
        const created = next.cards.filter((c) => !cards.some((p) => p.id === c.id));
        for (const c of created) {
          if ((await tx.get(cardRef(c.id))).exists()) throw new Error(`Record ${c.id} already exists — ID counter is out of step.`);
        }
        for (const c of next.cards) {
          const prev = cards.find((p) => p.id === c.id);
          if (!prev || !same(prev, c)) tx.set(cardRef(c.id), c);
        }
        if (!same(meta, next.meta)) tx.set(metaRef, next.meta);
        return diffResult(before, after);
      });
    },
  };
}
