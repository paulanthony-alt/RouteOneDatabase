import type { Card } from '../types';
import { money, pct, shortDate, tone } from '../lib/format';

interface Props {
  card: Card;
  onEdit: () => void;
  onSell: () => void;
}

export default function Detail({ card: c, onEdit, onSell }: Props) {
  const sold = c.status === 'Sold';
  const value = sold && c.sold_price != null ? c.sold_price : c.market;
  const mx = Math.max(c.cost, value) || 1;

  return (
    <>
      <span className="label">RECORD · {c.id}</span>
      <div>
        <h2>{c.name}</h2>
        <p className="sub">{[c.set_name, c.card_no, c.game].filter(Boolean).join(' · ')}</p>
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
      </div>
      <div className="bars">
        <div className="bars-head label">
          <span>COST vs {sold ? 'SALE' : 'MARKET'}</span>
          <span className={tone(c.cost, value)}>{pct(c.cost, value)}</span>
        </div>
        <div className="track"><div className="fill cost" style={{ width: `${(c.cost / mx) * 100}%` }} /></div>
        <div className="track"><div className="fill mkt" style={{ width: `${(value / mx) * 100}%` }} /></div>
      </div>
      <div className="log">
        <span className="label">CHAIN OF CUSTODY</span>
        {c.card_events.map((l) => (
          <div className="log-row" key={l.id}>
            <span className="date">{shortDate(l.occurred_on)}</span>
            <span className="log-text">
              <span className="ev">{l.event}</span>
              {l.note && <span className="note">{l.note}</span>}
            </span>
          </div>
        ))}
      </div>
      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={onEdit}>EDIT RECORD</button>
        <button type="button" className="btn btn-solid" onClick={onSell} disabled={sold}>
          {sold ? 'SOLD' : 'MARK SOLD'}
        </button>
      </div>
    </>
  );
}
