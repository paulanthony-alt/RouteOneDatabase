import { useState } from 'react';
import type { Card } from '../types';
import { markSold } from '../lib/api';
import { money, pct, signed, today, tone } from '../lib/format';
import Dialog, { Field } from './Dialog';

interface Props {
  card: Card;
  onClose: () => void;
  onSaved: (id: string) => void;
}

export default function MarkSoldDialog({ card, onClose, onSaved }: Props) {
  const [qty, setQty] = useState(String(card.qty));
  const [price, setPrice] = useState(String(card.market));
  const [on, setOn] = useState(today());
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const q = Number(qty), p = Number(price);
  const valid = Number.isInteger(q) && q >= 1 && q <= card.qty && price !== '' && p >= 0;

  async function submit() {
    if (!Number.isInteger(q) || q < 1 || q > card.qty) return setError(`Quantity must be between 1 and ${card.qty}.`);
    if (price === '' || !(p >= 0)) return setError('Enter a sale price of $0 or more.');
    setBusy(true);
    setError('');
    try {
      const sold = await markSold(card.id, { qty: q, price: p, on, note: note.trim() });
      onSaved(sold.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog label={`MARK SOLD · ${card.id}`} title={card.name} submitLabel="CONFIRM SALE" busy={busy} error={error} onSubmit={submit} onClose={onClose}>
      <Field label={`QTY SOLD (OF ${card.qty})`}>
        <input type="number" min={1} max={card.qty} step={1} required value={qty} onChange={(e) => setQty(e.target.value)} autoFocus />
      </Field>
      <Field label="PRICE / UNIT ($)"><input type="number" min={0} step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
      <Field label="SOLD ON"><input type="date" required value={on} onChange={(e) => setOn(e.target.value)} /></Field>
      <Field label="VENUE / NOTE"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Holiday Show — cash" /></Field>
      {valid && (
        <div className="field wide sale-sum">
          <span className="label">PROCEEDS</span>
          <span className="mono">
            {money(q * p)} · <span className={tone(card.cost, p)}>{signed((p - card.cost) * q)} ({pct(card.cost, p)})</span>
            {q < card.qty && <span className="muted"> · {card.qty - q} stay on {card.id}</span>}
          </span>
        </div>
      )}
    </Dialog>
  );
}
