import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import Brand from './Brand';

export default function Login() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState('sending');
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
    });
    if (error) {
      setError(error.message);
      setState('idle');
    } else setState('sent');
  }

  return (
    <div className="gate">
      <div className="stripe" />
      <form className="gate-box" onSubmit={submit}>
        <Brand />
        <span className="label">STAFF SIGN-IN</span>
        {state === 'sent' ? (
          <p className="sub">Check {email} for a sign-in link.</p>
        ) : (
          <>
            <label className="field">
              <span className="label">EMAIL</span>
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="btn btn-accent" type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? 'SENDING…' : 'SEND MAGIC LINK'}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
