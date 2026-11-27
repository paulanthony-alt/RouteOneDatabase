import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DB } from '../types';
import type { Backend } from './backend';
import type { Action, Result } from './reducer';

export type { Action } from './reducer';

interface StoreValue {
  db: DB;
  backend: Backend['kind'];
  /** Resolves to the result, or null if the change couldn't be saved (the error is shown in a toast). */
  dispatch: (a: Action) => Promise<Result | null>;
  saving: boolean;
}

const Ctx = createContext<StoreValue | null>(null);

type Phase = { status: 'loading' } | { status: 'ready'; db: DB } | { status: 'empty' } | { status: 'error'; error: Error };

interface Props {
  backend: Backend;
  /** Rendered until there is data: loading, the empty-ledger setup, or a load error. */
  fallback: (phase: Exclude<Phase, { status: 'ready' }>, apply: Backend['apply']) => ReactNode;
  children: ReactNode;
}

export function StoreProvider({ backend, fallback, children }: Props) {
  const [phase, setPhase] = useState<Phase>({ status: 'loading' });
  const [inflight, setInflight] = useState(0);
  const [toast, setToast] = useState('');

  useEffect(
    () => backend.subscribe((s) => setPhase(s), (error) => setPhase({ status: 'error', error })),
    [backend],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const dispatch = useCallback(
    async (a: Action) => {
      setInflight((n) => n + 1);
      try {
        return await backend.apply(a);
      } catch (e) {
        const msg = (e as { code?: string; message: string }).code === 'unavailable'
          ? 'Couldn’t save — no connection to the database. Try again when back online.'
          : `Couldn’t save: ${(e as Error).message}`;
        setToast(msg);
        return null;
      } finally {
        setInflight((n) => n - 1);
      }
    },
    [backend],
  );

  const value = useMemo(
    () => (phase.status === 'ready' ? { db: phase.db, backend: backend.kind, dispatch, saving: inflight > 0 } : null),
    [phase, backend.kind, dispatch, inflight],
  );

  if (phase.status !== 'ready' || !value) return <>{fallback(phase as Exclude<Phase, { status: 'ready' }>, backend.apply)}</>;
  return (
    <Ctx.Provider value={value}>
      {children}
      {toast && (
        <div className="toast" role="alert">
          {toast}
          <button type="button" className="x" aria-label="Dismiss" onClick={() => setToast('')}>×</button>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore outside StoreProvider');
  return v;
}
