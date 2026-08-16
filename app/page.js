'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

function stockholmNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Stockholm' }));
}
function ymd(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function Hub() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasPaidAccess, setHasPaidAccess] = useState(false);

  const [kanduallaChallenge, setKanduallaChallenge] = useState(null);
  const [kartanChallenge, setKartanChallenge] = useState(null);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session ? sessionData.session.user.id : null;

      if (!uid) {
        // Publik vy — ingen inloggning krävs för att se vad sajten
        // erbjuder, precis som KanDuAlla:s ursprungliga förstasida.
        setLoggedIn(false);
        setLoading(false);
        return;
      }

      setLoggedIn(true);

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, is_admin, paid_until')
        .eq('id', uid)
        .single();

      setUsername(profile?.username || '');
      setIsAdmin(!!profile?.is_admin);

      const today = ymd(stockholmNow());
      const paidAccess = !!profile?.is_admin || (!!profile?.paid_until && profile.paid_until >= today);
      setHasPaidAccess(paidAccess);

      if (paidAccess) {
        const { data: kdaRow } = await supabase
          .from('daily_challenges')
          .select('id, list_id, game_lists ( title, subtitle )')
          .eq('challenge_date', today)
          .maybeSingle();
        if (kdaRow) setKanduallaChallenge(kdaRow);

        const { data: kartanRow } = await supabase
          .from('kartan_daily_challenges')
          .select('id, paket_id, kartan_paket ( namn )')
          .eq('challenge_date', today)
          .maybeSingle();
        if (kartanRow) setKartanChallenge(kartanRow);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) {
    return (
      <div className="wrap">
        <p className="subhead">Laddar…</p>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="topbar">
        {loggedIn ? (
          <>
            <div className="user">
              Inloggad som <b style={{ color: 'var(--amber-glow)' }}>{username}</b>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a className="btn btn-ghost" href="/profil">Min profil</a>
              <a className="btn btn-ghost" href="/topplistor">Topplistor</a>
              {isAdmin && <a className="btn btn-ghost" href="/admin">Admin</a>}
              <button className="btn btn-ghost" onClick={handleLogout}>Logga ut</button>
            </div>
          </>
        ) : (
          <>
            <div className="user">Testa gratisspelen nedan — inget konto behövs</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <a className="btn btn-ghost" href="/login">Logga in</a>
              <a className="btn btn-primary" style={{ width: 'auto' }} href="/signup">Skapa konto</a>
            </div>
          </>
        )}
      </div>

      <h1 className="brand" style={{ marginTop: 24 }}>Kan Du Alla</h1>
      <p style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', letterSpacing: '.03em', fontSize: 18, fontWeight: 600, color: 'var(--amber-glow)', margin: '0 0 24px' }}>
        Spelen som utmanar dig och dina vänner
      </p>

      {loggedIn && hasPaidAccess && (kanduallaChallenge || kartanChallenge) && (
        <div style={{ marginBottom: 36 }}>
          <p className="subhead" style={{ marginBottom: 10 }}>Dagens utmaningar</p>
          <div className="list-grid">
            {kanduallaChallenge && (
              <a
                href={`/daily/${kanduallaChallenge.id}`}
                className="plaque"
                style={{ textAlign: 'left', border: '1px solid var(--amber)' }}
              >
                <span className="tag">KAN DU ALLA</span>
                {kanduallaChallenge.game_lists?.title}
                {kanduallaChallenge.game_lists?.subtitle && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                    {kanduallaChallenge.game_lists.subtitle}
                  </div>
                )}
              </a>
            )}
            {kartanChallenge && (
              <a
                href={`/kartan?paket=${kartanChallenge.paket_id}`}
                className="plaque"
                style={{ textAlign: 'left', border: '1px solid var(--amber)' }}
              >
                <span className="tag">KARTAN</span>
                {kartanChallenge.kartan_paket?.namn}
              </a>
            )}
          </div>
        </div>
      )}

      {loggedIn && !hasPaidAccess && (
        <div className="upgrade-card" style={{ marginBottom: 36 }}>
          <span className="upgrade-badge">Medlemskap</span>
          <div className="upgrade-title">Dagens utmaningar väntar</div>
          <p className="subhead" style={{ marginBottom: 14 }}>
            Bli medlem för att låsa upp en ny utmaning varje speldag, i båda spelen.
          </p>
          <a className="btn btn-primary" href="/prenumerera" style={{ display: 'inline-block', width: 'auto' }}>
            Bli medlem
          </a>
        </div>
      )}

      <p className="subhead" style={{ marginBottom: 14 }}>Spelen</p>
      <div className="game-grid">
        <a href="/kandualla" className="game-card game-card-kandualla">
          <span className="game-card-eyebrow">SKRIV · GISSA · FYLL LISTAN</span>
          <span className="game-card-title">Kan Du Alla</span>
          <span className="game-card-desc">Gissa dig igenom ranglistor inom sport, geografi, historia och mer.</span>
        </a>
        <a href="/kartan" className="game-card game-card-kartan">
          <span className="game-card-eyebrow">KLICKA · GISSA · UPPTÄCK</span>
          <span className="game-card-title">Kartan</span>
          <span className="game-card-desc">Hitta rätt kommun eller pricka exakt plats på kartan — hur nära kommer du?</span>
        </a>
      </div>

      {!loggedIn && (
        <p className="subhead" style={{ textAlign: 'center', marginTop: 8 }}>
          Båda spelen har gratis smakprov — inget konto behövs för att testa.
        </p>
      )}

      <p style={{ textAlign: 'center', marginTop: 40, fontSize: 13, color: 'var(--muted)' }}>
        {loggedIn ? (
          <>Vill du skapa eller gå med i en liga? Det gör du under <a href="/profil" style={{ color: 'var(--amber-glow)' }}>Min profil</a>.</>
        ) : (
          <>Redan medlem? <a href="/login" style={{ color: 'var(--amber-glow)' }}>Logga in</a>.</>
        )}
      </p>
      <p style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
        <a href="/villkor" style={{ color: 'var(--muted)' }}>Villkor</a> ·{' '}
        <a href="/integritetspolicy" style={{ color: 'var(--muted)' }}>Integritetspolicy</a>
      </p>
    </div>
  );
}
