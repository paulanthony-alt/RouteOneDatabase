import { useState } from 'react';
import type { DB } from '../types';
import type { Backend } from '../store/backend';
import { emptyDB, readLocal, sampleDB } from '../store/local';
import Gate from './Gate';

/** Shown once, when the shared Firestore ledger has no data yet. */
export default function Setup({ apply }: { apply: Backend['apply'] }) {
  const local = readLocal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function start(db: DB) {
    setBusy(true);
    setError('');
    try {
      await apply({ type: 'replace', db });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Gate label="FIRST-TIME SETUP" title="Set up the shared ledger">
      <p className="sub">The database is empty. Choose what to start with — everyone on the staff list will see it.</p>
      {local && (
        <button type="button" className="btn btn-accent" disabled={busy} onClick={() => start(local)}>
          UPLOAD THIS BROWSER’S DATA ({local.cards.length} RECORDS)
        </button>
      )}
      <button type="button" className={`btn ${local ? 'btn-ghost' : 'btn-accent'}`} disabled={busy} onClick={() => start(emptyDB())}>
        START EMPTY
      </button>
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => start(sampleDB())}>START WITH SAMPLE DATA</button>
      {busy && <p className="note">Setting up…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </Gate>
  );
}
