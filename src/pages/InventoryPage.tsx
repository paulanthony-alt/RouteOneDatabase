import { useMemo, useState } from 'react';
import type { Card } from '../types';
import { useStore } from '../store/store';
import { cashOnHand, openCards, soldCards, total, units } from '../store/selectors';
import { money, pct, signed, tone } from '../lib/format';
import InventoryTable from '../components/InventoryTable';
import Detail from '../components/Detail';

type Filter = 'ALL' | 'HELD' | 'LISTED' | 'SOLD';

interface Props {
  q: string;
  sel: string | null;
  onSelect: (id: string) => void;
  onEdit: (c: Card) => void;
  onSell: (c: Card) => void;
}

export default function InventoryPage({ q, sel, onSelect, onEdit, onSell }: Props) {
  const { db } = useStore();
  const [filter, setFilter] = useState<Filter>('ALL');
  const cards = db.cards;

  const ql = q.trim().toLowerCase();
  const match = useMemo(
    () => cards.filter((c) => !ql || [c.name, c.setName, c.cardNo, c.grade, c.id, c.game, c.sale?.buyer ?? ''].join(' ').toLowerCase().includes(ql)),
    [cards, ql],
  );
  const list = filter === 'ALL' ? match : match.filter((c) => c.status.toUpperCase() === filter);
  const open = openCards(db);
  const sold = soldCards(db);
  const mv = total(open, (c) => c.market);
  const cb = total(open, (c) => c.cost);
  const rz = total(sold, (c) => c.sale!.price - c.cost);
  const cash = cashOnHand(db);
  const selected = cards.find((c) => c.id === sel) ?? list[0] ?? cards[0] ?? null;

  const kpis = [
    { label: 'CASH ON HAND', value: money(cash), note: `Started with ${money(db.bankroll.starting)}`, c: cash < 0 ? 'loss' : '', href: '#bankroll' },
    { label: 'ON HAND · MARKET', value: money(mv), note: `${units(open)} units held or listed`, c: '' },
    { label: 'COST BASIS', value: money(cb), note: 'What it took to get here', c: '' },
    { label: 'UNREALIZED', value: signed(mv - cb), note: `${pct(cb, mv)} over cost`, c: tone(cb, mv) },
    { label: 'REALIZED', value: signed(rz), note: `${sold.length} sales closed`, c: rz >= 0 ? 'gain' : 'loss' },
  ];

  return (
    <main id="inventory">
      <section className="content">
        <div className="title-row">
          <div>
            <h1>INVENTORY</h1>
            <p className="meta">{list.length} OF {cards.length} RECORDS · TOTAL WORTH {money(cash + mv)} (CASH + MARKET)</p>
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
          {kpis.map((k) => {
            const body = (
              <>
                <span className="label">{k.label}</span>
                <span className={`value ${k.c}`}>{k.value}</span>
                <span className="note">{k.note}</span>
              </>
            );
            return k.href ? <a className="kpi" key={k.label} href={k.href}>{body}</a> : <div className="kpi" key={k.label}>{body}</div>;
          })}
        </div>

        <InventoryTable
          rows={list}
          selectedId={selected?.id}
          onSelect={onSelect}
          emptyText={cards.length === 0 ? 'NO RECORDS YET — ADD ONE WITH + NEW ENTRY.' : 'NO RECORDS MATCH.'}
        />
      </section>

      <aside aria-label="Record detail">
        {selected ? (
          <Detail card={selected} onEdit={() => onEdit(selected)} onSell={() => onSell(selected)} />
        ) : (
          <p className="empty">NO RECORD SELECTED.</p>
        )}
      </aside>
    </main>
  );
}
