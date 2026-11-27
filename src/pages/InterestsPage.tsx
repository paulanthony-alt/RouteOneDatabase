import { useState, type FormEvent } from 'react';
import type { Card, DB, Interest, InterestKind, InterestStatus } from '../types';
import { useStore } from '../store/store';
import { money, num, shortDate } from '../lib/format';
import Dialog, { Field } from '../components/Dialog';

const STATUS_LABEL: Record<InterestStatus, string> = { open: 'OPEN', contacted: 'CONTACTED', closed: 'CLOSED' };
const KIND_LABEL: Record<InterestKind, string> = { customer: 'CUSTOMER WANTS', buy: 'WE WANT TO BUY' };

const words = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);

/** Cards on hand whose name contains every word of the request (and the grade, if one was given). */
export function matchesFor(db: DB, i: Interest): Card[] {
  const want = words(i.card);
  if (!want.length) return [];
  return db.cards.filter((c) => {
    if (c.status === 'Sold') return false;
    const have = words(`${c.name} ${c.setName} ${c.cardNo}`);
    if (!want.every((w) => have.some((h) => h.startsWith(w)))) return false;
    return !i.grade.trim() || c.grade.toUpperCase() === i.grade.trim().toUpperCase();
  });
}

type View = 'open' | 'customer' | 'buy' | 'closed';

