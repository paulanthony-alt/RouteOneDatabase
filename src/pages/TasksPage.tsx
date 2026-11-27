import { useState, type FormEvent } from 'react';
import type { Task, TaskStatus } from '../types';
import { useStore } from '../store/store';
import { daysUntil, longDate, shortDate, today } from '../lib/format';
import Dialog, { Field } from '../components/Dialog';

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'todo', label: 'TO DO' },
  { status: 'doing', label: 'DOING' },
  { status: 'done', label: 'DONE' },
];
const ORDER: TaskStatus[] = ['todo', 'doing', 'done'];

const dueLabel = (t: Task) => {
  if (!t.due) return '';
  const d = daysUntil(t.due);
  if (t.status === 'done') return shortDate(t.due);
  if (d < 0) return `OVERDUE · ${shortDate(t.due)}`;
  if (d === 0) return 'DUE TODAY';
  if (d === 1) return 'DUE TOMORROW';
  return `DUE ${shortDate(t.due)}`;
};

/** Sort: high priority first, then soonest due, then oldest. */
const sortTasks = (a: Task, b: Task) =>
  (a.priority === 'high' ? 0 : 1) - (b.priority === 'high' ? 0 : 1) ||
  (a.due || '9999').localeCompare(b.due || '9999') ||
  a.id - b.id;

