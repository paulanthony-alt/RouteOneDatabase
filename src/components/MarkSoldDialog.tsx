import { useState } from 'react';
import type { Card, Payment } from '../types';
import { PAYMENTS } from '../types';
import { useStore } from '../store/store';
import { money, num, pct, signed, today, tone } from '../lib/format';
import Dialog, { Field } from './Dialog';

interface Props {
  card?: Card; // omitted → pick a card in the dialog (show-day quick sale)
  defaultShowId?: string | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}

export default function MarkSoldDialog({ card: given, defaultShowId, onClose, onSaved }: Props) {
  const { db, dispatch } = useStore();
  const forSale = db.cards.filter((c) => c.status !== 'Sold').sort((a, b) => a.name.localeCompare(b.name));
  const [cardId, setCardId] = useState(given?.id ?? '');
  const card = given ?? db.cards.find((c) => c.id === cardId);
  const todayShow = db.shows.find((s) => s.date === today())?.id ?? '';

  const [qty, setQty] = useState(given ? String(given.qty) : '1');
  const [price, setPrice] = useState(given ? String(given.market) : '');
  const [on, setOn] = useState(today());
  const [payment, setPayment] = useState<Payment>('Cash');
  const [buyer, setBuyer] = useState('');
  const [showId, setShowId] = useState(defaultShowId ?? todayShow);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const q = num(qty), p = num(price);
  const valid = card && Number.isInteger(q) && q >= 1 && q <= card.qty && p >= 0;
  const buyers = [...new Set(db.cards.map((c) => c.sale?.buyer).filter(Boolean) as string[])];

  function pick(id: string) {
    setCardId(id);
    const c = db.cards.find((x) => x.id === id);
    if (c) { setPrice(String(c.market)); setQty('1'); }
  }

  function submit() {
    if (!card) return setError('Pick a card.');
    if (!Number.isInteger(q) || q < 1 || q > card.qty) return setError(`Quantity must be between 1 and ${card.qty}.`);
    if (!(p >= 0)) return setError('Enter a sale price of $0 or more.');
    const soldId = q === card.qty ? card.id : 'R1-' + String(db.nextCard).padStart(4, '0');
    dispatch({ type: 'sellCard', id: card.id, qty: q, price: p, on, note: note.trim(), payment, buyer, showId: showId || null });
    onSaved(soldId);
  }

  return (
    <Dialog
      label={card ? `MARK SOLD · ${card.id}` : 'RECORD SALE'}
      title={given ? given.name : 'Record a sale'}
      submitLabel="CONFIRM SALE"
      busy={false}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    >
      {!given && (
        <Field label="CARD" wide>
          <select value={cardId} onChange={(e) => pick(e.target.value)} autoFocus required>
            <option value="">Choose from inventory…</option>
            {forSale.map((c) => (
              <option key={c.id} value={c.id}>{c.name} · {c.grade} · {c.id} ({c.qty} on hand, {money(c.market)})</option>
            ))}
          </select>
        </Field>
      )}
      <Field label={`QTY SOLD${card ? ` (OF ${card.qty})` : ''}`}>
        <input type="number" min={1} max={card?.qty} step={1} required value={qty} onChange={(e) => setQty(e.target.value)} autoFocus={Boolean(given)} />
      </Field>
      <Field label="PRICE / UNIT ($)"><input type="number" min={0} step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
      <Field label="PAYMENT">
        <select value={payment} onChange={(e) => setPayment(e.target.value as Payment)}>{PAYMENTS.map((x) => <option key={x}>{x}</option>)}</select>
      </Field>
      <Field label="BUYER (FOR RETENTION)">
        <input list="buyers" value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="Name or @handle" />
      </Field>
      <Field label="SOLD ON"><input type="date" required value={on} onChange={(e) => setOn(e.target.value)} /></Field>
      <Field label="AT SHOW">
        <select value={showId} onChange={(e) => setShowId(e.target.value)}>
          <option value="">Not at a show</option>
          {db.shows.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.date}</option>)}
        </select>
      </Field>
      <Field label="NOTE" wide><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></Field>
      {valid && (
        <div className="field wide sale-sum">
          <span className="label">PROCEEDS</span>
          <span className="mono">
            {money(q * p)} · <span className={tone(card.cost, p)}>{signed((p - card.cost) * q)} ({pct(card.cost, p)})</span>
            {q < card.qty && <span className="muted"> · {card.qty - q} stay on {card.id}</span>}
          </span>
        </div>
      )}
      <datalist id="buyers">{buyers.map((b) => <option key={b} value={b} />)}</datalist>
    </Dialog>
  );
}