export default function InterestsPage({ onOpenCard }: { onOpenCard: (id: string) => void }) {
  const { db, dispatch } = useStore();
  const [view, setView] = useState<View>('open');
  const [editing, setEditing] = useState<Interest | 'new' | null>(null);

  const active = db.interests.filter((i) => i.status !== 'closed');
  const withMatch = active.filter((i) => i.kind === 'customer' && matchesFor(db, i).length > 0);
  const list = db.interests
    .filter((i) => (view === 'closed' ? i.status === 'closed' : i.status !== 'closed' && (view === 'open' || i.kind === view)))
    .sort((a, b) => b.createdOn.localeCompare(a.createdOn) || b.id - a.id);

  const kpis = [
    { label: 'CUSTOMER WANTS', value: String(active.filter((i) => i.kind === 'customer').length), note: 'Open requests from customers', c: '' },
    { label: 'IN STOCK NOW', value: String(withMatch.length), note: 'Wants we can fill today — reach out', c: withMatch.length ? 'gain' : '' },
    { label: 'WE WANT TO BUY', value: String(active.filter((i) => i.kind === 'buy').length), note: 'Cards we’re hunting for', c: '' },
    { label: 'CLOSED', value: String(db.interests.length - active.length), note: 'Filled or dropped', c: '' },
  ];

  const tabs: [View, string, number][] = [
    ['open', 'ALL OPEN', active.length],
    ['customer', 'CUSTOMERS', active.filter((i) => i.kind === 'customer').length],
    ['buy', 'WE WANT', active.filter((i) => i.kind === 'buy').length],
    ['closed', 'CLOSED', db.interests.length - active.length],
  ];

  return (
    <main>
      <section className="content">
        <div className="title-row">
          <div>
            <h1>INTERESTS</h1>
            <p className="meta">WHO WANTS WHAT · MATCHED AGAINST INVENTORY</p>
          </div>
          <button type="button" className="btn btn-accent" onClick={() => setEditing('new')}>+ ADD INTEREST</button>
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

        <div className="filters">
          {tabs.map(([v, label, n]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>{label} <span className="n">{n}</span></button>
          ))}
        </div>

        {list.length === 0 ? (
          <p className="empty">
            {db.interests.length === 0
              ? 'NO INTERESTS YET — WHEN SOMEONE ASKS FOR A CARD, ADD IT HERE.'
              : 'NOTHING IN THIS VIEW.'}
          </p>
        ) : (
          <div className="interest-grid">
            {list.map((i) => {
              const matches = i.kind === 'customer' && i.status !== 'closed' ? matchesFor(db, i) : [];
              return (
                <article className={`interest${matches.length ? ' has-match' : ''}`} key={i.id}>
                  <div className="interest-head">
                    <span className="label">{KIND_LABEL[i.kind]} · {shortDate(i.createdOn)}</span>
                    <select
                      className="mini-select"
                      value={i.status}
                      aria-label="Status"
                      onChange={(e) => dispatch({ type: 'updateInterest', id: i.id, patch: { status: e.target.value as InterestStatus } })}
                    >
                      {(Object.keys(STATUS_LABEL) as InterestStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </div>
                  <h3 className="interest-card">{i.card}</h3>
                  <div className="task-meta">
                    {i.grade && <span className="mono">{i.grade.toUpperCase()}</span>}
                    {i.maxPrice != null && <span className="mono">{i.kind === 'buy' ? 'PAY UP TO' : 'BUDGET'} {money(i.maxPrice)}</span>}
                  </div>
                  {i.kind === 'customer' && (
                    <p className="interest-who">
                      <strong>{i.who || 'Unnamed customer'}</strong>
                      {i.contact && <span className="muted"> · {i.contact}</span>}
                    </p>
                  )}
                  {i.notes && <p className="note">{i.notes}</p>}
                  {matches.length > 0 && (
                    <div className="match">
                      <span className="label">IN STOCK</span>
                      {matches.map((c) => (
                        <button type="button" key={c.id} className="match-row" onClick={() => onOpenCard(c.id)}>
                          <span>{c.name} · {c.grade}</span>
                          <span className={`mono ${i.maxPrice != null && c.market > i.maxPrice ? 'loss' : 'gain'}`}>
                            {money(c.market)}{i.maxPrice != null && c.market > i.maxPrice ? ' · OVER BUDGET' : ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="task-actions">
                    <button type="button" className="link" onClick={() => setEditing(i)}>EDIT</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      {editing && <InterestDialog interest={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </main>
  );
}

function InterestDialog({ interest, onClose }: { interest: Interest | null; onClose: () => void }) {
  const { dispatch } = useStore();
  const [f, setF] = useState({
    kind: interest?.kind ?? ('customer' as InterestKind),
    who: interest?.who ?? '',
    contact: interest?.contact ?? '',
    card: interest?.card ?? '',
    grade: interest?.grade ?? '',
    maxPrice: interest?.maxPrice != null ? String(interest.maxPrice) : '',
    notes: interest?.notes ?? '',
    status: interest?.status ?? ('open' as InterestStatus),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!f.card.trim()) return setError('What card is wanted?');
    const price = num(f.maxPrice);
    if (f.maxPrice.trim() && !(price >= 0)) return setError('Max price should be a number.');
    const data = {
      kind: f.kind, who: f.kind === 'customer' ? f.who.trim() : '', contact: f.kind === 'customer' ? f.contact.trim() : '',
      card: f.card.trim(), grade: f.grade.trim(), maxPrice: f.maxPrice.trim() ? price : null, notes: f.notes.trim(), status: f.status,
    };
    setBusy(true);
    const r = interest
      ? await dispatch({ type: 'updateInterest', id: interest.id, patch: data })
      : await dispatch({ type: 'addInterest', interest: data });
    if (r) onClose(); else setBusy(false);
  }

  async function remove() {
    if (!interest || !confirm(`Delete the interest in “${interest.card}”?`)) return;
    setBusy(true);
    if (await dispatch({ type: 'removeInterest', id: interest.id })) onClose(); else setBusy(false);
  }

  return (
    <Dialog
      label={interest ? 'EDIT INTEREST' : 'NEW INTEREST'}
      title={interest ? interest.card : 'Who wants what?'}
      submitLabel={interest ? 'SAVE' : 'ADD'}
      busy={busy}
      error={error}
      onSubmit={submit}
      onClose={onClose}
    >
      <Field label="TYPE" wide>
        <select value={f.kind} onChange={set('kind')}>
          <option value="customer">A customer wants this card</option>
          <option value="buy">We want to buy this card</option>
        </select>
      </Field>
      <Field label="CARD" wide><input value={f.card} onChange={set('card')} placeholder="Umbreon VMAX Alt Art" autoFocus /></Field>
      <Field label="GRADE (OPTIONAL)"><input list="grades-i" value={f.grade} onChange={set('grade')} placeholder="Any" /></Field>
      <Field label={f.kind === 'buy' ? 'PAY UP TO ($)' : 'THEIR BUDGET ($)'}><input type="number" min={0} step="1" value={f.maxPrice} onChange={set('maxPrice')} /></Field>
      {f.kind === 'customer' && (
        <>
          <Field label="CUSTOMER"><input value={f.who} onChange={set('who')} placeholder="Name" /></Field>
          <Field label="CONTACT"><input value={f.contact} onChange={set('contact')} placeholder="Phone, email or @handle" /></Field>
        </>
      )}
      {interest && (
        <Field label="STATUS">
          <select value={f.status} onChange={set('status')}>
            {(Object.keys(STATUS_LABEL) as InterestStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </Field>
      )}
      <Field label="NOTES" wide><textarea rows={2} value={f.notes} onChange={set('notes')} placeholder="Met at the Gold Coast show" /></Field>
      {interest && <div className="field wide"><button type="button" className="link danger-link" onClick={remove} disabled={busy}>DELETE</button></div>}
      <datalist id="grades-i">{['RAW NM', 'PSA 10', 'PSA 9', 'CGC 9.5', 'BGS 9.5', 'SEALED'].map((g) => <option key={g} value={g} />)}</datalist>
    </Dialog>
  );
}