export default function TasksPage() {
  const { db, dispatch } = useStore();
  const [editing, setEditing] = useState<Task | null>(null);
  const [showFilter, setShowFilter] = useState('ALL');
  // Ticks show instantly while the save is on its way.
  const [ticking, setTicking] = useState<Record<number, boolean>>({});
  const tick = async (t: Task, checked: boolean) => {
    setTicking((p) => ({ ...p, [t.id]: checked }));
    await dispatch({ type: 'updateTask', id: t.id, patch: { status: checked ? 'done' : 'todo' } });
    setTicking((p) => { const n = { ...p }; delete n[t.id]; return n; });
  };
  const tasks = db.tasks.filter((t) => showFilter === 'ALL' || (showFilter === 'NONE' ? !t.showId : t.showId === showFilter));

  const open = tasks.filter((t) => t.status !== 'done');
  const overdue = open.filter((t) => t.due && daysUntil(t.due) < 0);
  const dueToday = open.filter((t) => t.due && daysUntil(t.due) === 0);
  const week = open.filter((t) => t.due && daysUntil(t.due) >= 0 && daysUntil(t.due) <= 7);
  const doneWeek = tasks.filter((t) => t.doneOn && daysUntil(t.doneOn) >= -7);

  const kpis = [
    { label: 'OPEN', value: String(open.length), note: `${open.filter((t) => t.status === 'doing').length} in progress`, c: '' },
    { label: 'OVERDUE', value: String(overdue.length), note: 'Past their due date', c: overdue.length ? 'loss' : '' },
    { label: 'DUE TODAY', value: String(dueToday.length), note: `${week.length} due in the next 7 days`, c: dueToday.length ? 'warn' : '' },
    { label: 'DONE THIS WEEK', value: String(doneWeek.length), note: 'Finished in the last 7 days', c: doneWeek.length ? 'gain' : '' },
  ];

  const move = (t: Task, dir: 1 | -1) => {
    const next = ORDER[ORDER.indexOf(t.status) + dir];
    if (next) dispatch({ type: 'updateTask', id: t.id, patch: { status: next } });
  };
  const showName = (id: string | null) => db.shows.find((s) => s.id === id)?.name;

  return (
    <main>
      <section className="content">
        <div className="title-row">
          <div>
            <h1>TASKS</h1>
            <p className="meta">{open.length} OPEN · {db.tasks.length} TOTAL</p>
          </div>
          <label className="field inline">
            <span className="label">SHOW</span>
            <select value={showFilter} onChange={(e) => setShowFilter(e.target.value)}>
              <option value="ALL">All tasks</option>
              <option value="NONE">Not for a show</option>
              {db.shows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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

        <QuickAdd key={showFilter} defaultShow={showFilter !== 'ALL' && showFilter !== 'NONE' ? showFilter : ''} />

        <div className="board">
          {COLUMNS.map((col) => {
            const items = tasks.filter((t) => t.status === col.status).sort(col.status === 'done'
              ? (a, b) => (b.doneOn ?? '').localeCompare(a.doneOn ?? '') || b.id - a.id
              : sortTasks);
            return (
              <section className="column" key={col.status} aria-label={col.label}>
                <div className="column-head">
                  <span className="sub-h">{col.label}</span>
                  <span className="mono muted">{items.length}</span>
                </div>
                {items.length === 0 && <p className="note column-empty">Nothing here.</p>}
                {items.map((t) => {
                  const d = t.due ? daysUntil(t.due) : null;
                  const dueTone = t.status === 'done' ? 'muted' : d != null && d < 0 ? 'loss' : d === 0 ? 'warn' : 'muted';
                  return (
                    <article className={`task${t.priority === 'high' ? ' high' : ''}${t.status === 'done' ? ' is-done' : ''}`} key={t.id}>
                      <div className="task-top">
                        <input
                          type="checkbox"
                          checked={ticking[t.id] ?? t.status === 'done'}
                          aria-label={t.status === 'done' ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`}
                          onChange={(e) => tick(t, e.target.checked)}
                        />
                        <button type="button" className="task-title" onClick={() => setEditing(t)}>{t.title}</button>
                      </div>
                      <div className="task-meta">
                        {t.priority === 'high' && <span className="chip chip-listed">HIGH</span>}
                        {t.due && <span className={`mono ${dueTone}`}>{dueLabel(t)}</span>}
                        {t.who && <span className="mono">@{t.who.toUpperCase()}</span>}
                        {t.showId && <span className="mono muted">{showName(t.showId)?.toUpperCase()}</span>}
                      </div>
                      {t.notes && <p className="note task-notes">{t.notes}</p>}
                      <div className="task-actions">
                        <button type="button" className="btn btn-ghost btn-sm" disabled={t.status === 'todo'} onClick={() => move(t, -1)} aria-label="Move back">◀</button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={t.status === 'done'} onClick={() => move(t, 1)} aria-label="Move forward">▶</button>
                        <button type="button" className="link" onClick={() => setEditing(t)}>EDIT</button>
                      </div>
                    </article>
                  );
                })}
              </section>
            );
          })}
        </div>
      </section>
      {editing && <TaskDialog task={editing} onClose={() => setEditing(null)} />}
    </main>
  );
}

function QuickAdd({ defaultShow }: { defaultShow: string }) {
  const { db, dispatch } = useStore();
  const [f, setF] = useState({ title: '', due: '', who: '', priority: 'normal' as Task['priority'], showId: defaultShow });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) return;
    setBusy(true);
    const r = await dispatch({
      type: 'addTask',
      task: { title: f.title.trim(), due: f.due, who: f.who.trim(), priority: f.priority, status: 'todo', showId: f.showId || null, notes: '' },
    });
    setBusy(false);
    if (r) setF((p) => ({ ...p, title: '', due: '', priority: 'normal' }));
  }

  return (
    <form className="panel quick-add" onSubmit={submit}>
      <label className="field qa-title">
        <span className="label">NEW TASK</span>
        <input value={f.title} onChange={set('title')} placeholder="Print price tags for the show" />
      </label>
      <label className="field"><span className="label">DUE</span><input type="date" value={f.due} min={today()} onChange={set('due')} /></label>
      <label className="field"><span className="label">WHO</span><input value={f.who} onChange={set('who')} placeholder="Name" /></label>
      <label className="field">
        <span className="label">PRIORITY</span>
        <select value={f.priority} onChange={set('priority')}><option value="normal">Normal</option><option value="high">High</option></select>
      </label>
      <label className="field">
        <span className="label">SHOW</span>
        <select value={f.showId} onChange={set('showId')}>
          <option value="">None</option>
          {db.shows.map((s) => <option key={s.id} value={s.id}>{s.name} · {longDate(s.date)}</option>)}
        </select>
      </label>
      <button type="submit" className="btn btn-accent" disabled={busy || !f.title.trim()}>{busy ? 'ADDING…' : 'ADD TASK'}</button>
    </form>
  );
}

function TaskDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const { db, dispatch } = useStore();
  const [f, setF] = useState({ ...task, showId: task.showId ?? '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit() {
    if (!f.title.trim()) return setError('Give the task a name.');
    setBusy(true);
    const r = await dispatch({
      type: 'updateTask', id: task.id,
      patch: { title: f.title.trim(), due: f.due, who: f.who.trim(), priority: f.priority, status: f.status, showId: f.showId || null, notes: f.notes.trim() },
    });
    if (r) onClose(); else setBusy(false);
  }

  async function remove() {
    if (!confirm(`Delete “${task.title}”?`)) return;
    setBusy(true);
    if (await dispatch({ type: 'removeTask', id: task.id })) onClose(); else setBusy(false);
  }

  return (
    <Dialog label="EDIT TASK" title={task.title} submitLabel="SAVE" busy={busy} error={error} onSubmit={submit} onClose={onClose}>
      <Field label="TASK" wide><input value={f.title} onChange={set('title')} autoFocus /></Field>
      <Field label="DUE"><input type="date" value={f.due} onChange={set('due')} /></Field>
      <Field label="WHO"><input value={f.who} onChange={set('who')} /></Field>
      <Field label="STATUS">
        <select value={f.status} onChange={set('status')}>{COLUMNS.map((c) => <option key={c.status} value={c.status}>{c.label}</option>)}</select>
      </Field>
      <Field label="PRIORITY">
        <select value={f.priority} onChange={set('priority')}><option value="normal">Normal</option><option value="high">High</option></select>
      </Field>
      <Field label="SHOW" wide>
        <select value={f.showId} onChange={set('showId')}>
          <option value="">None</option>
          {db.shows.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="NOTES" wide><textarea rows={3} value={f.notes} onChange={set('notes')} /></Field>
      <div className="field wide"><button type="button" className="link danger-link" onClick={remove} disabled={busy}>DELETE TASK</button></div>
    </Dialog>
  );
}
