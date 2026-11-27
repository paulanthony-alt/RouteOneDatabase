import { useState, type FormEvent } from 'react';
import type { Show } from '../types';
import { useStore } from '../store/store';
import { nextShow, showStats } from '../store/selectors';
import { daysUntil, longDate, money, num, rate, signed, tone } from '../lib/format';

interface Props {
  onSell: (showId: string) => void;
  onBuy: (showId: string) => void;
}

export default function ShowsPage({ onSell, onBuy }: Props) {
  const { db } = useStore();
  const shows = [...db.shows].sort((a, b) => a.date.localeCompare(b.date));
  const [id, setId] = useState(nextShow(db)?.id ?? '');
  const [adding, setAdding] = useState(db.shows.length === 0);
  const show = db.shows.find((s) => s.id === id);

  return (
    <main>
      <section className="content">
        <div className="title-row">
          <div>
            <h1>SHOWS</h1>
            <p className="meta">{shows.length} SHOW{shows.length === 1 ? '' : 'S'} · SALES, PROFIT AND RETENTION PER SHOW</p>
          </div>
          <div className="filters">
            {shows.map((s) => (
              <button key={s.id} type="button" aria-pressed={!adding && s.id === id} onClick={() => { setId(s.id); setAdding(false); }}>
                {s.date.slice(5).replace('-', '/')} <span className="n">{s.name.split(' ').slice(0, 2).join(' ').toUpperCase()}</span>
              </button>
            ))}
            <button type="button" aria-pressed={adding} onClick={() => setAdding(true)}>+ SHOW</button>
          </div>
        </div>

        {adding ? (
          <NewShow onDone={(newId) => { if (newId) setId(newId); setAdding(false); }} />
        ) : show ? (
          <ShowDashboard show={show} onSell={() => onSell(show.id)} onBuy={() => onBuy(show.id)} />
        ) : (
          <p className="empty">NO SHOWS YET.</p>
        )}
      </section>
    </main>
  );
}

