import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';

interface Props {
  title: string;
  label: string;
  submitLabel: string;
  busy: boolean;
  error: string;
  onSubmit: () => void;
  onClose: () => void;
  children: ReactNode;
}

/** Native modal <dialog>: focus trap, Esc to close and backdrop come from the browser. */
export default function Dialog({ title, label, submitLabel, busy, error, onSubmit, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current!;
    if (!d.open) d.showModal();
    return () => d.close();
  }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!busy) onSubmit();
  }

  return (
    <dialog ref={ref} className="dialog" onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }}>
      <form onSubmit={submit} noValidate={false}>
        <div className="dialog-head">
          <span className="label">{label}</span>
          <h2>{title}</h2>
        </div>
        <div className="dialog-body">{children}</div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>CANCEL</button>
          <button type="submit" className="btn btn-accent" disabled={busy}>{busy ? 'SAVING…' : submitLabel}</button>
        </div>
      </form>
    </dialog>
  );
}

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={'field' + (wide ? ' wide' : '')}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
