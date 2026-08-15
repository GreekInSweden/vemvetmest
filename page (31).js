'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';
import QRCode from 'qrcode';
import { buildSwishLink, SWISH_NUMBER, EXTRA_LIFE_PRICE } from '../../lib/swish';

const TABS = [
  { key: 'installningar', label: 'Inställningar' },
  { key: 'ligor', label: 'Privata ligor' },
  { key: 'betalplan', label: 'Betalplan' },
  { key: 'kontakt', label: 'Kontakta oss' }
];

export default function ProfilePage() {
  const router = useRouter();
  const [tab, setTab] = useState('installningar');
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState('');
  const fileInputRef = useRef(null);
  const [difficulty, setDifficulty] = useState('hard');
  const [difficultyMsg, setDifficultyMsg] = useState('');
  const [isChild, setIsChild] = useState(false);
  const [childMsg, setChildMsg] = useState('');

  const [pendingLeagues, setPendingLeagues] = useState([]);
  const [activeLeagues, setActiveLeagues] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [leagueName, setLeagueName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [leagueMsg, setLeagueMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const [familyPlan, setFamilyPlan] = useState(null);
  const [familyCode, setFamilyCode] = useState('');
  const [familyMsg, setFamilyMsg] = useState('');
  const [showFamilyJoin, setShowFamilyJoin] = useState(false);

  const [hasChildPackage, setHasChildPackage] = useState(false);
  const [livesRemaining, setLivesRemaining] = useState(null);
  const [pendingLifePurchase, setPendingLifePurchase] = useState(null);
  const [showLifeQr, setShowLifeQr] = useState(false);
  const [lifeQrError, setLifeQrError] = useState('');
  const lifeCanvasRef = useRef(null);
  const [myChildPaidUntil, setMyChildPaidUntil] = useState(null);
  const [myChildren, setMyChildren] = useState([]);
  const [isParent, setIsParent] = useState(false);
  const [resetPasswordFor, setResetPasswordFor] = useState(null);
  const [newChildPassword, setNewChildPassword] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const [resetting, setResetting] = useState(false);

  // ---- Kontakta oss ----
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [contactMsg, setContactMsg] = useState('');
  const [sending, setSending] = useState(false);

  async function loadLives(uid) {
    const yearStart = `${new Date().getFullYear()}-01-01`;
    const { count: usedCount } = await supabase
      .from('daily_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('used_life', true)
      .gte('created_at', yearStart);
    const { count: purchasedCount } = await supabase
      .from('life_purchases')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('activated', true)
      .gte('created_at', yearStart);
    setLivesRemaining(Math.max(0, 5 + (purchasedCount || 0) - (usedCount || 0)));

    const { data: pending } = await supabase
      .from('life_purchases')
      .select('id, created_at')
      .eq('user_id', uid)
      .eq('activated', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setPendingLifePurchase(pending || null);
  }

  async function requestExtraLife() {
    if (!userId) return;
    const { error } = await supabase.from('life_purchases').insert({ user_id: userId });
    if (error) return;
    setShowLifeQr(true);
    await loadLives(userId);
  }

  async function loadChildPackages(uid) {
    const { data: myProfile } = await supabase.from('profiles').select('child_package_id').eq('id', uid).single();
    setHasChildPackage(!!myProfile?.child_package_id);
    if (myProfile?.child_package_id) {
      const { data: myPkg } = await supabase.from('child_packages').select('paid_until').eq('id', myProfile.child_package_id).single();
      setMyChildPaidUntil(myPkg?.paid_until || null);
    }

    const { data: parentOf } = await supabase
      .from('child_packages')
      .select('id, child_username_requested, activated, child_profile_id, paid_until')
      .eq('parent_id', uid);
    setIsParent((parentOf || []).length > 0);
    setMyChildren(parentOf || []);
  }

  async function loadFamilyPlan(uid) {
    const { data: membership } = await supabase
      .from('family_plan_members')
      .select('family_plan_id, family_plans(id, owner_id, invite_code, max_members)')
      .eq('user_id', uid)
      .maybeSingle();

    if (!membership?.family_plans) { setFamilyPlan(null); return; }

    const { count } = await supabase
      .from('family_plan_members')
      .select('user_id', { count: 'exact', head: true })
      .eq('family_plan_id', membership.family_plans.id);

    setFamilyPlan({
      inviteCode: membership.family_plans.invite_code,
      isOwner: membership.family_plans.owner_id === uid,
      memberCount: count || 1,
      maxMembers: membership.family_plans.max_members
    });
  }

  async function loadLeagues(uid) {
    const { data: memberships } = await supabase
      .from('league_members')
      .select('leagues(id, name, status, invite_code)')
      .eq('user_id', uid);
    const rows = (memberships || []).map(m => m.leagues).filter(Boolean);
    setPendingLeagues(rows.filter(l => l.status === 'pending'));
    setActiveLeagues(rows.filter(l => l.status === 'approved'));
  }

  async function loadMessages(uid) {
    const { data } = await supabase
      .from('support_messages')
      .select('id, message, admin_reply, status, created_at, replied_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    setMessages(data || []);
  }

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.push('/login'); return; }
      const uid = sessionData.session.user.id;
      setUserId(uid);

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url, difficulty, is_child')
        .eq('id', uid)
        .single();
      setUsername(profile?.username || '');
      setAvatarUrl(profile?.avatar_url || null);
      setDifficulty(profile?.difficulty || 'hard');
      setIsChild(!!profile?.is_child);

      await loadLeagues(uid);
      await loadFamilyPlan(uid);
      await loadChildPackages(uid);
      await loadLives(uid);
      await loadMessages(uid);
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
    const bustedUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    await supabase.from('profiles').update({ avatar_url: bustedUrl }).eq('id', userId);

    setAvatarUrl(bustedUrl);
    setUploading(false);
    setAvatarMsg('Profilbild uppdaterad!');
  }

  async function handleSetDifficulty(level) {
    setDifficulty(level);
    setDifficultyMsg('');
    const { error } = await supabase.from('profiles').update({ difficulty: level }).eq('id', userId);
    if (error) {
      setDifficultyMsg('Kunde inte spara: ' + error.message);
      return;
    }
    setDifficultyMsg('Sparat!');
  }

  async function handleToggleChild() {
    const next = !isChild;
    setIsChild(next);
    setChildMsg('');
    const { error } = await supabase.from('profiles').update({ is_child: next }).eq('id', userId);
    if (error) {
      setChildMsg('Kunde inte spara: ' + error.message);
      setIsChild(!next);
      return;
    }
    setChildMsg('Sparat!');
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

  async function handleJoinFamilyPlan(e) {
    e.preventDefault();
    setFamilyMsg('');
    const code = familyCode.trim();
    if (!code) return;
    const { error } = await supabase.rpc('join_family_plan', { p_code: code });
    if (error) {
      setFamilyMsg(error.message.includes('full') ? 'Familjeplanen är redan full.' : 'Ogiltig kod.');
      return;
    }
    setFamilyCode('');
    setShowFamilyJoin(false);
    setFamilyMsg('Du är nu med i familjeplanen!');
    await loadFamilyPlan(userId);
  }

  async function handleResetChildPassword(e) {
    e.preventDefault();
    setResetMsg('');
    if (newChildPassword.length < 6) {
      setResetMsg('Lösenordet måste vara minst 6 tecken.');
      return;
    }
    setResetting(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const res = await fetch('/api/reset-child-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ childProfileId: resetPasswordFor, newPassword: newChildPassword })
    });
    const result = await res.json();
    setResetting(false);

    if (!res.ok) {
      setResetMsg(result.error || 'Något gick fel.');
      return;
    }
    setResetMsg('Klart! Nytt lösenord satt.');
    setNewChildPassword('');
    setResetPasswordFor(null);
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    setContactMsg('');
    const text = newMessage.trim();
    if (text.length < 5) {
      setContactMsg('Skriv gärna lite mer så vi förstår vad det gäller.');
      return;
    }
    setSending(true);
    const { error } = await supabase.from('support_messages').insert({ user_id: userId, message: text });
    setSending(false);
    if (error) {
      setContactMsg('Kunde inte skicka: ' + error.message);
      return;
    }
    setNewMessage('');
    setContactMsg('Skickat! Vi svarar här så fort vi kan.');
    await loadMessages(userId);
  }

  const safeUsernameForLife = username ? username.replace(/[^a-zA-Z0-9-]/g, '-') : null;
  const lifeMessage = safeUsernameForLife ? `KDA-${safeUsernameForLife}-LIV` : null;
  const lifeSwishLink = lifeMessage
    ? buildSwishLink({ payeeNumber: SWISH_NUMBER, amount: EXTRA_LIFE_PRICE, message: lifeMessage, editableFields: [] })
    : null;

  useEffect(() => {
    if (!showLifeQr || !lifeSwishLink || !lifeCanvasRef.current) return;
    setLifeQrError('');
    QRCode.toCanvas(lifeCanvasRef.current, lifeSwishLink, { width: 200, margin: 4, errorCorrectionLevel: 'M' }, (err) => {
      if (err) setLifeQrError('Kunde inte rita QR-koden: ' + err.message);
    });
  }, [showLifeQr, lifeSwishLink]);

  if (loading) return <div className="wrap"><p className="subhead">Laddar…</p></div>;

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="btn btn-ghost" href="/">&larr; Alla spel</a>
      </div>

      <header style={{ marginBottom: 20 }}>
        <div className="eyebrow">Min profil</div>
        <h1 className="brand" style={{ fontSize: 32 }}>{username}</h1>
      </header>

      {/* ---- Flikmeny ---- */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            className="plaque"
            style={{
              borderColor: tab === t.key ? 'var(--amber)' : undefined,
              color: tab === t.key ? 'var(--text)' : undefined
            }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ================= INSTÄLLNINGAR ================= */}
      {tab === 'installningar' && (
        <>
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

          <div className="cat-title" style={{ marginTop: 0 }}>Min svårighetsgrad</div>
          <p className="subhead" style={{ marginBottom: 10 }}>
            Gäller för allt du spelar framöver. <b style={{ color: 'var(--amber-glow)' }}>Lätt</b> räknas
            inte med i topplistorna men syns tydligt märkt i resultaten — perfekt för yngre spelare
            eller en avslappnad kväll.
          </p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            {[
              { key: 'hard', label: 'Svår', desc: 'Som idag, inga ledtrådar' },
              { key: 'medium', label: 'Medel', desc: 'Ledtrådar kostar ett fel' },
              { key: 'easy', label: 'Lätt', desc: 'Gratis ledtrådar, mer tid' }
            ].map(opt => (
              <button
                key={opt.key}
                className="plaque"
                style={{
                  flex: '1 1 160px', textAlign: 'center',
                  borderColor: difficulty === opt.key ? 'var(--amber)' : undefined,
                  color: difficulty === opt.key ? 'var(--text)' : undefined
                }}
                onClick={() => handleSetDifficulty(opt.key)}
              >
                <div style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: 15 }}>{opt.label}</div>
                <div className="subhead" style={{ fontSize: 11, marginTop: 2 }}>{opt.desc}</div>
              </button>
            ))}
          </div>
          {difficultyMsg && <div className="toast" style={{ marginBottom: 10 }}>{difficultyMsg}</div>}

          <div className="cat-title" style={{ marginTop: 30 }}>Ålder</div>
          <button
            className="plaque"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
              borderColor: isChild ? 'var(--amber)' : undefined
            }}
            onClick={handleToggleChild}
          >
            <input type="checkbox" checked={isChild} onChange={() => {}} style={{ width: 16, height: 16, accentColor: 'var(--amber)', pointerEvents: 'none' }} />
            Jag är 12 år eller yngre
          </button>
          <p className="subhead" style={{ fontSize: 12.5 }}>
            Ger tillgång till en egen topplista bland andra barn i "Topplistor" — man tävlar inte
            bara mot vuxna i familjen.
          </p>
          {childMsg && <div className="toast" style={{ marginTop: 6 }}>{childMsg}</div>}
        </>
      )}

      {/* ================= PRIVATA LIGOR ================= */}
      {tab === 'ligor' && (
        <>
          <div className="cat-title" style={{ marginTop: 0 }}>Mina privata ligor</div>
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
                  <div key={l.id} className="plaque" style={{ cursor: 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
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
        </>
      )}

      {/* ================= BETALPLAN ================= */}
      {tab === 'betalplan' && (
        <>
          <div className="cat-title" style={{ marginTop: 0 }}>Familjeplan</div>

          {familyPlan ? (
            <div className="plaque" style={{ cursor: 'default', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
              <span>
                <span className="tag">{familyPlan.isOwner ? 'Ägare' : 'Medlem'}</span>
                {familyPlan.memberCount} / {familyPlan.maxMembers} platser använda
              </span>
              {familyPlan.isOwner && (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--amber-glow)' }}>{familyPlan.inviteCode}</span>
              )}
            </div>
          ) : (
            <>
              <p className="subhead" style={{ marginBottom: 10 }}>
                Du är inte med i någon familjeplan. Har någon i din familj redan köpt en och
                skickat dig en kod?
              </p>
              <button className="plaque" style={{ marginBottom: 10 }} onClick={() => { setShowFamilyJoin(s => !s); setFamilyMsg(''); }}>
                Lös in familjekod
              </button>
              {showFamilyJoin && (
                <form onSubmit={handleJoinFamilyPlan} className="panel" style={{ marginBottom: 16 }}>
                  <input
                    className="field"
                    type="text"
                    placeholder="Kod, t.ex. N57R6Y"
                    value={familyCode}
                    onChange={e => setFamilyCode(e.target.value)}
                    style={{ textTransform: 'uppercase' }}
                  />
                  <button className="btn btn-primary" type="submit">Gå med</button>
                </form>
              )}
              <p className="subhead" style={{ fontSize: 12.5 }}>
                Ingen egen familjeplan än? Läs mer på <a href="/prenumerera">prenumerationssidan</a>.
              </p>
            </>
          )}
          {familyMsg && <div className="toast" style={{ marginTop: 4 }}>{familyMsg}</div>}

          <div className="cat-title" style={{ marginTop: 34 }}>Barnpaket</div>

          {hasChildPackage && (
            <p className="subhead" style={{ marginBottom: 14 }}>
              {myChildPaidUntil && myChildPaidUntil >= new Date().toISOString().slice(0, 10)
                ? <>✓ Barnpaketet är aktivt till och med <b style={{ color: 'var(--amber-glow)' }}>{myChildPaidUntil}</b>.</>
                : <>Barnpaketet har gått ut{myChildPaidUntil ? ` (${myChildPaidUntil})` : ''} — be din förälder förnya det.</>}
            </p>
          )}

          {!isParent && !hasChildPackage && (
            <p className="subhead" style={{ marginBottom: 14 }}>
              Inget barnpaket kopplat till det här kontot. Vill du köpa ett åt ditt barn?{' '}
              <a href="/prenumerera">Läs mer här</a>.
            </p>
          )}

          {isParent && (
            <>
              <p className="subhead" style={{ marginBottom: 10 }}>Barnkonton du skapat:</p>
              {myChildren.map(c => {
                const childActive = c.paid_until && c.paid_until >= new Date().toISOString().slice(0, 10);
                return (
                <div key={c.id} className="panel" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, textTransform: 'uppercase' }}>
                        {c.child_username_requested}
                      </span>{' '}
                      {!c.activated
                        ? <span className="tag" style={{ background: '#3a2c1a', color: '#e0b37f' }}>Väntar på betalning</span>
                        : childActive
                          ? <span className="tag" style={{ background: '#2a3f2a', color: '#7fc98f' }}>Aktivt t.o.m. {c.paid_until}</span>
                          : <span className="tag" style={{ background: '#3a1a1a', color: '#e09090' }}>Har gått ut — förnya i admin</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {c.activated && (
                        <a href={`/profil/barnstatistik/${c.child_profile_id}`} className="btn btn-ghost" style={{ width: 'auto', padding: '6px 12px', fontSize: 12.5 }}>
                          Se statistik →
                        </a>
                      )}
                      <button
                        className="btn btn-ghost"
                        style={{ width: 'auto', padding: '6px 12px', fontSize: 12.5 }}
                        onClick={() => { setResetPasswordFor(c.child_profile_id); setResetMsg(''); setNewChildPassword(''); }}
                      >
                        Sätt nytt lösenord
                      </button>
                    </div>
                  </div>

                  {resetPasswordFor === c.child_profile_id && (
                    <form onSubmit={handleResetChildPassword} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                      <input
                        className="field"
                        type="password"
                        placeholder="Nytt lösenord (minst 6 tecken)"
                        value={newChildPassword}
                        onChange={e => setNewChildPassword(e.target.value)}
                        style={{ marginBottom: 8 }}
                      />
                      <button className="btn btn-primary" type="submit" disabled={resetting}>
                        {resetting ? 'Sparar…' : 'Spara nytt lösenord'}
                      </button>
                    </form>
                  )}
                </div>
                );
              })}
            </>
          )}
          {resetMsg && <div className="toast" style={{ marginTop: 4 }}>{resetMsg}</div>}

          <div className="cat-title" style={{ marginTop: 34 }}>Liv — missade utmaningar</div>
          <p className="subhead" style={{ marginBottom: 10 }}>
            Missar du Dagens utmaning en dag kan du spela den i efterhand på fredagen samma vecka,
            om du har liv kvar. Fem liv ingår varje kalenderår.
          </p>
          {livesRemaining !== null && (
            <p style={{ marginBottom: 14, fontSize: 15 }}>
              Du har <b style={{ color: livesRemaining > 0 ? 'var(--amber-glow)' : 'var(--miss)' }}>{livesRemaining}</b> liv kvar i år.
            </p>
          )}

          {pendingLifePurchase ? (
            <p className="subhead" style={{ fontSize: 12.5 }}>
              Ett köp av extra liv väntar på aktivering — hör av dig om det dröjer.
            </p>
          ) : !showLifeQr ? (
            <button className="plaque" onClick={() => setShowLifeQr(true)}>
              Köp ett extra liv ({EXTRA_LIFE_PRICE} kr)
            </button>
          ) : (
            <div className="panel" style={{ maxWidth: 280 }}>
              <p className="subhead" style={{ fontSize: 12.5, marginBottom: 10 }}>
                Skanna med Swish-appen för att köpa ett extra liv. Meddelandet är redan ifyllt.
              </p>
              <canvas ref={lifeCanvasRef} width={200} height={200} style={{ display: 'block', margin: '0 auto' }} />
              {lifeQrError && <p className="error-msg" style={{ fontSize: 12 }}>{lifeQrError}</p>}
              <p className="subhead" style={{ fontSize: 11, marginTop: 10, marginBottom: 12 }}>
                Aktiveras manuellt av oss inom kort efter att betalningen registrerats.
              </p>
              <button className="btn btn-primary" onClick={requestExtraLife}>
                Jag har swishat — registrera köpet
              </button>
            </div>
          )}
        </>
      )}

      {/* ================= KONTAKTA OSS ================= */}
      {tab === 'kontakt' && (
        <>
          <div className="cat-title" style={{ marginTop: 0 }}>Kontakta oss</div>
          <p className="subhead" style={{ marginBottom: 14 }}>
            Har du en fråga, hittat något konstigt i ett spel, eller undrar över ditt medlemskap?
            Skriv till oss här — vi svarar direkt i den här listan.
          </p>

          <form onSubmit={handleSendMessage} className="panel" style={{ marginBottom: 20 }}>
            <textarea
              className="field"
              rows={4}
              placeholder="Skriv din fråga här…"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              style={{ marginBottom: 10, resize: 'vertical' }}
            />
            <button className="btn btn-primary" type="submit" disabled={sending}>
              {sending ? 'Skickar…' : 'Skicka meddelande'}
            </button>
          </form>
          {contactMsg && <div className="toast" style={{ marginBottom: 20 }}>{contactMsg}</div>}

          {messages.length === 0 ? (
            <p className="subhead">Du har inte skickat något meddelande än.</p>
          ) : (
            <>
              <div className="cat-title" style={{ fontSize: 14 }}>Dina meddelanden</div>
              {messages.map(m => (
                <div key={m.id} className="panel" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                    <span className="tag" style={m.status === 'answered' ? { background: '#2a3f2a', color: '#7fc98f' } : { background: '#3a2c1a', color: '#e0b37f' }}>
                      {m.status === 'answered' ? 'Besvarat' : 'Väntar på svar'}
                    </span>
                    <span className="subhead" style={{ fontSize: 11 }}>{new Date(m.created_at).toLocaleString('sv-SE')}</span>
                  </div>
                  <p style={{ marginBottom: m.admin_reply ? 12 : 0, whiteSpace: 'pre-wrap' }}>{m.message}</p>
                  {m.admin_reply && (
                    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10 }}>
                      <span className="subhead" style={{ fontSize: 11, color: 'var(--amber-glow)', display: 'block', marginBottom: 4 }}>
                        Vårt svar:
                      </span>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{m.admin_reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
