import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Card } from '../types';
import { fetchCards } from '../lib/api';
import { supabase } from '../lib/supabase';
import { clock, money, pct, signed, tone } from '../lib/format';
import Brand from './Brand';
import InventoryTable from './InventoryTable';
import Detail from './Detail';
import CardFormDialog from './CardFormDialog';
import MarkSoldDialog from './MarkSoldDialog';

type Filter = 'ALL' | 'HELD' | 'LISTED' | 'SOLD';
type Modal = { kind: 'new' } | { kind: 'edit'; card: Card } | { kind: 'sold'; card: Card } | null;

const total = (cards: Card[], pick: (c: Card) => number) => cards.reduce((s, c) => s + pick(c) * c.qty, 0);

export default function Ledger({ email }: { email: string }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [synced, setSynced] = useState<Date | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);

  const load = useCallback(async () => {
    try {
      const rows = await fetchCards();
      setCards(rows);
      setSynced(new Date());
      setLoadError('');
    } catch (e) {
      setLoadError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const ql = q.trim().toLowerCase();
  const match = useMemo(
    () => cards.filter((c) => !ql || [c.name, c.set_name, c.card_no, c.grade, c.id, c.game].join(' ').toLowerCase().includes(ql)),
    [cards, ql],
  );
  const list = filter === 'ALL' ? match : match.filter((c) => c.status.toUpperCase() === filter);
  const open = cards.filter((c) => c.status !== 'Sold');
  const sold = cards.filter((c) => c.status === 'Sold');
  const mv = total(open, (c) => c.market);
  const cb = total(open, (c) => c.cost);
  const rz = total(sold, (c) => (c.sold_price ?? c.market) - c.cost);
  const selected = cards.find((c) => c.id === sel) ?? list[0] ?? cards[0] ?? null;

  const kpis = [
    { label: 'ON HAND · MARKET', value: money(mv), note: `${open.reduce((n, c) => n + c.qty, 0)} units held or listed`, c: '' },
    { label: 'COST BASIS', value: money(cb), note: 'What it took to get here', c: '' },
    { label: 'UNREALIZED', value: signed(mv - cb), note: `${pct(cb, mv)} over cost`, c: tone(cb, mv) },
    { label: 'REALIZED', value: signed(rz), note: `${sold.length} sales closed`, c: rz >= 0 ? 'gain' : 'loss' },
  ];

  async function saved(id: string) {
    setModal(null);
    await load();
    setSel(id);
  }

  return (
    <div className="app">
      <div className="stripe" />

      <header>
        <Brand />
        <label className="search">
          <span>SEARCH</span>
          <input type="search" placeholder="Card, set, grade, ID" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="spacer" />
        <span className="tag" title={email}>{email.toUpperCase()}</span>
        <button className="btn btn-link" type="button" onClick={() => supabase.auth.signOut()}>SIGN OUT</button>
        <button className="btn btn-accent" type="button" onClick={() => setModal({ kind: 'new' })}>+ NEW ENTRY</button>
      </header>

      <div className="body">
        <nav aria-label="Sections">
          <a href="#inventory" className="active">INVENTORY <span className="count">{cards.length}</span></a>
          <a href="#sales">SALES</a>
          <a href="#shows">SHOWS</a>
          <a href="#vendors">VENDORS</a>
          <a href="#rates">MARKET RATES</a>
          <a href="#grading">GRADING QUEUE</a>
          <div className="next-op">
            <span className="label">NEXT OPERATION</span>
            <strong>Holiday Pokémon &amp; Sports Card Show</strong>
            <span className="mono">SAT DEC 12 · 9A–3P<br />395 ROUND HILL RD<br />GREENWICH CT</span>
          </div>
        </nav>

        <main id="inventory">
          <section className="content">
            <div className="title-row">
              <div>
                <h1>INVENTORY</h1>
                <p className="meta">
                  {list.length} OF {cards.length} RECORDS · {synced ? `LAST SYNC ${clock(synced)}` : 'SYNCING…'}{' '}
                  <button type="button" className="link" onClick={load}>REFRESH</button>
                </p>
              </div>
              <div className="filters">
                {(['ALL', 'HELD', 'LISTED', 'SOLD'] as Filter[]).map((f) => {
                  const n = f === 'ALL' ? match.length : match.filter((c) => c.status.toUpperCase() === f).length;
                  return (
                    <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                      {f} <span className="n">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="kpis">
              {kpis.map((k) => (
                <div className="kpi" key={k.label}>
                  <span className="label">{k.label}</span>
                  <span className={`value ${k.c}`}>{k.value}</span>
                  <span className="note">{k.note}</span>
                </div>
              ))}
            </div>

            {loadError && <p className="form-error" role="alert">Couldn’t load inventory: {loadError}</p>}

            <InventoryTable
              rows={list}
              selectedId={selected?.id}
              onSelect={setSel}
              emptyText={loading ? 'LOADING…' : cards.length === 0 ? 'NO RECORDS YET — ADD ONE WITH + NEW ENTRY.' : 'NO RECORDS MATCH.'}
            />
          </section>

          <aside aria-label="Record detail">
            {selected ? (
              <Detail
                card={selected}
                onEdit={() => setModal({ kind: 'edit', card: selected })}
                onSell={() => setModal({ kind: 'sold', card: selected })}
              />
            ) : (
              <p className="empty">NO RECORD SELECTED.</p>
            )}
          </aside>
        </main>
      </div>

      {modal?.kind === 'new' && <CardFormDialog onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.kind === 'edit' && <CardFormDialog card={modal.card} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.kind === 'sold' && <MarkSoldDialog card={modal.card} onClose={() => setModal(null)} onSaved={saved} />}
    </div>
  );
}

