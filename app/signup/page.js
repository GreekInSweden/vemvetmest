'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, usernameToEmail, isValidUsername } from '../../lib/supabaseClient';

export default function SignupPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!isValidUsername(username)) {
      setError('Användarnamn måste vara 3–20 tecken: bokstäver, siffror eller understreck.');
      return;
    }
    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken.');
      return;
    }

    setLoading(true);
    const email = usernameToEmail(username);

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setLoading(false);
      if (signUpError.message.toLowerCase().includes('already registered')) {
        setError('Användarnamnet är redan taget. Välj ett annat.');
      } else {
        setError(signUpError.message);
      }
      return;
    }

    if (data.user) {
      await supabase.from('profiles').insert({ id: data.user.id, username: username.trim() });
    }

    setLoading(false);

    if (data.session) {
      router.push('/');
    } else {
      // Om e-postbekräftelse råkar vara påslagen i Supabase-projektet
      setError('Kontot skapades. Logga in — om det inte fungerar, stäng av "Confirm email" i Supabase Auth-inställningar.');
    }
  }

  return (
    <div className="wrap" style={{ maxWidth: 420, paddingTop: 60 }}>
      <div className="eyebrow">Kan Du Alla</div>
      <h1 className="brand" style={{ fontSize: 32 }}>Skapa konto</h1>
      <p className="subhead" style={{ marginBottom: 22 }}>Bara ett användarnamn och ett lösenord — inget mejl krävs.</p>

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
          placeholder="Lösenord (minst 6 tecken)"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        {error && <div className="error-msg">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'Skapar konto…' : 'Skapa konto'}
        </button>
      </form>

      <p className="subhead" style={{ marginTop: 16, textAlign: 'center' }}>
        Har du redan ett konto? <a href="/login">Logga in</a>
      </p>
    </div>
  );
}
