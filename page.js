'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

function stockholmNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Stockholm' }));
}
function ymd(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function Dashboard() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [categories, setCategories] = useState([]);
  const [lists, setLists] = useState([]);
  const [activeLeagues, setActiveLeagues] = useState([]);
  const [loading, setLoading] = useState(true);

  const [todayChallenge, setTodayChallenge] = useState(null);
  const [missedChallenges, setMissedChallenges] = useState([]);
  const [livesRemaining, setLivesRemaining] = useState(5);
  const [isWeekend, setIsWeekend] = useState(false);

  async function loadDailyChallenges(uid) {
    const now = stockholmNow();
    const isoWeekday = ((now.getDay() + 6) % 7) + 1;
    const todayStr = ymd(now);
    setIsWeekend(isoWeekday === 6 || isoWeekday === 7);

    const monday = new Date(now);
    monday.setDate(now.getDate() - (isoWeekday - 1));
    const mondayStr = ymd(monday);

    const { data: challenges } = await supabase
      .from('daily_challenges')
      .select('id, challenge_date, weekday')
      .gte('challenge_date', mondayStr)
      .lte('challenge_date', todayStr)
      .order('challenge_date');

    const rows = challenges || [];
    const ids = rows.map(c => c.id);

    let attemptedIds = new Set();
    if (ids.length) {
      const { data: attempts } = await supabase
        .from('daily_attempts')
        .select('daily_challenge_id')
        .eq('user_id', uid)
        .in('daily_challenge_id', ids);
      attemptedIds = new Set((attempts || []).map(a => a.daily_challenge_id));
    }

    const today = rows.find(c => c.challenge_date === todayStr);
    setTodayChallenge(today ? { ...today, attempted: attemptedIds.has(today.id) } : null);
    setMissedChallenges(rows.filter(c => c.challenge_date !== todayStr && !attemptedIds.has(c.id)));

    const yearStart = `${now.getFullYear()}-01-01`;
    const { count } = await supabase
      .from('daily_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('used_life', true)
      .gte('created_at', yearStart);
    setLivesRemaining(Math.max(0, 5 - (count || 0)));
  }

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.push('/login'); return; }
      const uid = sessionData.session.user.id;

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, is_admin')
        .eq('id', uid)
        .single();
      setUsername(profile?.username || '');
      setIsAdmin(!!profile?.is_admin);

      const { data: cats } = await supabase.from('categories').select('*').order('sort_order');
      const { data: gameLists } = await supabase
        .from('game_lists')
        .select('id, slug, title, subtitle, category_id')
        .eq('featured', true)
        .order('sort_order');
      setCategories(cats || []);
      setLists(gameLists || []);

      const { data: memberships } = await supabase
        .from('league_members')
        .select('leagues(id, name, status, invite_code)')
        .eq('user_id', uid);
      const rows = (memberships || []).map(m => m.leagues).filter(Boolean);
      setActiveLeagues(rows.filter(l => l.status === 'approved'));

      await loadDailyChallenges(uid);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) {
    return <div className="wrap"><p className="subhead">Laddar…</p></div>;
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="user">Inloggad som <b style={{ color: 'var(--amber-glow)' }}>{username}</b></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className="btn btn-ghost" href="/profil">Min profil</a>
          <a className="btn btn-ghost" href="/topplistor">Topplistor</a>
          {isAdmin && <a className="btn btn-ghost" href="/admin">Admin</a>}
          <button className="btn btn-ghost" onClick={handleLogout}>Logga ut</button>
        </div>
      </div>

      <header style={{ textAlign: 'center', marginBottom: 10 }}>
        <div className="eyebrow">Skriv &middot; Gissa &middot; Fyll listan</div>
        <h1 className="brand">Ranglistan</h1>
        <p className="subhead">Välj ett spel — fler kategorier och listor läggs till löpande.</p>
      </header>

      {/* ---- Kompakt genväg om man är med i en liga ---- */}
      {activeLeagues.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10 }}>
          {activeLeagues.map(l => (
            <a key={l.id} href="/profil" className="stat" style={{ textDecoration: 'none', color: 'var(--text)' }}>
              🏆 {l.name}
            </a>
          ))}
        </div>
      )}

      {/* ---- Dagens utmaning ---- */}
      {todayChallenge && (
        <>
          <div className="cat-title" style={{ marginTop: 30 }}>Dagens utmaning</div>
          <a
            href={todayChallenge.attempted ? '#' : `/daily/${todayChallenge.id}`}
            className="panel"
            style={{
              display: 'block', marginBottom: 20, textDecoration: 'none', color: 'inherit',
              border: '1px solid var(--amber)', cursor: todayChallenge.attempted ? 'default' : 'pointer'
            }}
            onClick={e => { if (todayChallenge.attempted) e.preventDefault(); }}
          >
            <div className="eyebrow">{todayChallenge.weekday} &middot; spelas bara idag</div>
            <div style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: 22, color: 'var(--amber-glow)', margin: '4px 0' }}>
              Dagens Utmaning
            </div>
            <div className="subhead">
              {todayChallenge.attempted ? 'Redan spelat idag ✓' : 'Ämnet avslöjas när du klickar in — ingen förhandstitt'}
            </div>
          </a>
        </>
      )}

      {/* ---- Missade pass (bara helg) ---- */}
      {isWeekend && missedChallenges.length > 0 && (
        <>
          <div className="cat-title">Missade pass denna vecka</div>
          <p className="subhead" style={{ marginBottom: 10 }}>
            Du har <b style={{ color: 'var(--amber-glow)' }}>{livesRemaining}</b> liv kvar i år.
          </p>
          <div className="list-grid" style={{ marginBottom: 20 }}>
            {missedChallenges.map(c => (
              <a
                key={c.id}
                href={livesRemaining > 0 ? `/daily/${c.id}` : '#'}
                className="plaque"
                style={{ opacity: livesRemaining > 0 ? 1 : 0.5, cursor: livesRemaining > 0 ? 'pointer' : 'default' }}
                onClick={e => { if (livesRemaining <= 0) e.preventDefault(); }}
              >
                <span className="tag">{c.weekday} &middot; {c.challenge_date}</span>
                {livesRemaining > 0 ? 'Missat pass — använd ett liv' : 'Missat pass'}
              </a>
            ))}
          </div>
        </>
      )}

      {/* ---- Spel (fritt spelbara övningslistor) ---- */}
      <div className="cat-title" style={{ marginTop: 30 }}>Övningsspel</div>
      {lists.length === 0 && (
        <p className="subhead" style={{ marginBottom: 20 }}>
          Inga övningsspel är valda att synas just nu.
        </p>
      )}
      {categories.map(cat => {
        const catLists = lists.filter(l => l.category_id === cat.id);
        if (catLists.length === 0) return null;
        return (
          <div key={cat.id}>
            <div className="cat-title">{cat.name}</div>
            <div className="list-grid">
              {catLists.map(l => (
                <a key={l.id} className="plaque" href={`/play/${l.slug}`}>
                  <span className="tag">{cat.name}</span>
                  {l.title}
                </a>
              ))}
            </div>
          </div>
        );
      })}

      <footer className="site">
        Vill du skapa eller gå med i en liga? Det gör du under <a href="/profil">Min profil</a>.
      </footer>
    </div>
  );
}
