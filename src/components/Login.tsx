import { useState, type FormEvent } from 'react';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { fb } from '../lib/firebase';
import Gate from './Gate';

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/missing-password': 'Enter your password.',
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/user-disabled': 'This account has been turned off.',
  'auth/too-many-requests': 'Too many tries. Wait a minute, or reset your password.',
  'auth/network-request-failed': 'No connection. Check the Wi-Fi and try again.',
};
const explain = (e: unknown) => MESSAGES[(e as { code?: string }).code ?? ''] ?? (e as Error).message;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      await signInWithEmailAndPassword(fb().auth, email.trim(), password);
    } catch (err) {
      setError(explain(err));
      setBusy(false);
    }
  }

  async function reset() {
    if (!email.trim()) return setError('Enter your email first, then press Forgot password.');
    setError('');
    try {
      await sendPasswordResetEmail(fb().auth, email.trim());
      setInfo(`If ${email.trim()} has an account, a reset link is on its way.`);
    } catch (err) {
      setError(explain(err));
    }
  }

  return (
    <Gate label="STAFF SIGN-IN">
      <form className="gate-form" onSubmit={submit}>
        <label className="field">
          <span className="label">EMAIL</span>
          <input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span className="label">PASSWORD</span>
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {info && <p className="note" role="status">{info}</p>}
        <button className="btn btn-accent" type="submit" disabled={busy}>{busy ? 'SIGNING IN…' : 'SIGN IN'}</button>
        <button className="link" type="button" onClick={reset}>FORGOT PASSWORD</button>
      </form>
    </Gate>
  );
}
