'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import { timeUntil, formatCountdown } from '../../lib/countdown';

function stockholmNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Stockholm' }));
}
function ymd(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
// Måndagen i samma vecka som ett givet datum (sträng 'YYYY-MM-DD')
function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const isoWeekday = ((d.getDay() + 6) % 7) + 1;
  d.setDate(d.getDate() - (isoWeekday - 1));
  return d;
}
// En utmaning avslöjas från och med LÖRDAG samma vecka (dvs efter att
// fredagens liv-fönster stängt och veckans två pass är klara).
function isRevealed(challengeDateStr) {
  const monday = mondayOf(challengeDateStr);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  const saturdayStr = ymd(saturday);
  const todayStr = ymd(stockholmNow());
  return todayStr >= saturdayStr;
}

export default function TopplistorPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState([]);
  const [scope, setScope] = useState('total'); // 'total' or league id
  const [totals, setTotals] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [activeChallengeId, setActiveChallengeId] = useState(null);
  const [challengeRows, setChallengeRows] = useState([]);
  const [challengeLoading, setChallengeLoading] = useState(false);

  const [needsPayment, setNeedsPayment] = useState(false);
  const [launchAt, setLaunchAt] = useState(null);
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!launchAt) return;
    const timer = setInterval(() => setRemaining(timeUntil(launchAt)), 1000);
    return () => clearInterval(timer);
  }, [launchAt]);

  async function loadTotals(scopeValue) {
    const { data, error } = await supabase.rpc('leaderboard_totals', {
      p_league_id: (scopeValue === 'total' || scopeValue === 'children') ? null : scopeValue,
      p_children_only: scopeValue === 'children'
    });
    if (!error) setTotals(data || []);
  }

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.push('/login'); return; }

      const uid = sessionData.session.user.id;

      const { data: profile } = await supabase.from('profiles').select('paid_until, is_admin').eq('id', uid).single();
      const todayStr = ymd(stockholmNow());
      const hasPaidAccess = !!profile?.is_admin || (!!profile?.paid_until && profile.paid_until >= todayStr);
      if (!hasPaidAccess) {
        setNeedsPayment(true);
        setLoading(false);
        return;
      }

      // Lanseringsnedräkning: helt separat spärr, oberoende av betalning.
      if (!profile?.is_admin) {
        const { data: settingsRow } = await supabase.from('app_settings').select('launch_at').eq('id', 1).single();
        if (settingsRow?.launch_at && timeUntil(settingsRow.launch_at)) {
          setLaunchAt(settingsRow.launch_at);
          setRemaining(timeUntil(settingsRow.launch_at));
          setLoading(false);
          return;
        }
      }

      const { data: memberships } = await supabase
        .from('league_members')
        .select('leagues(id, name, status)')
        .eq('user_id', uid);
      const activeLeagues = (memberships || [])
        .map(m => m.leagues)
        .filter(l => l && l.status === 'approved');
      setLeagues(activeLeagues);

      const { data: challengeRows } = await supabase
        .from('daily_challenges')
        .select('id, challenge_date, weekday')
        .lte('challenge_date', ymd(stockholmNow()))
        .order('challenge_date', { ascending: false })
        .limit(15);
      setChallenges(challengeRows || []);

      await loadTotals('total');
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleScopeChange(newScope) {
    setScope(newScope);
    await loadTotals(newScope);
  }

  async function openChallenge(id) {
    if (activeChallengeId === id) {
      setActiveChallengeId(null);
      return;
    }
    setActiveChallengeId(id);
    setChallengeLoading(true);
    const { data, error } = await supabase.rpc('leaderboard_for_challenge', {
      p_challenge_id: id,
      p_league_id: (scope === 'total' || scope === 'children') ? null : scope,
      p_children_only: scope === 'children'
    });
    if (!error) setChallengeRows(data || []);
    setChallengeLoading(false);
  }

  function formatTime(s) {
    const m = String(Math.floor(s / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${m}:${sec}`;
  }

  if (loading) {
    return <div className="wrap"><p className="subhead">Laddar…</p></div>;
  }

  if (launchAt) {
    return (
      <div className="wrap">
        <div className="topbar"><a className="btn btn-ghost" href="/">&larr; Alla spel</a></div>
        <div className="upgrade-card">
          <span className="upgrade-badge">Lanseras snart</span>
          <div className="upgrade-title">Topplistor öppnar om</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 36, color: 'var(--amber-glow)', margin: '10px 0 18px' }}>
            {remaining ? formatCountdown(remaining) : '00:00'}
          </div>
          <p className="subhead">
            Du är redan medlem — så fort klockan slår noll öppnas Topplistor automatiskt.
          </p>
        </div>
      </div>
    );
  }

  if (needsPayment) {
    return (
      <div className="wrap">
        <div className="topbar"><a className="btn btn-ghost" href="/">&larr; Alla spel</a></div>
        <div className="upgrade-card">
          <span className="upgrade-badge">Kräver medlemskap</span>
          <div className="upgrade-title">Lås upp Topplistor</div>
          <p className="subhead" style={{ marginBottom: 18 }}>Topplistor kräver ett betalt medlemskap.</p>
          <a href="/prenumerera" className="btn btn-primary" style={{ width: 'auto', padding: '13px 26px' }}>
            Bli medlem →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="btn btn-ghost" href="/">&larr; Alla spel</a>
      </div>

      <header style={{ marginBottom: 20 }}>
        <div className="eyebrow">Topplistor</div>
        <h1 className="brand" style={{ fontSize: 32 }}>Kan Du Alla</h1>
      </header>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button
          className="plaque"
          style={{ borderColor: scope === 'total' ? 'var(--amber)' : undefined, color: scope === 'total' ? 'var(--text)' : undefined }}
          onClick={() => handleScopeChange('total')}
        >
          Totalt (alla)
        </button>
        <button
          className="plaque"
          style={{ borderColor: scope === 'children' ? 'var(--amber)' : undefined, color: scope === 'children' ? 'var(--text)' : undefined }}
          onClick={() => handleScopeChange('children')}
        >
          Barn (12 år eller yngre)
        </button>
        {leagues.map(l => (
          <button
            key={l.id}
            className="plaque"
            style={{ borderColor: scope === l.id ? 'var(--amber)' : undefined, color: scope === l.id ? 'var(--text)' : undefined }}
            onClick={() => handleScopeChange(l.id)}
          >
            {l.name}
          </button>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: 18, marginBottom: 14 }}>
          Totalsammanställning
        </div>
        {totals.length === 0 && <p className="subhead">Inga resultat än.</p>}
        {totals.map((row, i) => (
          <div key={row.username} className="row" style={{ marginBottom: 6 }}>
            <div className="rank">{i + 1}</div>
            <div className="flap revealed">
              <span className="name">{row.username}</span>
              <span className="value">
                {row.total_points} p &middot; {row.challenges_played} spelade &middot; {row.full_clears} fullständiga
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="cat-title">Tidigare utmaningar</div>
      <p className="subhead" style={{ marginBottom: 14 }}>
        Ämnet visas från och med lördag samma vecka, när fredagens liv-fönster stängt.
      </p>

      <div style={{ marginBottom: 20 }}>
        {challenges.map(c => {
          const revealed = isRevealed(c.challenge_date);
          return (
            <div key={c.id} style={{ marginBottom: 8 }}>
              <button
                className="plaque"
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => openChallenge(c.id)}
              >
                <span className="tag">{c.challenge_date}</span>
                {revealed ? `${c.weekday[0].toUpperCase() + c.weekday.slice(1)}ens topplista` : `${c.weekday[0].toUpperCase() + c.weekday.slice(1)}ens topplista (ämne dolt än)`}
              </button>

              {activeChallengeId === c.id && (
                <div className="panel" style={{ marginTop: 8 }}>
                  {challengeLoading ? (
                    <p className="subhead">Laddar…</p>
                  ) : challengeRows.length === 0 ? (
                    <p className="subhead">Inga resultat än för det här passet.</p>
                  ) : (
                    <>
                      {challengeRows.filter(r => r.difficulty !== 'easy').map((row, i) => (
                        <div key={row.username + i} className="row" style={{ marginBottom: 6 }}>
                          <div className="rank">{i + 1}</div>
                          <div className="flap revealed">
                            <span className="name">{row.username}</span>
                            <span className="value">
                              {row.guessed}/{row.total} &middot; {formatTime(row.seconds)}{row.completed ? ' ✓' : ''}
                            </span>
                          </div>
                        </div>
                      ))}
                      {challengeRows.some(r => r.difficulty === 'easy') && (
                        <>
                          <div className="subhead" style={{ marginTop: 14, marginBottom: 6, fontSize: 12 }}>
                            Lätt-läge (räknas inte i topplistan)
                          </div>
                          {challengeRows.filter(r => r.difficulty === 'easy').map((row, i) => (
                            <div key={'easy-' + row.username + i} className="row" style={{ marginBottom: 6, opacity: 0.7 }}>
                              <div className="rank">—</div>
                              <div className="flap revealed">
                                <span className="name">{row.username}</span>
                                <span className="value">
                                  {row.guessed}/{row.total} &middot; {formatTime(row.seconds)}{row.completed ? ' ✓' : ''}
                                </span>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <footer className="site">Topplistorna uppdateras i realtid när ni spelar.</footer>
    </div>
  );
}
