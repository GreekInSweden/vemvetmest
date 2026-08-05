'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [categories, setCategories] = useState([]);
  const [lists, setLists] = useState([]);
  const [pendingLeagues, setPendingLeagues] = useState([]);
  const [activeLeagues, setActiveLeagues] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [leagueName, setLeagueName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [leagueMsg, setLeagueMsg] = useState('');

  async function loadLeagues(uid) {
    const { data: memberships } = await supabase
      .from('league_members')
      .select('leagues(id, name, status, invite_code)')
      .eq('user_id', uid);

    const rows = (memberships || []).map(m => m.leagues).filter(Boolean);
    setPendingLeagues(rows.filter(l => l.status === 'pending'));
    setActiveLeagues(rows.filter(l => l.status === 'approved'));
  }

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        return;
      }

      const uid = sessionData.session.user.id;
      setUserId(uid);

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
        .order('sort_order');

      setCategories(cats || []);
      setLists(gameLists || []);

      await loadLeagues(uid);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function handleCreateLeague(e) {
    e.preventDefault();
    setLeagueMsg('');
    const name = leagueName.trim();
    if (name.length < 3) {
      setLeagueMsg('Namnet måste vara minst 3 tecken.');
      return;
    }
    const { error } = await supabase.from('leagues').insert({ name, owner_id: userId });
    if (error) {
      setLeagueMsg('Kunde inte skapa liga: ' + error.message);
      return;
    }
    setLeagueName('');
    setShowCreate(false);
    setLeagueMsg('Liga skickad för godkännande!');
    await loadLeagues(userId);
  }

  async function handleJoinLeague(e) {
    e.preventDefault();
    setLeagueMsg('');
    const code = joinCode.trim();
    if (!code) return;
    const { data, error } = await supabase.rpc('join_league', { p_code: code });
    if (error) {
      setLeagueMsg('Ogiltig eller ej godkänd kod.');
      return;
    }
    setJoinCode('');
    setShowJoin(false);
    setLeagueMsg(`Du gick med i "${data?.[0]?.league_name || 'ligan'}"!`);
    await loadLeagues(userId);
  }

  if (loading) {
    return <div className="wrap"><p className="subhead">Laddar…</p></div>;
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="user">Inloggad som <b style={{ color: 'var(--amber-glow)' }}>{username}</b></div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && <a className="btn btn-ghost" href="/admin">Admin</a>}
          <button className="btn btn-ghost" onClick={handleLogout}>Logga ut</button>
        </div>
      </div>

      <header style={{ textAlign: 'center', marginBottom: 10 }}>
        <div className="eyebrow">Skriv &middot; Gissa &middot; Fyll listan</div>
        <h1 className="brand">Ranglistan</h1>
        <p className="subhead">Välj ett spel — fler kategorier och listor läggs till löpande.</p>
      </header>

      {/* ---- Ligor ---- */}
      <div className="cat-title" style={{ marginTop: 34 }}>Mina privata ligor</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <button className="plaque" style={{ flex: '1 1 160px', textAlign: 'center' }} onClick={() => { setShowCreate(s => !s); setShowJoin(false); setLeagueMsg(''); }}>
          + Skapa liga
        </button>
        <button className="plaque" style={{ flex: '1 1 160px', textAlign: 'center' }} onClick={() => { setShowJoin(s => !s); setShowCreate(false); setLeagueMsg(''); }}>
          Gå med med kod
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreateLeague} className="panel" style={{ marginBottom: 16 }}>
          <input
            className="field"
            type="text"
            placeholder="Namn på ligan, t.ex. Kontoret Fredagsfika"
            value={leagueName}
            onChange={e => setLeagueName(e.target.value)}
          />
          <button className="btn btn-primary" type="submit">Skicka för godkännande</button>
        </form>
      )}
      {showJoin && (
        <form onSubmit={handleJoinLeague} className="panel" style={{ marginBottom: 16 }}>
          <input
            className="field"
            type="text"
            placeholder="Kod, t.ex. N57R6Y"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value)}
            style={{ textTransform: 'uppercase' }}
          />
          <button className="btn btn-primary" type="submit">Gå med</button>
        </form>
      )}
      {leagueMsg && <div className="toast" style={{ marginBottom: 10 }}>{leagueMsg}</div>}

      {pendingLeagues.length > 0 && (
        <>
          <div className="subhead" style={{ marginBottom: 8 }}>Väntar på godkännande ({pendingLeagues.length})</div>
          <div className="list-grid" style={{ marginBottom: 18 }}>
            {pendingLeagues.map(l => (
              <div key={l.id} className="plaque" style={{ cursor: 'default' }}>
                <span className="tag">Väntar</span>
                {l.name}
              </div>
            ))}
          </div>
        </>
      )}

      {activeLeagues.length > 0 && (
        <>
          <div className="subhead" style={{ marginBottom: 8 }}>Aktiva grupper ({activeLeagues.length})</div>
          <div className="list-grid" style={{ marginBottom: 10 }}>
            {activeLeagues.map(l => (
              <div key={l.id} className="plaque" style={{ cursor: 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  <span className="tag">Aktiv</span>
                  {l.name}
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--amber-glow)' }}>{l.invite_code}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ---- Spel ---- */}
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

      <footer className="site">Fler listor på gång — samma spel, nya frågor.</footer>
    </div>
  );
}
