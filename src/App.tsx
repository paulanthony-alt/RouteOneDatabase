import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import type { Card } from './types';
import { StoreProvider, useStore } from './store/store';
import type { Backend } from './store/backend';
import { localBackend } from './store/local';
import { firestoreBackend } from './store/firestore';
import { fb, firebaseEnabled, sharedEmail } from './lib/firebase';
import Gate from './components/Gate';
import Login from './components/Login';
import Setup from './components/Setup';
import { cashOnHand, nextShow, soldCards } from './store/selectors';
import { daysUntil, longDate, money } from './lib/format';
import Brand from './components/Brand';
import CardFormDialog from './components/CardFormDialog';
import MarkSoldDialog from './components/MarkSoldDialog';
import InventoryPage from './pages/InventoryPage';
import SalesPage from './pages/SalesPage';
import ShowsPage from './pages/ShowsPage';
import RatesPage from './pages/RatesPage';
import BankrollPage from './pages/BankrollPage';
import TasksPage from './pages/TasksPage';
import PnLPage from './pages/PnLPage';
import InterestsPage, { matchesFor } from './pages/InterestsPage';

export type Page = 'inventory' | 'sales' | 'pnl' | 'shows' | 'tasks' | 'interests' | 'rates' | 'bankroll';
const PAGES: Page[] = ['inventory', 'sales', 'pnl', 'shows', 'tasks', 'interests', 'rates', 'bankroll'];

export type Modal =
  | { kind: 'new'; showId?: string }
  | { kind: 'edit'; card: Card }
  | { kind: 'sold'; card?: Card; showId?: string }
  | null;

const pageFromHash = (): Page => {
  const h = window.location.hash.slice(1) as Page;
  return PAGES.includes(h) ? h : 'inventory';
};

export default function App() {
  return firebaseEnabled ? <FirebaseApp /> : <LocalApp />;
}

type Phase = Parameters<Parameters<typeof StoreProvider>[0]['fallback']>[0];

function fallback(phase: Phase, apply: Backend['apply'], user?: User): ReactNode {
  if (phase.status === 'loading') return <Gate label="LOADING LEDGER…" />;
  if (phase.status === 'empty') return <Setup apply={apply} />;
  const denied = (phase.error as { code?: string }).code === 'permission-denied';
  return (
    <Gate label={denied ? 'NO ACCESS' : 'COULDN’T LOAD'} title={denied ? 'Not on the staff list' : 'Something went wrong'}>
      <p className="sub">
        {denied
          ? `${user?.email ?? 'This account'} is signed in, but isn’t on the staff list. Add a document with that email as its ID in Firebase (Firestore → staff).`
          : phase.error.message}
      </p>
      {user && <button type="button" className="btn btn-ghost" onClick={() => signOut(fb().auth)}>SIGN OUT</button>}
    </Gate>
  );
}

function LocalApp() {
  const backend = useMemo(localBackend, []);
  return (
    <StoreProvider backend={backend} fallback={(p, apply) => fallback(p, apply)}>
      <Shell />
    </StoreProvider>
  );
}

function FirebaseApp() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  useEffect(() => onAuthStateChanged(fb().auth, setUser), []);
  const backend = useMemo(() => (user ? firestoreBackend() : null), [user]);

  if (user === undefined) return <Gate label="LOADING…" />;
  if (!user || !backend) return <Login />;
  return (
    <StoreProvider key={user.uid} backend={backend} fallback={(p, apply) => fallback(p, apply, user)}>
      <Shell user={user} />
    </StoreProvider>
  );
}

