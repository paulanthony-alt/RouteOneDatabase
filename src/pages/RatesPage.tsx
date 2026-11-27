import { useState, type FormEvent } from 'react';
import { useStore } from '../store/store';
import { openCards } from '../store/selectors';
import { estimateCard } from '../lib/estimate';
import { cents, money, num, pct, shortDate, tone } from '../lib/format';

export default function RatesPage({ onOpen }: { onOpen: (id: string) => void }) {
  const { db, dispatch } = useStore();
  const cards = openCards(db);
  const [run, setRun] = useState<{ done: number; total: number; failed: string[] } | null>(null);
  const [grade, setGrade] = useState({ name: '', value: '' });
  const running = run != null && run.done < run.total;

  async function estimateAll() {
    const failed: string[] = [];
    setRun({ done: 0, total: cards.length, failed });
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      try {
        const e = await estimateCard(db, c);
        if (e) dispatch({ type: 'setEstimate', id: c.id, estimate: e });
        else failed.push(`${c.id} no price found`);
      } catch (err) {
        failed.push(`${c.id} ${(err as Error).message}`);
      }
      setRun({ done: i + 1, total: cards.length, failed: [...failed] });
    }
  }

  const pending = cards.filter((c) => c.estimate && Math.round(c.estimate.value * 100) / 100 !== c.market);

  function addGrade(e: FormEvent) {
    e.preventDefault();
    const v = num(grade.value);
    if (!grade.name.trim() || !(v > 0)) return;
    dispatch({ type: 'setMultiplier', grade: grade.name.trim().toUpperCase(), value: v });
    setGrade({ name: '', value: '' });
  }

  return (
    <main>
      <section className="content">
        <div className="title-row">
          <div>
            <h1>MARKET RATES</h1>
            <p className="meta">AUTO ESTIMATES FOR {cards.length} CARDS ON HAND · POKÉMON VIA TCGPLAYER, OTHERS FROM OUR OWN SALES</p>
          </div>
          <div className="actions">
            <button type="button" className="btn btn-accent" onClick={estimateAll} disabled={running || !cards.length}>
              {running ? `CHECKING ${run!.done}/${run!.total}…` : 'ESTIMATE ALL'}
            </button>
            <button type="button" className="btn btn-ghost" disabled={!pending.length}
              onClick={() => pending.forEach((c) => dispatch({ type: 'applyEstimate', id: c.id }))}>
              APPLY ALL ({pending.length})
            </button>
          </div>
        </div>

        {run && !running && run.failed.length > 0 && (
          <p className="note-box">No automatic price for {run.failed.length}: {run.failed.join(' · ')}. Use the eBay link on the record, or set the market by hand.</p>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>CARD</th><th>GRADE</th><th className="r">MARKET</th><th className="r">ESTIMATE</th><th className="r">CHANGE</th><th>SOURCE</th><th /></tr>
            </thead>
            <tbody>
              {cards.map((c) => {
                const e = c.estimate;
                const differs = e && Math.round(e.value * 100) / 100 !== c.market;
                return (
                  <tr key={c.id}>
                    <td className="id">{c.id}</td>
                    <td className="card">
                      <button type="button" className="card-btn" onClick={() => onOpen(c.id)}>
                        <span className="name">{c.name}</span>
                        <span className="set">{[c.setName, c.cardNo].filter(Boolean).join(' · ')}</span>
                      </button>
                    </td>
                    <td className="grade">{c.grade}</td>
                    <td className="num r">{money(c.market)}</td>
                    <td className="num r">{e ? cents(e.value) : <span className="muted">—</span>}</td>
                    <td className={`num r ${e ? tone(c.market, e.value) : ''}`}>{e ? pct(c.market, e.value) : ''}</td>
                    <td className="src">{e ? <>{e.source}<br /><span className="muted">{shortDate(e.at.slice(0, 10))}</span></> : <span className="muted">Not checked</span>}</td>
                    <td>{differs && <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'applyEstimate', id: c.id })}>APPLY</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {cards.length === 0 && <p className="empty">NO CARDS ON HAND.</p>}
        </div>

        <div className="panels">
          <div className="panel">
            <span className="label">GRADE MULTIPLIERS</span>
            <span className="note">Graded value = ungraded TCGplayer market × multiplier. Tune these to what your graded comps actually sell for.</span>
            <div className="mult-grid">
              {Object.entries(db.settings.multipliers).map(([g, v]) => (
                <label key={g} className="field">
                  <span className="label">{g}</span>
                  <span className="input-row">
                    <input type="number" min={0} step="0.05" value={v}
                      onChange={(e) => { const n = num(e.target.value); if (n >= 0) dispatch({ type: 'setMultiplier', grade: g, value: n }); }} />
                    <button type="button" className="x" aria-label={`Remove ${g}`} onClick={() => dispatch({ type: 'removeMultiplier', grade: g })}>×</button>
                  </span>
                </label>
              ))}
            </div>
            <form className="line-form" onSubmit={addGrade}>
              <input placeholder="Grade, e.g. TAG 10" value={grade.name} onChange={(e) => setGrade({ ...grade, name: e.target.value })} aria-label="Grade" />
              <input type="number" min={0} step="0.05" placeholder="×" value={grade.value} onChange={(e) => setGrade({ ...grade, value: e.target.value })} aria-label="Multiplier" />
              <button type="submit" className="btn btn-ghost btn-sm">ADD GRADE</button>
            </form>
          </div>
          <div className="panel">
            <span className="label">PRICE SOURCE</span>
            <span className="note">
              Pokémon singles use the free Pokémon TCG API (pokemontcg.io), which carries TCGplayer market prices. It works without a key;
              a free key from dev.pokemontcg.io raises the daily limit. Sports cards and sealed product fall back to the average of our own sales
              of the same card and grade.
            </span>
            <label className="field">
              <span className="label">POKÉMON TCG API KEY (OPTIONAL)</span>
              <input type="password" autoComplete="off" value={db.settings.pokemonApiKey} onChange={(e) => dispatch({ type: 'setApiKey', key: e.target.value.trim() })} />
            </label>
          </div>
        </div>
      </section>
    </main>
  );
}
