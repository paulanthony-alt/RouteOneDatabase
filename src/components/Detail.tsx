import { useState } from 'react';
import type { Card } from '../types';
import { useStore } from '../store/store';
import { ebaySoldUrl, estimateCard } from '../lib/estimate';
import { cents, money, pct, shortDate, tone } from '../lib/format';

interface Props {
  card: Card;
  onEdit: () => void;
  onSell: () => void;
}

export default function Detail({ card: c, onEdit, onSell }: Props) {
  const { db, dispatch } = useStore();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const sold = c.status === 'Sold';
  const value = sold && c.sale ? c.sale.price : c.market;
  const mx = Math.max(c.cost, value) || 1;
  const show = (id: string | null | undefined) => db.shows.find((s) => s.id === id)?.name;

  async function estimate() {
    setBusy(true);
    setMsg('');
    try {
      const e = await estimateCard(db, c);
      if (e) await dispatch({ type: 'setEstimate', id: c.id, estimate: e });
      else setMsg('No automatic price for this card yet.');
    } catch (e) {
      setMsg((e as Error).message);
    }
    setBusy(false);
  }

  const est = c.estimate;
  return (
    <>
      <span className="label">RECORD · {c.id}</span>
      <div>
        <h2>{c.name}</h2>
        <p className="sub">{[c.setName, c.cardNo, c.game].filter(Boolean).join(' · ')}</p>
      </div>
      <div className="scan">[CARD SCAN]</div>
      <div className="facts">
        <div className="fact"><span className="label">GRADE</span><span className="big">{c.grade || '—'}</span></div>
        <div className="fact"><span className="label">LOCATION</span><span className="big">{c.location || '—'}</span></div>
        <div className="fact"><span className="label">COST / UNIT</span><span className="money">{money(c.cost)}</span></div>
        {sold ? (
          <div className="fact"><span className="label">SOLD / UNIT</span><span className="money">{money(value)}</span></div>
        ) : (
          <div className="fact"><span className="label">MARKET / UNIT</span><span className="money">{money(c.market)}</span></div>
        )}
        {sold && c.sale && (
          <>
            <div className="fact"><span className="label">PAYMENT</span><span className="big">{c.sale.payment}</span></div>
            <div className="fact"><span className="label">BUYER</span><span className="big">{c.sale.buyer || '—'}</span></div>
          </>
        )}
      </div>
      <div className="bars">
        <div className="bars-head label">
          <span>COST vs {sold ? 'SALE' : 'MARKET'}</span>
          <span className={tone(c.cost, value)}>{pct(c.cost, value)}</span>
        </div>
        <div className="track"><div className="fill cost" style={{ width: `${(c.cost / mx) * 100}%` }} /></div>
        <div className="track"><div className="fill mkt" style={{ width: `${(value / mx) * 100}%` }} /></div>
      </div>

      {!sold && (
        <div className="estimate">
          <div className="bars-head">
            <span className="label">AUTO ESTIMATE</span>
            <button type="button" className="link" onClick={estimate} disabled={busy}>{busy ? 'CHECKING…' : est ? 'RE-CHECK' : 'ESTIMATE NOW'}</button>
          </div>
          {est ? (
            <>
              <div className="est-value">
                <span className="money">{cents(est.value)}</span>
                <span className={tone(c.market, est.value)}>{pct(c.market, est.value)} vs market</span>
              </div>
              <span className="note">
                {est.source} · {shortDate(est.at.slice(0, 10))}
                {est.url && <> · <a href={est.url} target="_blank" rel="noreferrer">source</a></>}
              </span>
              {Math.round(est.value * 100) / 100 !== c.market && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: 'applyEstimate', id: c.id })}>
                  USE AS MARKET
                </button>
              )}
            </>
          ) : (
            <span className="note">{msg || 'Not checked yet.'}</span>
          )}
          {est && msg && <span className="note loss">{msg}</span>}
          <a className="note" href={ebaySoldUrl(c)} target="_blank" rel="noreferrer">Check eBay sold listings ↗</a>
        </div>
      )}

      <div className="log">
        <span className="label">CHAIN OF CUSTODY</span>
        {c.acquiredShowId && <div className="log-row"><span className="date">SHOW</span><span className="note">Bought at {show(c.acquiredShowId)}</span></div>}
        {c.events.map((l) => (
          <div className="log-row" key={l.id}>
            <span className="date">{shortDate(l.on)}</span>
            <span className="log-text">
              <span className="ev">{l.event}</span>
              {l.note && <span className="note">{l.note}</span>}
            </span>
          </div>
        ))}
      </div>
      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={onEdit}>EDIT RECORD</button>
        <button type="button" className="btn btn-solid" onClick={onSell} disabled={sold}>{sold ? 'SOLD' : 'MARK SOLD'}</button>
      </div>
    </>
  );
}
