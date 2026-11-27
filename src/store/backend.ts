import type { DB } from '../types';
import type { Action, Result } from './reducer';

export type Snapshot = { status: 'ready'; db: DB } | { status: 'empty' };

export interface Backend {
  kind: 'local' | 'firestore';
  /** Live data. `empty` means the shared ledger hasn't been set up yet. */
  subscribe(onData: (s: Snapshot) => void, onError: (e: Error) => void): () => void;
  apply(action: Action): Promise<Result>;
}
