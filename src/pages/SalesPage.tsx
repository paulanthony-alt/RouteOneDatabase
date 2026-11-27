import { useState } from 'react';
import { useStore } from '../store/store';
import { soldCards, total, units } from '../store/selectors';
import { money, pct, rate, shortDate, signed, tone } from '../lib/format';

export default function SalesPage({ q, onOpen }: { q: string; onOpen: (id: string) => void }) {
  const { db } = useStore();
  const [showId, setShowId] = useState('ALL');
  const ql = q.trim().toLowerCase();

  const all = soldCards(db).sort((a, b) => b.sale!.on.localeCompare(a.sale!.on) || b.sale!.at.localeCompare(a.sale!.at));
  const list = all
    .filter((c) => showId === 'ALL' || (showId === 'NONE' ? !c.sale!.showId : c.sale!.showId === showId))
    .filter((c) => !ql || [c.name, c.setName, c.grade, c.id, c.sale!.buyer, c.sale!.payment].join(' ').toLowerCase().includes(ql));

  const gross = total(list, (c) => c.sale!.price);
  const cogs = total(list, (c) => c.cost);
  const profit = gross - cogs;
  const buyers = new Set(list.map((c) => c.sale!.buyer.trim().toLowerCase()).filter(Boolean));
  const showName = (id: string | null) => db.shows.find((s) => s.id === id)?.name ?? '—';

  const kpis = [
    { label: 'GROSS SALES', value: money(gross), note: `${units(list)} units · ${list.length} sales`, c: '' },
    { label: 'COST OF GOODS', value: money(cogs), note: 'What the sold cards cost us', c: '' },
    { label: 'PROFIT', value: signed(profit), note: `${rate(profit, gross)} margin`, c: profit >= 0 ? 'gain' : 'loss' },
    { label: 'BUYERS', value: String(buyers.size), note: 'Named buyers in view', c: '' },
  ];

  return (
    <main>
      <section className="content">
        <div className="title-row">
          <div>
            <h1>SALES</h1>
            <p className="meta">{list.length} OF {all.length} SALES</p>
          </div>
          <label className="field inline">
            <span className="label">SHOW</span>
            <select value={showId} onChange={(e) => setShowId(e.target.value)}>
              <option value="ALL">All sales</option>
              <option value="NONE">Not at a show</option>
              {db.shows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
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

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>DATE</th><th>CARD</th><th className="r">QTY</th><th className="r">PRICE</th><th className="r">COST</th>
                <th className="r">PROFIT</th><th>PAYMENT</th><th>BUYER</th><th>SHOW</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => {
                const p = (c.sale!.price - c.cost) * c.qty;
                return (
                  <tr key={c.id}>
                    <td className="id">{shortDate(c.sale!.on)}</td>
                    <td className="card">
                      <button type="button" className="card-btn" onClick={() => onOpen(c.id)}>
                        <span className="name">{c.name}</span>
                        <span className="set">{c.id} · {c.grade}</span>
                      </button>
                    </td>
                    <td className="num r">{c.qty}</td>
                    <td className="num r">{money(c.sale!.price)}</td>
                    <td className="num r cost">{money(c.cost)}</td>
                    <td className={`num r ${tone(c.cost, c.sale!.price)}`}>{signed(p)} <span className="muted">{pct(c.cost, c.sale!.price)}</span></td>
                    <td className="grade">{c.sale!.payment.toUpperCase()}</td>
                    <td>{c.sale!.buyer || <span className="muted">—</span>}</td>
                    <td className="set-cell">{showName(c.sale!.showId)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length === 0 && <p className="empty">NO SALES MATCH.</p>}
        </div>
      </section>
    </main>
  );
}
