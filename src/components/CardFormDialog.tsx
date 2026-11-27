import { useState } from 'react';
import type { Card, CardInput, Estimate, Payment, Status } from '../types';
import { PAYMENTS } from '../types';
import { useStore } from '../store/store';
import { estimateCard } from '../lib/estimate';
import { cents, num, today } from '../lib/format';
import Dialog, { Field } from './Dialog';

const GAMES = ['Pokémon', 'Basketball', 'Baseball', 'Football', 'Soccer', 'Hockey', 'One Piece', 'Magic', 'Yu-Gi-Oh!'];
const ACQUIRE_EVENTS = ['ACQUIRED', 'PULLED', 'TRADED IN'];

interface Props {
  card?: Card; // present → edit mode
  defaultShowId?: string | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}

export default function CardFormDialog({ card, defaultShowId = null, onClose, onSaved }: Props) {
  const { db, dispatch } = useStore();
  const sold = card?.status === 'Sold';
  const [f, setF] = useState({
    name: card?.name ?? '',
    setName: card?.setName ?? '',
    cardNo: card?.cardNo ?? '',
    game: card?.game ?? 'Pokémon',
    grade: card?.grade ?? 'RAW NM',
    qty: String(card?.qty ?? 1),
    cost: card ? String(card.cost) : '',
    market: card ? String(card.market) : '',
    status: (card?.status ?? 'Held') as Status,
    location: card?.location ?? '',
    salePrice: card?.sale ? String(card.sale.price) : '',
    saleOn: card?.sale?.on ?? '',
    payment: (card?.sale?.payment ?? 'Cash') as Payment,
    buyer: card?.sale?.buyer ?? '',
    saleShow: card?.sale?.showId ?? '',
    saleAd: card?.sale?.adId != null ? String(card.sale.adId) : '',
    event: 'ACQUIRED',
    on: today(),
    note: '',
    paid: true,
    showId: defaultShowId ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [est, setEst] = useState<{ busy: boolean; result?: Estimate | null; error?: string }>({ busy: false });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function estimate() {
    if (!f.name.trim()) return setEst({ busy: false, error: 'Enter a card name first.' });
    setEst({ busy: true });
    const draft = { ...(card as Card), id: card?.id ?? '', name: f.name, setName: f.setName, cardNo: f.cardNo, game: f.game, grade: f.grade };
    try {
      const result = await estimateCard(db, draft);
      setEst({ busy: false, result });
      if (result) setF((p) => ({ ...p, market: result.value.toFixed(2) }));
    } catch (e) {
      setEst({ busy: false, error: (e as Error).message });
    }
  }

  async function submit() {
    const qty = num(f.qty), cost = num(f.cost), market = num(f.market), salePrice = num(f.salePrice);
    if (!f.name.trim()) return setError('Card name is required.');
    if (!Number.isInteger(qty) || qty < 1) return setError('Quantity must be a whole number of at least 1.');
    if (!(cost >= 0)) return setError('Enter a cost of $0 or more.');
    if (!(market >= 0)) return setError('Enter a market value of $0 or more, or press ESTIMATE.');
    if (sold && !(salePrice >= 0)) return setError('Enter a sale price of $0 or more.');

    const input: CardInput = {
      name: f.name.trim(), setName: f.setName.trim(), cardNo: f.cardNo.trim(), game: f.game.trim(),
      grade: f.grade.trim().toUpperCase(), qty, cost, market, status: f.status, location: f.location.trim(),
    };
    setBusy(true);
    setError('');
    const estimate = est.result ?? undefined;
    const r = card
      ? await dispatch({
          type: 'updateCard', id: card.id, input, estimate,
          sale: sold ? { price: salePrice, on: f.saleOn, payment: f.payment, buyer: f.buyer, showId: f.saleShow || null, adId: f.saleAd ? Number(f.saleAd) : null } : undefined,
        })
      : await dispatch({ type: 'addCard', input, event: f.event, on: f.on, note: f.note.trim(), paid: f.paid, showId: f.showId || null, estimate });
    if (!r) return setBusy(false); // error shown in the toast; keep the form open
    onSaved(card ? card.id : r.newCardIds[0]);
  }

  const shows = [...db.shows].sort((a, b) => a.date.localeCompare(b.date));
  const qty = num(f.qty), cost = num(f.cost);

  return (
    <Dialog
      label={card ? `EDIT · ${card.id}` : 'NEW ENTRY'}
      title={card ? card.name : 'Add to inventory'}
      submitLabel={card ? 'SAVE CHANGES' : 'ADD RECORD'}
      busy={busy}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    >
      <Field label="CARD NAME" wide><input required value={f.name} onChange={set('name')} autoFocus /></Field>
      <Field label="SET"><input value={f.setName} onChange={set('setName')} /></Field>
      <Field label="NUMBER"><input value={f.cardNo} onChange={set('cardNo')} placeholder="223/197" /></Field>
      <Field label="GAME / SPORT"><input list="games" value={f.game} onChange={set('game')} /></Field>
      <Field label="GRADE"><input list="grades" value={f.grade} onChange={set('grade')} /></Field>
      <Field label="QTY"><input type="number" min={1} step={1} required value={f.qty} onChange={set('qty')} /></Field>
      <Field label="LOCATION"><input value={f.location} onChange={set('location')} placeholder="Case 1 · A" /></Field>
      <Field label="COST / UNIT ($)"><input type="number" min={0} step="0.01" required value={f.cost} onChange={set('cost')} /></Field>
      <Field label="MARKET / UNIT ($)">
        <span className="input-row">
          <input type="number" min={0} step="0.01" required value={f.market} onChange={set('market')} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={estimate} disabled={est.busy}>{est.busy ? '…' : 'ESTIMATE'}</button>
        </span>
      </Field>
      {(est.result !== undefined || est.error) && (
        <p className="field wide est-note" role="status">
          {est.error ? <span className="loss">{est.error}</span>
            : est.result ? <>Estimated {cents(est.result.value)} — {est.result.source}</>
            : <>No price found automatically. Enter market value by hand.</>}
        </p>
      )}

      {sold ? (
        <>
          <Field label="SOLD / UNIT ($)"><input type="number" min={0} step="0.01" required value={f.salePrice} onChange={set('salePrice')} /></Field>
          <Field label="SOLD ON"><input type="date" required value={f.saleOn} onChange={set('saleOn')} /></Field>
          <Field label="PAYMENT">
            <select value={f.payment} onChange={set('payment')}>{PAYMENTS.map((p) => <option key={p}>{p}</option>)}</select>
          </Field>
          <Field label="BUYER"><input value={f.buyer} onChange={set('buyer')} /></Field>
          <Field label="SOLD AT SHOW">
            <select value={f.saleShow} onChange={set('saleShow')}>
              <option value="">Not at a show</option>
              {shows.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.date}</option>)}
            </select>
          </Field>
          <Field label="CAME FROM AN AD?">
            <select value={f.saleAd} onChange={set('saleAd')}>
              <option value="">No / don’t know</option>
              {db.ads.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.channel}</option>)}
            </select>
          </Field>
        </>
      ) : (
        <Field label="STATUS">
          <select value={f.status} onChange={set('status')}>
            <option value="Held">Held</option>
            <option value="Listed">Listed</option>
          </select>
        </Field>
      )}

      {!card && (
        <>
          <Field label="HOW IT CAME IN">
            <select value={f.event} onChange={set('event')}>{ACQUIRE_EVENTS.map((e) => <option key={e}>{e}</option>)}</select>
          </Field>
          <Field label="DATE"><input type="date" required value={f.on} onChange={set('on')} /></Field>
          <Field label="BOUGHT AT SHOW">
            <select value={f.showId} onChange={set('showId')}>
              <option value="">Not at a show</option>
              {shows.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.date}</option>)}
            </select>
          </Field>
          <Field label="NOTE" wide><input value={f.note} onChange={set('note')} placeholder="Gold Coast Card Show — trade-in" /></Field>
          <label className="check wide">
            <input type="checkbox" checked={f.paid} onChange={(e) => setF((p) => ({ ...p, paid: e.target.checked }))} />
            <span>
              Paid out of our money
              {f.paid && qty >= 1 && cost >= 0 ? <span className="muted"> — takes {cents(qty * cost)} out of the bankroll</span> : null}
            </span>
          </label>
        </>
      )}

      <datalist id="games">{GAMES.map((g) => <option key={g} value={g} />)}</datalist>
      <datalist id="grades">{Object.keys(db.settings.multipliers).map((g) => <option key={g} value={g} />)}</datalist>
    </Dialog>
  );
}
