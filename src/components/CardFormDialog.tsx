import { useState } from 'react';
import type { Card, CardInput, Status } from '../types';
import { createCard, updateCard } from '../lib/api';
import { today } from '../lib/format';
import Dialog, { Field } from './Dialog';

const GAMES = ['Pokémon', 'Basketball', 'Baseball', 'Football', 'Soccer', 'Hockey', 'One Piece', 'Magic', 'Yu-Gi-Oh!'];
const GRADES = ['RAW NM', 'RAW LP', 'RAW MP', 'PSA 10', 'PSA 9', 'PSA 8', 'CGC 10', 'CGC 9.5', 'BGS 9.5', 'SEALED'];
const ACQUIRE_EVENTS = ['ACQUIRED', 'PULLED', 'TRADED IN'];

interface Props {
  card?: Card; // present → edit mode
  onClose: () => void;
  onSaved: (id: string) => void;
}

export default function CardFormDialog({ card, onClose, onSaved }: Props) {
  const editing = Boolean(card);
  const sold = card?.status === 'Sold';
  const [f, setF] = useState({
    name: card?.name ?? '',
    set_name: card?.set_name ?? '',
    card_no: card?.card_no ?? '',
    game: card?.game ?? 'Pokémon',
    grade: card?.grade ?? 'RAW NM',
    qty: String(card?.qty ?? 1),
    cost: card ? String(card.cost) : '',
    market: card ? String(card.market) : '',
    status: (card?.status ?? 'Held') as Status,
    location: card?.location ?? '',
    sold_price: card?.sold_price != null ? String(card.sold_price) : '',
    sold_on: card?.sold_on ?? '',
    event: 'ACQUIRED',
    event_on: today(),
    note: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit() {
    const qty = Number(f.qty), cost = Number(f.cost), market = Number(f.market);
    if (!f.name.trim()) return setError('Card name is required.');
    if (!Number.isInteger(qty) || qty < 1) return setError('Quantity must be a whole number of at least 1.');
    if (f.cost === '' || !(cost >= 0)) return setError('Enter a cost of $0 or more.');
    if (f.market === '' || !(market >= 0)) return setError('Enter a market value of $0 or more.');
    const soldPrice = Number(f.sold_price);
    if (sold && (f.sold_price === '' || !(soldPrice >= 0))) return setError('Enter a sale price of $0 or more.');

    const input: CardInput = {
      name: f.name.trim(), set_name: f.set_name.trim(), card_no: f.card_no.trim(), game: f.game.trim(),
      grade: f.grade.trim(), qty, cost, market, status: f.status, location: f.location.trim(),
    };
    setBusy(true);
    setError('');
    try {
      const saved = card
        ? await updateCard(card.id, input, sold ? { price: soldPrice, on: f.sold_on } : undefined)
        : await createCard(input, { event: f.event, on: f.event_on, note: f.note.trim() });
      onSaved(saved.id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Dialog
      label={card ? `EDIT · ${card.id}` : 'NEW ENTRY'}
      title={card ? card.name : 'Add to inventory'}
      submitLabel={editing ? 'SAVE CHANGES' : 'ADD RECORD'}
      busy={busy}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    >
      <Field label="CARD NAME" wide><input required value={f.name} onChange={set('name')} autoFocus /></Field>
      <Field label="SET"><input value={f.set_name} onChange={set('set_name')} /></Field>
      <Field label="NUMBER"><input value={f.card_no} onChange={set('card_no')} placeholder="223/197" /></Field>
      <Field label="GAME / SPORT"><input list="games" value={f.game} onChange={set('game')} /></Field>
      <Field label="GRADE"><input list="grades" value={f.grade} onChange={set('grade')} /></Field>
      <Field label="QTY"><input type="number" min={1} step={1} required value={f.qty} onChange={set('qty')} /></Field>
      <Field label="LOCATION"><input value={f.location} onChange={set('location')} placeholder="Case 1 · A" /></Field>
      <Field label="COST / UNIT ($)"><input type="number" min={0} step="0.01" required value={f.cost} onChange={set('cost')} /></Field>
      <Field label="MARKET / UNIT ($)"><input type="number" min={0} step="0.01" required value={f.market} onChange={set('market')} /></Field>

      {sold ? (
        <>
          <Field label="SOLD / UNIT ($)"><input type="number" min={0} step="0.01" required value={f.sold_price} onChange={set('sold_price')} /></Field>
          <Field label="SOLD ON"><input type="date" required value={f.sold_on} onChange={set('sold_on')} /></Field>
        </>
      ) : (
        <Field label="STATUS">
          <select value={f.status} onChange={set('status')}>
            <option value="Held">Held</option>
            <option value="Listed">Listed</option>
          </select>
        </Field>
      )}

      {!editing && (
        <>
          <Field label="HOW IT CAME IN">
            <select value={f.event} onChange={set('event')}>
              {ACQUIRE_EVENTS.map((e) => <option key={e}>{e}</option>)}
            </select>
          </Field>
          <Field label="DATE"><input type="date" required value={f.event_on} onChange={set('event_on')} /></Field>
          <Field label="NOTE" wide><input value={f.note} onChange={set('note')} placeholder="Gold Coast Card Show — trade-in" /></Field>
        </>
      )}

      <datalist id="games">{GAMES.map((g) => <option key={g} value={g} />)}</datalist>
      <datalist id="grades">{GRADES.map((g) => <option key={g} value={g} />)}</datalist>
    </Dialog>
  );
}