function NewShow({ onDone }: { onDone: (id?: string) => void }) {
  const { db, dispatch } = useStore();
  const [f, setF] = useState({ name: '', date: '', hours: '', venue: '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.name.trim() || !f.date) return;
    dispatch({ type: 'addShow', show: { ...f, name: f.name.trim(), float: 0 } });
    onDone('show-' + db.nextId);
  }
  return (
    <form className="panel form-grid" onSubmit={submit}>
      <span className="label wide">NEW SHOW</span>
      <label className="field wide"><span className="label">NAME</span><input required value={f.name} onChange={set('name')} /></label>
      <label className="field"><span className="label">DATE</span><input type="date" required value={f.date} onChange={set('date')} /></label>
      <label className="field"><span className="label">HOURS</span><input value={f.hours} onChange={set('hours')} placeholder="9A–3P" /></label>
      <label className="field wide"><span className="label">VENUE</span><input value={f.venue} onChange={set('venue')} placeholder="Street, Town ST" /></label>
      <div className="actions wide">
        {db.shows.length > 0 && <button type="button" className="btn btn-ghost" onClick={() => onDone()}>CANCEL</button>}
        <button type="submit" className="btn btn-accent">ADD SHOW</button>
      </div>
    </form>
  );
}

function ShowDashboard({ show, onSell, onBuy }: { show: Show; onSell: () => void; onBuy: () => void }) {
  const { db, dispatch } = useStore();
  const s = showStats(db, show);
  const days = daysUntil(show.date);
  const [editing, setEditing] = useState(false);
  const [line, setLine] = useState({ kind: 'expense' as 'income' | 'expense', label: '', amount: '' });

  const money5 = [
    { label: 'GROSS SALES', value: money(s.gross), note: `${s.soldUnits} units · ${s.sales.length} sales`, c: '' },
    { label: 'CARD PROFIT', value: signed(s.cardProfit), note: `${rate(s.cardProfit, s.gross)} margin on ${money(s.cogs)} cost`, c: s.cardProfit >= 0 ? 'gain' : 'loss' },
    { label: 'OTHER INCOME', value: money(s.income), note: 'Tables, admission, etc.', c: '' },
    { label: 'EXPENSES', value: money(s.expenses), note: 'Venue, supplies, etc.', c: s.expenses ? 'loss' : '' },
    { label: 'NET PROFIT', value: signed(s.net), note: 'Card profit + income − expenses', c: s.net >= 0 ? 'gain' : 'loss' },
  ];

  function addLine(e: FormEvent) {
    e.preventDefault();
    const amount = num(line.amount);
    if (!line.label.trim() || !(amount >= 0)) return;
    dispatch({ type: 'addShowLine', id: show.id, line: { kind: line.kind, label: line.label.trim(), amount } });
    setLine({ ...line, label: '', amount: '' });
  }

  return (
    <>
      <div className="show-head">
        <div>
          <span className="label">{days > 0 ? `IN ${days} DAY${days === 1 ? '' : 'S'}` : days === 0 ? 'TODAY' : `${-days} DAYS AGO`}</span>
          <h2>{show.name}</h2>
          <p className="sub">{longDate(show.date)}{show.hours && ` · ${show.hours}`}{show.venue && ` · ${show.venue}`}</p>
          <button type="button" className="link" onClick={() => setEditing((v) => !v)}>{editing ? 'DONE' : 'EDIT DETAILS'}</button>
        </div>
        <div className="actions">
          <button type="button" className="btn btn-accent" onClick={onSell}>RECORD SALE</button>
          <button type="button" className="btn btn-ghost" onClick={onBuy}>LOG A BUY</button>
        </div>
      </div>

      {editing && (
        <div className="panel form-grid">
          {(['name', 'date', 'hours', 'venue'] as const).map((k) => (
            <label key={k} className={'field' + (k === 'name' || k === 'venue' ? ' wide' : '')}>
              <span className="label">{k.toUpperCase()}</span>
              <input type={k === 'date' ? 'date' : 'text'} value={show[k]} onChange={(e) => dispatch({ type: 'updateShow', id: show.id, patch: { [k]: e.target.value } })} />
            </label>
          ))}
        </div>
      )}

      <div className="kpis">
        {money5.map((k) => (
          <div className="kpi" key={k.label}>
            <span className="label">{k.label}</span>
            <span className={`value ${k.c}`}>{k.value}</span>
            <span className="note">{k.note}</span>
          </div>
        ))}
      </div>

      <div className="panels">
        <div className="panel">
          <span className="label">RETENTION</span>

          <div className="ret-block">
            <div className="bars-head"><span className="sub-h">DOOR COUNT</span><span className="mono">{s.visitors} VISITORS</span></div>
            <div className="counter-row">
              {(['new', 'returning'] as const).map((who) => (
                <div className="counter" key={who}>
                  <span className="label">{who.toUpperCase()}</span>
                  <span className="big-num">{show.attendance[who]}</span>
                  <div className="counter-btns">
                    <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove one ${who} visitor`} onClick={() => dispatch({ type: 'count', id: show.id, who, delta: -1 })}>−</button>
                    <button type="button" className="btn btn-solid btn-sm" aria-label={`Add one ${who} visitor`} onClick={() => dispatch({ type: 'count', id: show.id, who, delta: 1 })}>+1</button>
                  </div>
                </div>
              ))}
            </div>
            <Meter label="RETURNING VISITORS" part={s.returningVisitors} whole={s.visitors} />
          </div>

          <div className="ret-block">
            <Meter label="REPEAT BUYERS" part={s.repeatBuyers} whole={s.buyers} note={`${s.repeatBuyers} of ${s.buyers} named buyers had bought from us before`} />
          </div>

          <div className="ret-block">
            <Meter
              label="SELL-THROUGH"
              part={s.soldUnits}
              whole={s.broughtUnits}
              note={`${s.soldUnits} of ${s.broughtUnits} listed units sold · ${s.keptUnits} went home`}
            />
            {show.opening ? (
              <span className="note">Opened {new Date(show.opening.at).toLocaleString()} with {show.opening.units} listed units worth {money(show.opening.value)}.</span>
            ) : (
              <button type="button" className="link" onClick={() => dispatch({ type: 'openShow', id: show.id })}>
                OPEN SHOW — SNAPSHOT LISTED INVENTORY NOW
              </button>
            )}
          </div>
        </div>

        <div className="panel">
          <span className="label">CASH DRAWER</span>
          <label className="field">
            <span className="label">STARTING FLOAT ($)</span>
            <input type="number" min={0} step="1" value={show.float || ''} placeholder="0"
              onChange={(e) => dispatch({ type: 'updateShow', id: show.id, patch: { float: Math.max(0, num(e.target.value) || 0) } })} />
          </label>
          <dl className="sum-list">
            <div><dt>Float</dt><dd>{money(show.float)}</dd></div>
            <div><dt>+ Cash sales</dt><dd className="gain">{money(s.cashSales)}</dd></div>
            <div><dt>− Cards bought ({s.buys.length})</dt><dd className="loss">{money(s.spent)}</dd></div>
            <div className="total"><dt>Expected in drawer</dt><dd>{money(s.drawer)}</dd></div>
          </dl>
          <span className="note">Card, Venmo/Zelle and trade sales aren’t in the drawer.</span>

          <span className="label section-gap">INCOME &amp; EXPENSES</span>
          {show.lines.length === 0 && <span className="note">Add vendor table fees, admission, venue rental, supplies…</span>}
          <dl className="sum-list">
            {show.lines.map((l) => (
              <div key={l.id}>
                <dt>{l.label}</dt>
                <dd className={l.kind === 'income' ? 'gain' : 'loss'}>
                  {l.kind === 'income' ? '+' : '−'}{money(l.amount)}
                  <button type="button" className="x" aria-label={`Remove ${l.label}`} onClick={() => dispatch({ type: 'removeShowLine', id: show.id, lineId: l.id })}>×</button>
                </dd>
              </div>
            ))}
          </dl>
          <form className="line-form" onSubmit={addLine}>
            <select value={line.kind} onChange={(e) => setLine({ ...line, kind: e.target.value as 'income' | 'expense' })} aria-label="Type">
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <input placeholder="Vendor table fees" value={line.label} onChange={(e) => setLine({ ...line, label: e.target.value })} aria-label="Label" />
            <input type="number" min={0} step="0.01" placeholder="$" value={line.amount} onChange={(e) => setLine({ ...line, amount: e.target.value })} aria-label="Amount" />
            <button type="submit" className="btn btn-ghost btn-sm">ADD</button>
          </form>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>TIME</th><th>CARD</th><th className="r">QTY</th><th className="r">PRICE</th><th className="r">PROFIT</th><th>PAYMENT</th><th>BUYER</th></tr>
          </thead>
          <tbody>
            {s.sales.map((c) => (
              <tr key={c.id}>
                <td className="id">{new Date(c.sale!.at).toTimeString().slice(0, 5)}</td>
                <td className="card"><div className="card-btn"><span className="name">{c.name}</span><span className="set">{c.id} · {c.grade}</span></div></td>
                <td className="num r">{c.qty}</td>
                <td className="num r">{money(c.sale!.price * c.qty)}</td>
                <td className={`num r ${tone(c.cost, c.sale!.price)}`}>{signed((c.sale!.price - c.cost) * c.qty)}</td>
                <td className="grade">{c.sale!.payment.toUpperCase()}</td>
                <td>{c.sale!.buyer || <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {s.sales.length === 0 && <p className="empty">NO SALES AT THIS SHOW YET — USE RECORD SALE.</p>}
      </div>
    </>
  );
}

function Meter({ label, part, whole, note }: { label: string; part: number; whole: number; note?: string }) {
  return (
    <div className="bars">
      <div className="bars-head"><span className="sub-h">{label}</span><span className="mono">{rate(part, whole)}</span></div>
      <div className="track"><div className="fill mkt" style={{ width: whole ? `${(part / whole) * 100}%` : 0 }} /></div>
      {note && <span className="note">{note}</span>}
    </div>
  );
}
