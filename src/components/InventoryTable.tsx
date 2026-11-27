import type { Card } from '../types';
import { money, pct, tone } from '../lib/format';

interface Props {
  rows: Card[];
  selectedId?: string;
  onSelect: (id: string) => void;
  emptyText: string;
}

export default function InventoryTable({ rows, selectedId, onSelect, emptyText }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th><th>CARD</th><th>GRADE</th><th className="r">QTY</th><th className="r">COST</th>
            <th className="r">MARKET</th><th className="r">SPREAD</th><th>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className={c.id === selectedId ? 'selected' : ''}>
              <td className="id">{c.id}</td>
              <td className="card">
                <button type="button" className="card-btn" onClick={() => onSelect(c.id)} aria-pressed={c.id === selectedId}>
                  <span className="name">{c.name}</span>
                  <span className="set">{[c.set_name, c.card_no].filter(Boolean).join(' · ')}</span>
                </button>
              </td>
              <td className="grade">{c.grade}</td>
              <td className="num r">{c.qty}</td>
              <td className="num r cost">{money(c.cost)}</td>
              <td className="num r">{money(c.market)}</td>
              <td className={`num r ${tone(c.cost, c.market)}`}>{pct(c.cost, c.market)}</td>
              <td><span className={`chip chip-${c.status.toLowerCase()}`}>{c.status.toUpperCase()}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty">{emptyText}</p>}
    </div>
  );
}
