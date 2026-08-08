'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

import { PLAN_PRICES, COMPANY_PRICE_PER_SEAT, COMPANY_MIN_SEATS } from '../../lib/swish';

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(null);
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  const [categories, setCategories] = useState([]);
  const [games, setGames] = useState([]);
  const [checked, setChecked] = useState(new Set());
  const [checkedMember, setCheckedMember] = useState(new Set());
  const [checkedPool, setCheckedPool] = useState(new Set());
  const [openFolder, setOpenFolder] = useState(null); // 'featured' | 'member' | 'pool' | 'untested' | null
  const [showLeagues, setShowLeagues] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [launchMsg, setLaunchMsg] = useState('');
  const [dailyUsage, setDailyUsage] = useState({});
  const [showPool, setShowPool] = useState(false);
  const [gameStats, setGameStats] = useState([]);
  const [showStats, setShowStats] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsOnlyFeatured, setStatsOnlyFeatured] = useState(true);
  const [distribution, setDistribution] = useState({});
  const [openDistributionId, setOpenDistributionId] = useState(null);
  const [gamesMsg, setGamesMsg] = useState('');
  const [savingGames, setSavingGames] = useState(false);

  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentResults, setPaymentResults] = useState([]);
  const [paymentSearching, setPaymentSearching] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState('');
  const [companySeats, setCompanySeats] = useState({});

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.push('/login');
      return;
    }
    const userId = sessionData.session.user.id;

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (!profile?.is_admin) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setIsAdmin(true);

    const { data: settings } = await supabase.from('app_settings').select('daily_pool_launched').eq('id', 1).single();
    setLaunched(!!settings?.daily_pool_launched);

    const { data: pendingLeagues } = await supabase
      .from('leagues')
      .select('*')
      .eq('status', 'pending')
      .order('created_at');
    const { data: approvedLeagues } = await supabase
      .from('leagues')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(20);

    setPending(pendingLeagues || []);
    if (pendingLeagues && pendingLeagues.length > 0) setShowLeagues(true);
    setApproved(approvedLeagues || []);

    const { data: cats } = await supabase.from('categories').select('*').order('sort_order');
    const { data: gameLists } = await supabase
      .from('game_lists')
      .select('id, slug, title, category_id, featured, member_exclusive, daily_pool')
      .order('sort_order');

    setCategories(cats || []);
    setGames(gameLists || []);
    setChecked(new Set((gameLists || []).filter(g => g.featured).map(g => g.id)));
    setCheckedMember(new Set((gameLists || []).filter(g => g.member_exclusive).map(g => g.id)));
    setCheckedPool(new Set((gameLists || []).filter(g => g.daily_pool).map(g => g.id)));

    // Dagens utmaning-poolen: hur många gånger varje spel (som inte är
    // medlemsspel) redan använts som Dagens utmaning, så man kan följa
    // rotationen istället för att bara lita på att cron-jobbet sköter sig.
    const { data: usedRows } = await supabase.from('daily_challenges').select('list_id, challenge_date');
    const usageMap = {};
    (usedRows || []).forEach(r => {
      if (!usageMap[r.list_id]) usageMap[r.list_id] = { count: 0, lastUsed: null };
      usageMap[r.list_id].count += 1;
      if (!usageMap[r.list_id].lastUsed || r.challenge_date > usageMap[r.list_id].lastUsed) {
        usageMap[r.list_id].lastUsed = r.challenge_date;
      }
    });
    setDailyUsage(usageMap);

    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function approve(id) {
    setMsg('');
    const { error } = await supabase.from('leagues').update({ status: 'approved' }).eq('id', id);
    if (error) { setMsg('Kunde inte godkänna: ' + error.message); return; }
    load();
  }

  async function reject(id) {
    setMsg('');
    const { error } = await supabase.from('leagues').update({ status: 'rejected' }).eq('id', id);
    if (error) { setMsg('Kunde inte neka: ' + error.message); return; }
    load();
  }

  async function remove(id, name) {
    if (!window.confirm(`Ta bort ligan "${name}" permanent? Alla medlemskap tas bort samtidigt.`)) return;
    setMsg('');
    const { error } = await supabase.from('leagues').delete().eq('id', id);
    if (error) { setMsg('Kunde inte ta bort: ' + error.message); return; }
    load();
  }

  function toggleGame(id) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleMemberGame(id) {
    setCheckedMember(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function togglePoolGame(id) {
    setCheckedPool(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function saveGames() {
    setSavingGames(true);
    setGamesMsg('');
    const allIds = games.map(g => g.id);

    const updates = [
      ['featured', checked],
      ['member_exclusive', checkedMember],
      ['daily_pool', checkedPool]
    ];

    for (const [column, set] of updates) {
      const onIds = allIds.filter(id => set.has(id));
      const offIds = allIds.filter(id => !set.has(id));
      if (onIds.length > 0) await supabase.from('game_lists').update({ [column]: true }).in('id', onIds);
      if (offIds.length > 0) await supabase.from('game_lists').update({ [column]: false }).in('id', offIds);
    }

    setSavingGames(false);
    setGamesMsg(`Sparat! ${checked.size} synliga, ${checkedMember.size} medlemsspel, ${checkedPool.size} i Dagens utmaning-poolen.`);
    setGames(prev => prev.map(g => ({
      ...g,
      featured: checked.has(g.id),
      member_exclusive: checkedMember.has(g.id),
      daily_pool: checkedPool.has(g.id)
    })));
  }

  async function removeGame(id, title) {
    if (!window.confirm(`Ta bort spelet "${title}" permanent? Detta tar även bort eventuell historik om spelet någon gång använts som Dagens Utmaning. Går inte att ångra.`)) return;
    setGamesMsg('');
    const { error } = await supabase.from('game_lists').delete().eq('id', id);
    if (error) {
      setGamesMsg('Kunde inte ta bort: ' + error.message);
      return;
    }
    setGames(prev => prev.filter(g => g.id !== id));
    setChecked(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setGamesMsg(`"${title}" borttaget.`);
  }

  async function searchPayments(e) {
    e.preventDefault();
    setPaymentMsg('');
    const term = paymentSearch.trim();
    if (!term) { setPaymentResults([]); return; }
    setPaymentSearching(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, paid_until, is_child')
      .ilike('username', `%${term}%`)
      .limit(20);
    setPaymentSearching(false);
    if (error) {
      setPaymentMsg('Sökning misslyckades: ' + error.message);
      return;
    }
    setPaymentResults(data || []);
  }

  async function toggleLaunch() {
    const next = !launched;
    if (next) {
      const ok = window.confirm(
        'Aktivera Dagens utmaning-poolen? Från nästa körning av cron-jobbet (mån/ons) börjar riktiga utmaningar slumpas fram från poolen. Går att stänga av igen om något känns fel.'
      );
      if (!ok) return;
    }
    setLaunchMsg('');
    const { error } = await supabase
      .from('app_settings')
      .update({ daily_pool_launched: next, launched_at: next ? new Date().toISOString() : null })
      .eq('id', 1);
    if (error) {
      setLaunchMsg('Kunde inte ändra: ' + error.message);
      return;
    }
    setLaunched(next);
    setLaunchMsg(next ? 'Aktiverat! Dagens utmaning börjar köras vid nästa cron-körning.' : 'Avstängt igen — inga nya utmaningar skapas.');
  }

  async function markPaid(userId, planKey) {
    setPaymentMsg('');
    const days = PLAN_PRICES[planKey].days;
    const paidUntil = new Date();
    paidUntil.setDate(paidUntil.getDate() + days);
    const paidUntilStr = paidUntil.toISOString().slice(0, 10);

    const { error } = await supabase.from('profiles').update({ paid_until: paidUntilStr }).eq('id', userId);
    if (error) {
      setPaymentMsg('Kunde inte markera betald: ' + error.message);
      return;
    }

    if (planKey === 'family') {
      const { data: existing } = await supabase
        .from('family_plans')
        .select('id')
        .eq('owner_id', userId)
        .maybeSingle();
      if (!existing) {
        const { error: famError } = await supabase.from('family_plans').insert({ owner_id: userId });
        if (famError) {
          setPaymentMsg('Betald markerad, men kunde inte skapa familjeplan: ' + famError.message);
        }
      }
    }

    setPaymentResults(prev => prev.map(p => p.id === userId ? { ...p, paid_until: paidUntilStr } : p));
    setPaymentMsg(`Markerad betald till och med ${paidUntilStr}.`);
  }

  async function loadGameStats() {
    setStatsLoading(true);
    const { data, error } = await supabase.rpc('game_play_stats');
    if (!error) setGameStats(data || []);
    setStatsLoading(false);
  }

  async function toggleDistribution(listId) {
    if (openDistributionId === listId) {
      setOpenDistributionId(null);
      return;
    }
    setOpenDistributionId(listId);
    if (!distribution[listId]) {
      const { data, error } = await supabase.rpc('game_score_distribution', { p_list_id: listId });
      if (!error) setDistribution(prev => ({ ...prev, [listId]: data || [] }));
    }
  }

  async function markPaidCompany(userId, username) {
    setPaymentMsg('');
    const seats = Math.max(COMPANY_MIN_SEATS, parseInt(companySeats[userId] || COMPANY_MIN_SEATS, 10));
    const price = seats * COMPANY_PRICE_PER_SEAT;

    const paidUntil = new Date();
    paidUntil.setDate(paidUntil.getDate() + 366);
    const paidUntilStr = paidUntil.toISOString().slice(0, 10);

    const { error } = await supabase.from('profiles').update({ paid_until: paidUntilStr }).eq('id', userId);
    if (error) {
      setPaymentMsg('Kunde inte markera betald: ' + error.message);
      return;
    }

    const { data: existingPlan } = await supabase
      .from('family_plans')
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle();

    if (existingPlan) {
      await supabase.from('family_plans').update({ max_members: seats }).eq('id', existingPlan.id);
    } else {
      const { error: famError } = await supabase.from('family_plans').insert({ owner_id: userId, max_members: seats });
      if (famError) {
        setPaymentMsg('Betald markerad, men kunde inte skapa platser: ' + famError.message);
        return;
      }
    }

    const { data: existingLeague } = await supabase
      .from('leagues')
      .select('id')
      .eq('owner_id', userId)
      .eq('status', 'approved')
      .maybeSingle();

    if (!existingLeague) {
      const { error: leagueError } = await supabase
        .from('leagues')
        .insert({ name: `${username} — Företag`, owner_id: userId, status: 'approved' });
      if (leagueError) {
        setPaymentMsg(`Betald markerad, ${seats} platser skapade, men liga kunde inte skapas: ` + leagueError.message);
        return;
      }
    }

    setPaymentResults(prev => prev.map(p => p.id === userId ? { ...p, paid_until: paidUntilStr } : p));
    setPaymentMsg(`Markerad betald till ${paidUntilStr} (${seats} platser, ${price} kr/år). Familjeplan och liga klara — hämta koderna under personens profil.`);
  }

  if (loading) return <div className="wrap"><p className="subhead">Laddar…</p></div>;

  if (isAdmin === false) {
    return (
      <div className="wrap">
        <p className="subhead">Den här sidan är bara till för administratörer.</p>
        <a className="btn btn-ghost" href="/">&larr; Till startsidan</a>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="btn btn-ghost" href="/">&larr; Alla spel</a>
      </div>

      <header style={{ marginBottom: 20 }}>
        <div className="eyebrow">Adminpanel</div>
        <h1 className="brand" style={{ fontSize: 32 }}>Kan Du Alla</h1>
      </header>

      {/* ---- Global start/stopp för Dagens utmaning ---- */}
      <div
        className="panel"
        style={{
          marginBottom: 24,
          border: `2px solid ${launched ? '#4f9e63' : 'var(--miss)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14
        }}
      >
        <div>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, textTransform: 'uppercase', color: launched ? '#7fc98f' : 'var(--miss)' }}>
            {launched ? '🟢 Dagens utmaning är LIVE' : '🔴 Dagens utmaning är AVSTÄNGD'}
          </div>
          <p className="subhead" style={{ margin: '4px 0 0', fontSize: 12.5 }}>
            {launched
              ? 'Cron-jobbet skapar nya utmaningar som vanligt varje måndag och onsdag.'
              : 'Ingen ny utmaning skapas alls, oavsett vad som ligger i poolen — tryck igång när sidan är redo att lanseras.'}
          </p>
          {launchMsg && <p className="toast" style={{ margin: '6px 0 0' }}>{launchMsg}</p>}
        </div>
        <button
          className={launched ? 'btn btn-ghost' : 'btn btn-primary'}
          style={{ width: 'auto', flexShrink: 0 }}
          onClick={toggleLaunch}
        >
          {launched ? 'Stäng av' : 'Starta Dagens utmaning'}
        </button>
      </div>

      {msg && <div className="error-msg">{msg}</div>}

      {/* ---- Betalningar ---- */}
      <div className="cat-title" style={{ marginTop: 0 }}>Markera betalning</div>

      <form onSubmit={searchPayments} className="input-row" style={{ marginBottom: 12 }}>
        <input
          className="field"
          type="text"
          placeholder="Sök på användarnamn…"
          value={paymentSearch}
          onChange={e => setPaymentSearch(e.target.value)}
        />
        <button className="btn btn-primary" style={{ width: 'auto' }} type="submit" disabled={paymentSearching}>
          {paymentSearching ? 'Söker…' : 'Sök'}
        </button>
      </form>
      {paymentMsg && <div className="toast" style={{ marginBottom: 10 }}>{paymentMsg}</div>}

      {paymentResults.map(u => {
        const isActive = u.paid_until && u.paid_until >= new Date().toISOString().slice(0, 10);
        return (
          <div key={u.id} className="panel" style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, textTransform: 'uppercase' }}>
                {u.username} {u.is_child && <span className="tag" style={{ marginLeft: 6 }}>Barn</span>}
              </div>
              <div className="subhead" style={{ fontSize: 12.5 }}>
                {u.paid_until
                  ? (isActive ? `Betald t.o.m. ${u.paid_until}` : `Gick ut ${u.paid_until}`)
                  : 'Har aldrig betalat'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {Object.entries(PLAN_PRICES).map(([key, val]) => (
                <button key={key} className="btn btn-ghost" style={{ width: 'auto' }} onClick={() => markPaid(u.id, key)}>
                  {val.label} ({val.amount} kr)
                </button>
              ))}
              <span style={{ borderLeft: '1px solid var(--line)', height: 24, margin: '0 4px' }} />
              <input
                type="number"
                min={COMPANY_MIN_SEATS}
                value={companySeats[u.id] ?? COMPANY_MIN_SEATS}
                onChange={e => setCompanySeats(prev => ({ ...prev, [u.id]: e.target.value }))}
                className="field"
                style={{ width: 60, padding: '8px 10px' }}
              />
              <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={() => markPaidCompany(u.id, u.username)}>
                Företag ({(Math.max(COMPANY_MIN_SEATS, parseInt(companySeats[u.id] || COMPANY_MIN_SEATS, 10))) * COMPANY_PRICE_PER_SEAT} kr)
              </button>
            </div>
          </div>
        );
      })}

      {/* ---- Ligor: klickbar mapp, badge visar antal som väntar ---- */}
      <div style={{ marginBottom: 8 }}>
        <button
          className="plaque"
          style={{
            width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
            borderColor: showLeagues ? (pending.length > 0 ? 'var(--miss)' : 'var(--line)') : undefined
          }}
          onClick={() => setShowLeagues(s => !s)}
        >
          <span>{showLeagues ? '📂' : '📁'}</span>
          <span style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: 13 }}>Ligor</span>
          {pending.length > 0 && (
            <span style={{
              background: 'var(--miss)', color: '#fff', borderRadius: 10, padding: '1px 8px',
              fontSize: 11, fontWeight: 700
            }}>
              {pending.length} väntar
            </span>
          )}
          <span className="subhead" style={{ marginLeft: 'auto', fontSize: 12 }}>{approved.length} godkända</span>
        </button>

        {showLeagues && (
          <div className="panel" style={{ marginTop: 6 }}>
            <div className="cat-title" style={{ marginTop: 0 }}>Väntar på godkännande ({pending.length})</div>
            {pending.length === 0 && <p className="subhead" style={{ marginBottom: 20 }}>Inga väntande ansökningar.</p>}
            {pending.map(l => (
              <div key={l.id} className="panel" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, textTransform: 'uppercase' }}>{l.name}</div>
                  <div className="subhead" style={{ fontSize: 12 }}>Skapad {new Date(l.created_at).toLocaleDateString('sv-SE')}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => approve(l.id)}>Godkänn</button>
                  <button className="btn btn-ghost" onClick={() => reject(l.id)}>Neka</button>
                  <button className="btn btn-ghost" style={{ color: 'var(--miss)' }} onClick={() => remove(l.id, l.name)}>Ta bort</button>
                </div>
              </div>
            ))}

            <div className="cat-title" style={{ marginTop: 20 }}>Senast godkända</div>
            {approved.length === 0 && <p className="subhead">Inga godkända ligor än.</p>}
            {approved.map(l => (
              <div key={l.id} className="panel" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, textTransform: 'uppercase' }}>{l.name}</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div className="stat" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{l.invite_code}</div>
                  <button className="btn btn-ghost" style={{ color: 'var(--miss)' }} onClick={() => remove(l.id, l.name)}>Ta bort</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- Synliga, medlems- och poolspel ---- */}
      <header style={{ margin: '40px 0 20px' }}>
        <div className="eyebrow">Adminpanel</div>
        <h1 className="brand" style={{ fontSize: 28 }}>Välj läge per spel</h1>
        <p className="subhead">
          <b style={{ color: 'var(--amber-glow)' }}>Synligt</b> = visas för alla, även utan konto.{' '}
          <b style={{ color: '#9ab8e6' }}>Medlem</b> = kräver inloggning, inget betalt medlemskap.{' '}
          <b style={{ color: '#7fc98f' }}>Pool</b> = kan slumpas fram som Dagens utmaning. Ett spel som inte har
          någon kryssruta ibockad syns ingenstans för vanliga besökare — bara du kan testspela det i admin,
          precis rätt för nya listor innan du litar på dem.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={saveGames} disabled={savingGames}>
          {savingGames ? 'Sparar…' : 'Spara'}
        </button>
        <button
          className="btn btn-ghost"
          style={{ width: 'auto' }}
          onClick={() => {
            const next = !showStats;
            setShowStats(next);
            if (next && gameStats.length === 0) loadGameStats();
          }}
        >
          {showStats ? 'Dölj' : 'Visa'} Spelstatistik
        </button>
        {gamesMsg && <span className="toast" style={{ margin: 0 }}>{gamesMsg}</span>}
      </div>

      {/* ---- Fyra klickbara mappar ---- */}
      {(() => {
        const untestedGames = games.filter(g => !checked.has(g.id) && !checkedMember.has(g.id) && !checkedPool.has(g.id));
        const folders = [
          { key: 'featured', label: 'Synliga spel', color: 'var(--amber)', glow: 'var(--amber-glow)', set: checked, toggle: toggleGame },
          { key: 'member', label: 'Medlemsspel', color: '#5b8fd6', glow: '#9ab8e6', set: checkedMember, toggle: toggleMemberGame },
          { key: 'pool', label: 'Dagens utmaning-pool', color: '#4f9e63', glow: '#7fc98f', set: checkedPool, toggle: togglePoolGame },
          { key: 'untested', label: 'Ej tilldelade (testläge)', color: '#888', glow: '#bbb', set: null, toggle: null }
        ];
        return (
          <div style={{ marginBottom: 24 }}>
            {folders.map(f => {
              const count = f.key === 'untested' ? untestedGames.length : f.set.size;
              const isOpen = openFolder === f.key;
              return (
                <div key={f.key} style={{ marginBottom: 8 }}>
                  <button
                    className="plaque"
                    style={{ width: '100%', textAlign: 'left', borderColor: isOpen ? f.color : undefined, display: 'flex', alignItems: 'center', gap: 8 }}
                    onClick={() => setOpenFolder(isOpen ? null : f.key)}
                  >
                    <span>{isOpen ? '📂' : '📁'}</span>
                    <span style={{ color: f.glow, fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: 13 }}>{f.label}</span>
                    <span className="subhead" style={{ marginLeft: 'auto', fontSize: 12 }}>{count} spel</span>
                  </button>

                  {isOpen && (
                    <div className="panel" style={{ marginTop: 6, border: `1px solid ${f.color}` }}>
                      {count === 0 ? (
                        <p className="subhead" style={{ margin: 0 }}>Inga spel här just nu.</p>
                      ) : f.key === 'untested' ? (
                        <div className="list-grid">
                          {untestedGames.map(g => (
                            <div key={g.id} className="plaque" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <span>{g.title}</span>
                              <a href={`/play/${g.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}>
                                Testa →
                              </a>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="list-grid">
                          {games.filter(g => f.set.has(g.id)).map(g => (
                            <label key={g.id} className="plaque" style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderColor: f.color }}>
                              <input
                                type="checkbox"
                                checked
                                onChange={() => f.toggle(g.id)}
                                style={{ width: 16, height: 16, accentColor: f.color }}
                              />
                              {g.title}
                              {f.key === 'pool' && (
                                <span className="subhead" style={{ marginLeft: 'auto', fontSize: 11 }}>
                                  {dailyUsage[g.id]?.count ? `${dailyUsage[g.id].count}x` : 'Ny'}
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      )}
                      {f.key !== 'untested' && (
                        <p className="subhead" style={{ fontSize: 11.5, marginTop: 10, marginBottom: 0 }}>
                          Bocka ur för att ta bort ett spel härifrån — glöm inte att trycka Spara.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {showStats && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, textTransform: 'uppercase', marginBottom: 4 }}>
            Spelstatistik
          </div>
          <p className="subhead" style={{ fontSize: 12.5, marginBottom: 10 }}>
            "Anon" = spelat utan konto (folk som bara testar). "Medlem" = spelat inloggad. Klicka på ett spel
            för att se fördelningen — hur många spelare som fick exakt X rätt.
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, cursor: 'pointer', fontSize: 12.5 }}>
            <input
              type="checkbox"
              checked={statsOnlyFeatured}
              onChange={e => setStatsOnlyFeatured(e.target.checked)}
              style={{ width: 14, height: 14, accentColor: 'var(--amber)' }}
            />
            Visa bara synliga spel (de som anonyma faktiskt kan hitta och testa)
          </label>

          {statsLoading ? (
            <p className="subhead">Laddar…</p>
          ) : gameStats.length === 0 ? (
            <p className="subhead">Inga resultat sparade än.</p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                <span>Spel</span>
                <span style={{ display: 'flex', gap: 16 }}>
                  <span style={{ width: 40, textAlign: 'right' }}>Anon</span>
                  <span style={{ width: 50, textAlign: 'right' }}>Medlem</span>
                  <span style={{ width: 55, textAlign: 'right' }}>Snitt %</span>
                  <span style={{ width: 65, textAlign: 'right' }}>Klarade %</span>
                </span>
              </div>
              {gameStats
                .filter(g => !statsOnlyFeatured || checked.has(g.list_id))
                .map(g => (
                <div key={g.list_id}>
                  <div
                    onClick={() => toggleDistribution(g.list_id)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                      borderBottom: '1px solid var(--line)', fontSize: 13, cursor: 'pointer'
                    }}
                  >
                    <span>
                      {openDistributionId === g.list_id ? '▾' : '▸'} {g.title}
                      {!g.featured && <span className="subhead" style={{ fontSize: 10.5, marginLeft: 6 }}>(dolt)</span>}
                    </span>
                    <span style={{ display: 'flex', gap: 16 }}>
                      <span style={{ width: 40, textAlign: 'right', color: '#9ab8e6' }}>{g.anon_count}</span>
                      <span style={{ width: 50, textAlign: 'right', color: 'var(--amber-glow)' }}>{g.member_count}</span>
                      <span style={{ width: 55, textAlign: 'right' }} className="subhead">{g.avg_percent != null ? `${g.avg_percent}%` : '—'}</span>
                      <span style={{ width: 65, textAlign: 'right' }} className="subhead">{g.completion_rate != null ? `${g.completion_rate}%` : '—'}</span>
                    </span>
                  </div>

                  {openDistributionId === g.list_id && (
                    <div style={{ background: 'var(--bg-2)', padding: '10px 14px', marginBottom: 6 }}>
                      {!distribution[g.list_id] ? (
                        <p className="subhead" style={{ fontSize: 12 }}>Laddar fördelning…</p>
                      ) : distribution[g.list_id].length === 0 ? (
                        <p className="subhead" style={{ fontSize: 12 }}>Inga resultat än.</p>
                      ) : (
                        (() => {
                          const rows = distribution[g.list_id];
                          const maxCount = Math.max(...rows.map(r => r.player_count));
                          const totalItems = rows[0]?.total || '?';
                          return rows.map((r, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                              <span style={{ width: 60, fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                                {r.guessed}/{totalItems}
                              </span>
                              <div style={{ flex: 1, background: 'var(--panel)', borderRadius: 2, overflow: 'hidden', height: 14 }}>
                                <div style={{
                                  width: `${Math.max(4, (r.player_count / maxCount) * 100)}%`,
                                  background: 'var(--amber)', height: '100%'
                                }} />
                              </div>
                              <span style={{ width: 70, fontSize: 11.5, textAlign: 'right', flexShrink: 0 }} className="subhead">
                                {r.player_count} {r.player_count === 1 ? 'spelare' : 'spelare'}
                              </span>
                            </div>
                          ));
                        })()
                      )}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ---- Legend, så man slipper gissa vilken kryssruta som är vilken ---- */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 14, fontSize: 12, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, border: '2px solid var(--amber)', display: 'inline-block' }} />
          <b style={{ color: 'var(--amber-glow)' }}>SYN</b> = Synligt för alla
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, border: '2px solid #5b8fd6', display: 'inline-block' }} />
          <b style={{ color: '#9ab8e6' }}>MED</b> = Medlemsspel
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, border: '2px solid #4f9e63', display: 'inline-block' }} />
          <b style={{ color: '#7fc98f' }}>POOL</b> = Dagens utmaning
        </span>
        <span className="subhead">Inget ibockat = bara testbart av dig, syns ingenstans annars</span>
      </div>

      {categories.map(cat => {
        const catGames = games.filter(g => g.category_id === cat.id);
        if (catGames.length === 0) return null;
        return (
          <div key={cat.id} style={{ marginBottom: 18 }}>
            <div className="cat-title">{cat.name}</div>
            <div className="list-grid">
              {catGames.map(g => {
                const isUntested = !checked.has(g.id) && !checkedMember.has(g.id) && !checkedPool.has(g.id);
                return (
                <div
                  key={g.id}
                  className="plaque"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    borderColor: checked.has(g.id) ? 'var(--amber)' : (checkedMember.has(g.id) ? '#5b8fd6' : (checkedPool.has(g.id) ? '#4f9e63' : undefined)),
                    opacity: isUntested ? 0.7 : 1
                  }}
                >
                  <span style={{ flex: 1 }}>{g.title}</span>
                  {isUntested && (
                    <a href={`/play/${g.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 11 }} title="Testspela">🔍</a>
                  )}
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: 1 }} title="Synligt för alla">
                    <input
                      type="checkbox"
                      checked={checked.has(g.id)}
                      onChange={() => toggleGame(g.id)}
                      style={{ width: 16, height: 16, accentColor: 'var(--amber)' }}
                    />
                    <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.03em', color: 'var(--amber-glow)' }}>SYN</span>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: 1 }} title="Medlemsspel (kräver konto, inte betalning)">
                    <input
                      type="checkbox"
                      checked={checkedMember.has(g.id)}
                      onChange={() => toggleMemberGame(g.id)}
                      style={{ width: 16, height: 16, accentColor: '#5b8fd6' }}
                    />
                    <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.03em', color: '#9ab8e6' }}>MED</span>
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: 1 }} title="Kan slumpas fram som Dagens utmaning">
                    <input
                      type="checkbox"
                      checked={checkedPool.has(g.id)}
                      onChange={() => togglePoolGame(g.id)}
                      style={{ width: 16, height: 16, accentColor: '#4f9e63' }}
                    />
                    <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.03em', color: '#7fc98f' }}>POOL</span>
                  </label>
                  <button
                    onClick={() => removeGame(g.id, g.title)}
                    style={{
                      background: 'none', border: 'none', color: 'var(--miss)',
                      cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px'
                    }}
                    title="Ta bort spelet permanent"
                  >
                    ✕
                  </button>
                </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 10 }}>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={saveGames} disabled={savingGames}>
          {savingGames ? 'Sparar…' : 'Spara'}
        </button>
      </div>
    </div>
  );
}
