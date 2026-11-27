import type { DB } from '../types';
import { today } from '../lib/format';
import type { Backend, Snapshot } from './backend';
import { diffResult, reducer, type Action } from './reducer';
import { seed } from './seed';

/** Data saved in this browser only (used when Firebase isn't configured). */
export const LOCAL_KEY = 'route-one-ledger-v1';

export function sampleDB(): DB {
  const db = seed();
  return { ...db, bankroll: { ...db.bankroll, startedOn: today() } };
}

/** No cards; keeps the shows and grade multipliers. */
export function emptyDB(): DB {
  return { ...sampleDB(), cards: [], nextCard: 1 };
}

export function readLocal(): DB | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const db = raw ? (JSON.parse(raw) as DB) : null;
    return db && db.version === 1 ? db : null;
  } catch {
    return null;
  }
}

export function localBackend(): Backend {
  let db = readLocal() ?? sampleDB();
  const listeners = new Set<(s: Snapshot) => void>();
  return {
    kind: 'local',
    subscribe(onData) {
      listeners.add(onData);
      onData({ status: 'ready', db });
      return () => listeners.delete(onData);
    },
    async apply(action: Action) {
      const before = db;
      db = reducer(db, action);
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(db));
      } catch {
        /* storage full or blocked */
      }
      listeners.forEach((l) => l({ status: 'ready', db }));
      return diffResult(before, db);
    },
  };
}
