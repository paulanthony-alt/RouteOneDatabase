import { useRef, useState, type FormEvent } from 'react';
import type { DB } from '../types';
import { useStore } from '../store/store';
import { emptyDB, sampleDB } from '../store/local';
import CommitInput from '../components/CommitInput';
import { cashLedger, openCards, total } from '../store/selectors';
import { money, num, shortDate, signed, today } from '../lib/format';

export default function BankrollPage() {
  const { db, dispatch, backend } = useStore();
  const ledger = cashLedger(db);
  const cash = ledger.reduce((s, l) => s + l.amount, 0);
  const sum = (k: string) => ledger.filter((l) => l.kind === k).reduce((s, l) => s + l.amount, 0);
  const inventory = total(openCards(db), (c) => c.market);
  const [adj, setAdj] = useState({ dir: '+', amount: '', note: '', on: today() });
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);

  let running = 0;
  const rows = ledger.map((l) => ({ ...l, balance: (running += l.amount) }));

  const kpis = [
    { label: 'STARTING MONEY', value: money(db.bankroll.starting), note: `Since ${shortDate(db.bankroll.startedOn)}`, c: '' },
    { label: 'SALES IN', value: money(sum('SALE')), note: 'Cash, card and app payments', c: 'gain' },
    { label: 'BUYS OUT', value: money(-sum('BUY')), note: 'Cards paid for from the bankroll', c: sum('BUY') ? 'loss' : '' },
    { label: 'CASH ON HAND', value: money(cash), note: `${signed(cash - db.bankroll.starting)} vs start`, c: cash < 0 ? 'loss' : '' },
    { label: 'TOTAL WORTH', value: money(cash + inventory), note: `Cash + ${money(inventory)} inventory at market`, c: '' },
  ];

  function addAdj(e: FormEvent) {
    e.preventDefault();
    const n = num(adj.amount);
    if (!(n > 0)) return;
    dispatch({ type: 'addAdjustment', on: adj.on, amount: adj.dir === '+' ? n : -n, note: adj.note.trim() || (adj.dir === '+' ? 'Deposit' : 'Withdrawal') });
    setAdj({ ...adj, amount: '', note: '' });
  }

  function exportData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `route-one-ledger-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(f: File) {
    try {
      const next = JSON.parse(await f.text()) as DB;
      if (next.version !== 1 || !Array.isArray(next.cards)) throw new Error('Not a Route One ledger backup.');
      if (!confirm(`Replace ALL current data with ${next.cards.length} records from ${f.name}?`)) return;
      if (await dispatch({ type: 'replace', db: next })) setMsg(`Restored ${next.cards.length} records from ${f.name}.`);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <main>
      <section className="content">
        <div className="title-row">
          <div>
            <h1>BANKROLL</h1>
            <p className="meta">THE MONEY WE STARTED WITH, AND EVERYTHING THAT MOVED IT</p>
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

        <div className="panels">
          <div className="panel">
            <span className="label">STARTING MONEY</span>
            <div className="form-grid">
              <label className="field">
                <span className="label">AMOUNT ($)</span>
                <CommitInput type="number" min={0} step="1" value={db.bankroll.starting ? String(db.bankroll.starting) : ''} placeholder="0"
                  onCommit={(v) => dispatch({ type: 'setBankroll', starting: Math.max(0, num(v) || 0), startedOn: db.bankroll.startedOn })} />
              </label>
              <label className="field">
                <span className="label">AS OF</span>
                <CommitInput type="date" value={db.bankroll.startedOn}
                  onCommit={(v) => v && dispatch({ type: 'setBankroll', starting: db.bankroll.starting, startedOn: v })} />
              </label>
            </div>
            <span className="note">New entries marked “paid out of our money” come out of this; sales go back in. Trades don’t move money.</span>
          </div>

          <div className="panel">
            <span className="label">ADD OR TAKE OUT MONEY</span>
            <form className="form-grid" onSubmit={addAdj}>
              <label className="field">
                <span className="label">TYPE</span>
                <select value={adj.dir} onChange={(e) => setAdj({ ...adj, dir: e.target.value })}>
                  <option value="+">Add money</option>
                  <option value="-">Take out money</option>
                </select>
              </label>
              <label className="field"><span className="label">AMOUNT ($)</span><input type="number" min={0} step="0.01" value={adj.amount} onChange={(e) => setAdj({ ...adj, amount: e.target.value })} /></label>
              <label className="field"><span className="label">DATE</span><input type="date" value={adj.on} onChange={(e) => setAdj({ ...adj, on: e.target.value })} /></label>
              <label className="field"><span className="label">NOTE</span><input value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} placeholder="Partner buy-in" /></label>
              <div className="actions wide"><button type="submit" className="btn btn-ghost">ADD</button></div>
            </form>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead><tr><th>DATE</th><th>ENTRY</th><th>TYPE</th><th className="r">AMOUNT</th><th className="r">BALANCE</th><th /></tr></thead>
            <tbody>
              {rows.map((l, i) => {
                const adjId = l.adjId;
                return (
                  <tr key={i}>
                    <td className="id">{shortDate(l.on)}</td>
                    <td className="ledger-label">{l.label}</td>
                    <td className="grade">{l.kind}</td>
                    <td className={`num r ${l.amount > 0 && l.kind !== 'START' ? 'gain' : l.amount < 0 ? 'loss' : ''}`}>{l.kind === 'START' ? money(l.amount) : signed(l.amount)}</td>
                    <td className="num r">{money(l.balance)}</td>
                    <td>{adjId != null && <button type="button" className="x" aria-label="Remove entry" onClick={() => dispatch({ type: 'removeAdjustment', id: adjId })}>×</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <span className="label">DATA</span>
          <span className="note">{backend === 'local' ? 'Everything is saved in this browser only. Export a backup before show day, or to move to another device.' : 'Everything is saved to the shared Firebase database. Export a backup any time.'}</span>
          <div className="actions">
            <button type="button" className="btn btn-ghost" onClick={exportData}>EXPORT BACKUP</button>
            <button type="button" className="btn btn-ghost" onClick={() => file.current?.click()}>IMPORT BACKUP</button>
            <button type="button" className="btn btn-ghost danger" onClick={() => { if (confirm('Erase every record and start empty? Export a backup first if you need it.')) dispatch({ type: 'replace', db: emptyDB() }); }}>
              ERASE ALL RECORDS
            </button>
            {backend === 'local' && (
              <button type="button" className="btn btn-ghost" onClick={() => { if (confirm('Replace everything with the sample data?')) dispatch({ type: 'replace', db: sampleDB() }); }}>
                LOAD SAMPLE DATA
              </button>
            )}
            <input ref={file} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importData(f); e.target.value = ''; }} />
          </div>
          {msg && <span className="note" role="status">{msg}</span>}
        </div>
      </section>
    </main>
  );
}
