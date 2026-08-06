'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, usernameToEmail } from '../../lib/supabaseClient';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const email = usernameToEmail(username);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (signInError) {
      setError('Fel användarnamn eller lösenord.');
      return;
    }
    router.push('/');
  }

  return (
    <div className="wrap" style={{ maxWidth: 420, paddingTop: 60 }}>
      <div className="eyebrow">Kan Du Alla</div>
      <h1 className="brand" style={{ fontSize: 32 }}>Logga in</h1>
      <p className="subhead" style={{ marginBottom: 22 }}>Kul att du är tillbaka.</p>

      <form className="panel" onSubmit={handleSubmit}>
        <input
          className="field"
          type="text"
          placeholder="Användarnamn"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
        />
        <input
          className="field"
          type="password"
          placeholder="Lösenord"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && <div className="error-msg">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Loggar in…' : 'Logga in'}
        </button>
      </form>

      <p className="subhead" style={{ marginTop: 16, textAlign: 'center' }}>
        Inget konto än? <a href="/signup">Skapa ett</a>
      </p>
    </div>
  );
}
