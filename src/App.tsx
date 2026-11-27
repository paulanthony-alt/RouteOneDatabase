import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { configured, supabase } from './lib/supabase';
import Login from './components/Login';
import Ledger from './components/Ledger';

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!configured) {
    return (
      <div className="gate">
        <div className="stripe" />
        <div className="gate-box">
          <span className="label">SETUP REQUIRED</span>
          <h2>Connect Supabase</h2>
          <p className="sub">
            Copy <code>.env.example</code> to <code>.env.local</code>, fill in <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code>, then restart the dev server.
          </p>
        </div>
      </div>
    );
  }
  if (session === undefined) return <div className="gate"><div className="stripe" /><p className="empty">LOADING…</p></div>;
  if (!session) return <Login />;
  return <Ledger email={session.user.email ?? ''} />;
}