function Shell({ user }: { user?: User }) {
  const { db, saving, backend } = useStore();
  const [page, setPage] = useState<Page>(pageFromHash);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);

  useEffect(() => {
    const on = () => setPage(pageFromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const show = nextShow(db);
  const days = show ? daysUntil(show.date) : 0;
  const saved = (id: string) => {
    setModal(null);
    setSel(id);
  };

  const nav: [Page, string, string | number][] = [
    ['inventory', 'INVENTORY', db.cards.filter((c) => c.status !== 'Sold').length],
    ['sales', 'SALES', soldCards(db).length],
    ['pnl', 'PROFIT & LOSS', ''],
    ['shows', 'SHOWS', db.shows.length],
    ['tasks', 'TASKS', db.tasks.filter((t) => t.status !== 'done').length || ''],
    ['interests', 'INTERESTS', db.interests.filter((i) => i.status !== 'closed').length || ''],
    ['rates', 'MARKET RATES', ''],
    ['bankroll', 'BANKROLL', money(cashOnHand(db))],
  ];

  const inStock = db.interests.filter((i) => i.status !== 'closed' && i.kind === 'customer' && matchesFor(db, i).length).length;

  return (
    <div className="app">
      <div className="stripe" />

      <header>
        <Brand />
        {(page === 'inventory' || page === 'sales') && (
          <label className="search">
            <span>SEARCH</span>
            <input type="search" placeholder="Card, set, grade, ID, buyer" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        )}
        <div className="spacer" />
        <span className="tag" role="status">
          {saving ? 'SAVING…' : backend === 'local' ? 'SAVED IN THIS BROWSER' : 'SYNCED'}
        </span>
        {user && (
          <span className="user">
            {!sharedEmail && <span className="tag" title={user.email ?? ''}>{(user.email ?? '').toUpperCase()}</span>}
            <button className="link" type="button" onClick={() => signOut(fb().auth)}>SIGN OUT</button>
          </span>
        )}
        <button className="btn btn-ghost" type="button" onClick={() => setModal({ kind: 'sold' })}>
          RECORD SALE
        </button>
        <button className="btn btn-accent" type="button" onClick={() => setModal({ kind: 'new' })}>+ NEW ENTRY</button>
      </header>

      <div className="body">
        <nav aria-label="Sections">
          {nav.map(([p, label, count]) => (
            <a key={p} href={'#' + p} className={page === p ? 'active' : ''} aria-current={page === p ? 'page' : undefined}>
              {label}{' '}
              {p === 'interests' && inStock ? (
                <span className="count gain" title={`${inStock} customer want${inStock === 1 ? '' : 's'} in stock`}>● {count}</span>
              ) : (
                <span className="count">{count}</span>
              )}
            </a>
          ))}
          <a className="soon" aria-disabled="true">VENDORS <span className="count">SOON</span></a>
          <a className="soon" aria-disabled="true">GRADING QUEUE <span className="count">SOON</span></a>
          {show && (
            <a className="next-op" href="#shows">
              <span className="label">{days > 0 ? `NEXT OPERATION · ${days} DAY${days === 1 ? '' : 'S'}` : days === 0 ? 'SHOW DAY · TODAY' : 'LAST OPERATION'}</span>
              <strong>{show.name}</strong>
              <span className="mono">
                {longDate(show.date)}{show.hours && ` · ${show.hours}`}
                {show.venue.split(',').map((part, i) => <span key={i}><br />{part.trim().toUpperCase()}</span>)}
              </span>
            </a>
          )}
        </nav>

        {page === 'inventory' && (
          <InventoryPage
            q={q}
            sel={sel}
            onSelect={setSel}
            onEdit={(card) => setModal({ kind: 'edit', card })}
            onSell={(card) => setModal({ kind: 'sold', card })}
          />
        )}
        {page === 'sales' && <SalesPage q={q} onOpen={(id) => { setSel(id); window.location.hash = 'inventory'; }} />}
        {page === 'shows' && (
          <ShowsPage
            onSell={(showId) => setModal({ kind: 'sold', showId })}
            onBuy={(showId) => setModal({ kind: 'new', showId })}
          />
        )}
        {page === 'rates' && <RatesPage onOpen={(id) => { setSel(id); window.location.hash = 'inventory'; }} />}
        {page === 'pnl' && <PnLPage />}
        {page === 'tasks' && <TasksPage />}
        {page === 'interests' && <InterestsPage onOpenCard={(id) => { setSel(id); window.location.hash = 'inventory'; }} />}
        {page === 'bankroll' && <BankrollPage />}
      </div>

      {modal?.kind === 'new' && <CardFormDialog defaultShowId={modal.showId} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.kind === 'edit' && <CardFormDialog card={modal.card} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.kind === 'sold' && <MarkSoldDialog card={modal.card} defaultShowId={modal.showId} onClose={() => setModal(null)} onSaved={saved} />}
    </div>
  );
}
