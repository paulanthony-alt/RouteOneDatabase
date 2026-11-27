import { useEffect, useState } from 'react';
import type { Card } from './types';
import { StoreProvider, useStore } from './store/store';
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

export type Page = 'inventory' | 'sales' | 'shows' | 'rates' | 'bankroll';
const PAGES: Page[] = ['inventory', 'sales', 'shows', 'rates', 'bankroll'];

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
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const { db } = useStore();
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
    ['shows', 'SHOWS', db.shows.length],
    ['rates', 'MARKET RATES', ''],
    ['bankroll', 'BANKROLL', money(cashOnHand(db))],
  ];

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
        <button className="btn btn-ghost" type="button" onClick={() => setModal({ kind: 'sold' })}>
          RECORD SALE
        </button>
        <button className="btn btn-accent" type="button" onClick={() => setModal({ kind: 'new' })}>+ NEW ENTRY</button>
      </header>

      <div className="body">
        <nav aria-label="Sections">
          {nav.map(([p, label, count]) => (
            <a key={p} href={'#' + p} className={page === p ? 'active' : ''} aria-current={page === p ? 'page' : undefined}>
              {label} <span className="count">{count}</span>
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
        {page === 'bankroll' && <BankrollPage />}
      </div>

      {modal?.kind === 'new' && <CardFormDialog defaultShowId={modal.showId} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.kind === 'edit' && <CardFormDialog card={modal.card} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.kind === 'sold' && <MarkSoldDialog card={modal.card} defaultShowId={modal.showId} onClose={() => setModal(null)} onSaved={saved} />}
    </div>
  );
}
