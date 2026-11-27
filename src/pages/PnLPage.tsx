import { useState } from 'react';
import type { Ad } from '../types';
import { AD_CHANNELS } from '../types';
import { useStore } from '../store/store';
import { monthly, periodsIn, pnl, type Period } from '../store/selectors';
import { longDate, money, num, rate, shortDate, signed, today } from '../lib/format';
import Dialog, { Field } from '../components/Dialog';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const periodName = (p: Period) =>
  p === 'all' ? 'All time' : p.length === 4 ? p : `${MONTHS[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;
const tone = (n: number) => (n > 0 ? 'gain' : n < 0 ? 'loss' : '');

export default function PnLPage() {
  const { db } = useStore();
  const [period, setPeriod] = useState<Period>('all');
  const [editing, setEditing] = useState<Ad | 'new' | null>(null);
  const p = pnl(db, period);
  const periods = periodsIn(db);
  const byMonth = period.length === 7 ? [] : monthly(db, period === 'all' ? null : period);

  const kpis = [
    { label: 'CARDS', value: signed(p.cards.profit), note: `${p.cards.units} sold · ${rate(p.cards.profit, p.cards.revenue)} margin`, c: tone(p.cards.profit) },
    { label: 'SHOWS', value: signed(p.showOther), note: 'Tables, admission and other income, minus show costs', c: tone(p.showOther) },
    { label: 'ADVERTISING', value: signed(-p.adSpend), note: `${p.ads.length} ad${p.ads.length === 1 ? '' : 's'} paid for`, c: tone(-p.adSpend) },
    { label: 'NET PROFIT', value: signed(p.net), note: periodName(period), c: tone(p.net) },
  ];

  return (
    <main>
      <section className="content">
        <div className="title-row">
          <div>
            <h1>PROFIT &amp; LOSS</h1>
            <p className="meta">CARDS · SHOWS · ADVERTISING — {periodName(period).toUpperCase()}</p>
          </div>
          <label className="field inline">
            <span className="label">PERIOD</span>
            <select value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="all">All time</option>
              {periods.map((x) => <option key={x} value={x}>{x.length === 4 ? `All of ${x}` : periodName(x)}</option>)}
            </select>
          </label>
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
            <span className="label">STATEMENT · {periodName(period).toUpperCase()}</span>
            <dl className="sum-list">
              <div><dt>Card sales</dt><dd>{money(p.cards.revenue)}</dd></div>
              <div><dt>− What those cards cost us</dt><dd className="loss">{money(p.cards.cost)}</dd></div>
              <div className="total"><dt>Card profit</dt><dd className={tone(p.cards.profit)}>{signed(p.cards.profit)}</dd></div>
              <div><dt>+ Show income (tables, admission…)</dt><dd className="gain">{money(p.shows.reduce((s, x) => s + x.income, 0))}</dd></div>
              <div><dt>− Show costs (venue, supplies…)</dt><dd className="loss">{money(p.shows.reduce((s, x) => s + x.expenses, 0))}</dd></div>
              <div><dt>− Advertising</dt><dd className="loss">{money(p.adSpend)}</dd></div>
              <div className="total grand"><dt>Net profit</dt><dd className={tone(p.net)}>{signed(p.net)}</dd></div>
            </dl>
            <span className="note">
              Each card sale is counted once, under card profit — including sales made at a show or brought in by an ad.
              Of the card profit, {signed(p.cards.atShows)} came from sales at shows and {signed(p.cards.fromAds)} from buyers who came from an ad.
            </span>
          </div>

          {byMonth.length > 0 && (
            <div className="panel">
              <span className="label">BY MONTH</span>
              <div className="table-wrap flat">
                <table className="compact">
                  <thead><tr><th>MONTH</th><th className="r">CARDS</th><th className="r">SHOWS</th><th className="r">ADS</th><th className="r">NET</th></tr></thead>
                  <tbody>
                    {byMonth.map((m) => (
                      <tr key={m.month}>
                        <td className="id">{periodName(m.month).toUpperCase()}</td>
                        <td className={`num r ${tone(m.cards)}`}>{signed(m.cards)}</td>
                        <td className={`num r ${tone(m.shows)}`}>{signed(m.shows)}</td>
                        <td className={`num r ${tone(m.ads)}`}>{signed(m.ads)}</td>
                        <td className={`num r ${tone(m.net)}`}><strong>{signed(m.net)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ---------- Cards ---------- */}
        <div className="section-head"><h2>CARDS</h2><span className="mono muted">{p.cards.sales.length} SALES</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>DATE</th><th>CARD</th><th className="r">QTY</th><th className="r">SOLD FOR</th><th className="r">COST</th><th className="r">PROFIT</th><th>WHERE</th></tr></thead>
            <tbody>
              {[...p.cards.sales].sort((a, b) => b.sale!.on.localeCompare(a.sale!.on)).map((c) => {
                const pr = (c.sale!.price - c.cost) * c.qty;
                const where = [db.shows.find((s) => s.id === c.sale!.showId)?.name, db.ads.find((a) => a.id === c.sale!.adId)?.name && `Ad: ${db.ads.find((a) => a.id === c.sale!.adId)!.name}`].filter(Boolean).join(' · ');
                return (
                  <tr key={c.id}>
                    <td className="id">{shortDate(c.sale!.on)}</td>
                    <td className="card"><div className="card-btn"><span className="name">{c.name}</span><span className="set">{c.id} · {c.grade}</span></div></td>
                    <td className="num r">{c.qty}</td>
                    <td className="num r">{money(c.sale!.price * c.qty)}</td>
                    <td className="num r cost">{money(c.cost * c.qty)}</td>
                    <td className={`num r ${tone(pr)}`}>{signed(pr)}</td>
                    <td className="set-cell">{where || <span className="muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {p.cards.sales.length === 0 && <p className="empty">NO CARD SALES IN THIS PERIOD.</p>}
        </div>

        {/* ---------- Shows ---------- */}
        <div className="section-head"><h2>SHOWS</h2><span className="mono muted">EDIT INCOME &amp; COSTS ON THE SHOWS PAGE</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>SHOW</th><th className="r">CARD PROFIT</th><th className="r">INCOME</th><th className="r">COSTS</th><th className="r">SHOW NET</th></tr></thead>
            <tbody>
              {p.shows.map((s) => (
                <tr key={s.show.id}>
                  <td className="card"><a className="card-btn" href="#shows"><span className="name">{s.show.name}</span><span className="set">{longDate(s.show.date)}</span></a></td>
                  <td className={`num r ${tone(s.cardProfit)}`}>{signed(s.cardProfit)}</td>
                  <td className="num r gain">{money(s.income)}</td>
                  <td className="num r loss">{money(s.expenses)}</td>
                  <td className={`num r ${tone(s.net)}`}><strong>{signed(s.net)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
          {p.shows.length === 0 && <p className="empty">NO SHOWS IN THIS PERIOD.</p>}
        </div>

        {/* ---------- Advertising ---------- */}
        <div className="section-head">
          <h2>ADVERTISING</h2>
          <button type="button" className="btn btn-accent btn-sm" onClick={() => setEditing('new')}>+ ADD AD</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>DATE</th><th>AD</th><th className="r">SPENT</th><th className="r">SALES IT BROUGHT</th><th className="r">PROFIT FROM THOSE</th><th className="r">RETURN</th><th /></tr></thead>
            <tbody>
              {p.ads.map((a) => (
                <tr key={a.ad.id}>
                  <td className="id">{shortDate(a.ad.on)}</td>
                  <td className="card">
                    <button type="button" className="card-btn" onClick={() => setEditing(a.ad)}>
                      <span className="name">{a.ad.name}</span>
                      <span className="set">{[a.ad.channel, db.shows.find((s) => s.id === a.ad.showId)?.name].filter(Boolean).join(' · ')}</span>
                    </button>
                  </td>
                  <td className="num r loss">{money(a.ad.spend)}</td>
                  <td className="num r">{a.sales} · {money(a.revenue)}</td>
                  <td className={`num r ${tone(a.profit)}`}>{signed(a.profit)}</td>
                  <td className={`num r ${tone(a.net)}`}>
                    <strong>{signed(a.net)}</strong>{' '}
                    <span className="muted">{a.ad.spend ? `${((a.profit / a.ad.spend) * 100).toFixed(0)}%` : ''}</span>
                  </td>
                  <td><button type="button" className="link" onClick={() => setEditing(a.ad)}>EDIT</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {p.ads.length === 0 && <p className="empty">NO ADS IN THIS PERIOD — ADD ONE WHEN YOU PAY FOR A PROMO, FLYERS, ETC.</p>}
        </div>
        <p className="note">
          Return = profit from the sales an ad brought in, minus what the ad cost. To link a sale to an ad, pick it under
          “Came from an ad?” when you record the sale.
        </p>
      </section>
      {editing && <AdDialog ad={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </main>
  );
}

function AdDialog({ ad, onClose }: { ad: Ad | null; onClose: () => void }) {
  const { db, dispatch } = useStore();
  const [f, setF] = useState({
    name: ad?.name ?? '',
    channel: ad?.channel ?? 'Instagram',
    on: ad?.on ?? today(),
    spend: ad ? String(ad.spend) : '',
    showId: ad?.showId ?? '',
    notes: ad?.notes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  const linked = ad ? db.cards.filter((c) => c.sale?.adId === ad.id).length : 0;

  async function submit() {
    const spend = num(f.spend);
    if (!f.name.trim()) return setError('Give the ad a name, like “Instagram promo — Dec show”.');
    if (!(spend >= 0)) return setError('Enter what you spent ($0 or more).');
    if (!f.on) return setError('Pick the date you paid.');
    const data = { name: f.name.trim(), channel: f.channel.trim() || 'Other', on: f.on, spend, showId: f.showId || null, notes: f.notes.trim() };
    setBusy(true);
    const r = ad ? await dispatch({ type: 'updateAd', id: ad.id, patch: data }) : await dispatch({ type: 'addAd', ad: data });
    if (r) onClose(); else setBusy(false);
  }

  async function remove() {
    if (!ad) return;
    const msg = linked ? `Delete “${ad.name}”? ${linked} sale${linked === 1 ? '' : 's'} linked to it will no longer count toward any ad.` : `Delete “${ad.name}”?`;
    if (!confirm(msg)) return;
    setBusy(true);
    if (await dispatch({ type: 'removeAd', id: ad.id })) onClose(); else setBusy(false);
  }

  return (
    <Dialog label={ad ? 'EDIT AD' : 'NEW AD'} title={ad ? ad.name : 'Log ad spending'} submitLabel={ad ? 'SAVE' : 'ADD'} busy={busy} error={error} onSubmit={submit} onClose={onClose}>
      <Field label="NAME" wide><input value={f.name} onChange={set('name')} placeholder="Instagram promo — Dec 12 show" autoFocus /></Field>
      <Field label="WHERE"><input list="ad-channels" value={f.channel} onChange={set('channel')} /></Field>
      <Field label="AMOUNT SPENT ($)"><input type="number" min={0} step="0.01" value={f.spend} onChange={set('spend')} /></Field>
      <Field label="DATE PAID"><input type="date" value={f.on} onChange={set('on')} /></Field>
      <Field label="FOR A SHOW?">
        <select value={f.showId} onChange={set('showId')}>
          <option value="">No</option>
          {db.shows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="NOTES" wide><textarea rows={2} value={f.notes} onChange={set('notes')} /></Field>
      {ad && <p className="field wide note">{linked} sale{linked === 1 ? '' : 's'} linked to this ad.</p>}
      {ad && <div className="field wide"><button type="button" className="link danger-link" onClick={remove} disabled={busy}>DELETE AD</button></div>}
      <p className="field wide note">This amount comes out of the bankroll on the date paid.</p>
      <datalist id="ad-channels">{AD_CHANNELS.map((c) => <option key={c} value={c} />)}</datalist>
    </Dialog>
  );
}
