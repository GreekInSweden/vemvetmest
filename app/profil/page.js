'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function ProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState('');
  const fileInputRef = useRef(null);

  const [pendingLeagues, setPendingLeagues] = useState([]);
  const [activeLeagues, setActiveLeagues] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [leagueName, setLeagueName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [leagueMsg, setLeagueMsg] = useState('');
  const [loading, setLoading] = useState(true);

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
      if (!sessionData.session) { router.push('/login'); return; }
      const uid = sessionData.session.user.id;
      setUserId(uid);

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', uid)
        .single();
      setUsername(profile?.username || '');
      setAvatarUrl(profile?.avatar_url || null);

      await loadLeagues(uid);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    if (!file.type.startsWith('image/')) {
      setAvatarMsg('Filen måste vara en bild.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setAvatarMsg('Bilden får max vara 3 MB.');
      return;
    }

    setUploading(true);
    setAvatarMsg('');

    const ext = file.name.split('.').pop();
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setUploading(false);
      setAvatarMsg('Kunde inte ladda upp: ' + uploadError.message);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
    // Cache-bust så den nya bilden syns direkt istället för en gammal cachad version
    const bustedUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    await supabase.from('profiles').update({ avatar_url: bustedUrl }).eq('id', userId);

    setAvatarUrl(bustedUrl);
    setUploading(false);
    setAvatarMsg('Profilbild uppdaterad!');
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

  if (loading) return <div className="wrap"><p className="subhead">Laddar…</p></div>;

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="btn btn-ghost" href="/">&larr; Alla spel</a>
      </div>

      <header style={{ marginBottom: 24 }}>
        <div className="eyebrow">Min profil</div>
        <h1 className="brand" style={{ fontSize: 32 }}>{username}</h1>
      </header>

      {/* ---- Profilbild ---- */}
      <div className="panel" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <div
          style={{
            width: 84, height: 84, borderRadius: '50%', overflow: 'hidden',
            background: 'var(--bg-2)', border: '2px solid var(--amber)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="Profilbild" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 32, color: 'var(--amber-glow)' }}>
              {username?.[0]?.toUpperCase() || '?'}
            </span>
          )}
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            style={{ display: 'none' }}
          />
          <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? 'Laddar upp…' : 'Byt profilbild'}
          </button>
          {avatarMsg && <div className="toast" style={{ marginTop: 6 }}>{avatarMsg}</div>}
        </div>
      </div>

      {/* ---- Ligor ---- */}
      <div className="cat-title">Mina privata ligor</div>
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

      {pendingLeagues.length === 0 && activeLeagues.length === 0 && (
        <p className="subhead">Du är inte med i någon liga än.</p>
      )}
    </div>
  );
}
