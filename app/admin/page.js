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
  const [dailyUsage, setDailyUsage] = useState({});
  const [showPool, setShowPool] = useState(false);
  const [gameStats, setGameStats] = useState([]);
  const [showStats, setShowStats] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
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
    setApproved(approvedLeagues || []);

    const { data: cats } = await supabase.from('categories').select('*').order('sort_order');
    const { data: gameLists } = await supabase
      .from('game_lists')
      .select('id, title, category_id, featured, member_exclusive')
      .order('sort_order');

    setCategories(cats || []);
    setGames(gameLists || []);
    setChecked(new Set((gameLists || []).filter(g => g.featured).map(g => g.id)));
    setCheckedMember(new Set((gameLists || []).filter(g => g.member_exclusive).map(g => g.id)));

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

  async function saveGames() {
    setSavingGames(true);
    setGamesMsg('');
    const allIds = games.map(g => g.id);
    const featuredIds = allIds.filter(id => checked.has(id));
    const hiddenIds = allIds.filter(id => !checked.has(id));
    const memberIds = allIds.filter(id => checkedMember.has(id));
    const nonMemberIds = allIds.filter(id => !checkedMember.has(id));

    if (featuredIds.length > 0) {
      await supabase.from('game_lists').update({ featured: true }).in('id', featuredIds);
    }
    if (hiddenIds.length > 0) {
      await supabase.from('game_lists').update({ featured: false }).in('id', hiddenIds);
    }
    if (memberIds.length > 0) {
      await supabase.from('game_lists').update({ member_exclusive: true }).in('id', memberIds);
    }
    if (nonMemberIds.length > 0) {
      await supabase.from('game_lists').update({ member_exclusive: false }).in('id', nonMemberIds);
    }
    setSavingGames(false);
    setGamesMsg(`Sparat! ${featuredIds.length} spel synliga för alla, ${memberIds.length} medlemsspel den här månaden.`);
    setGames(prev => prev.map(g => ({ ...g, featured: checked.has(g.id), member_exclusive: checkedMember.has(g.id) })));
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

      <div className="cat-title" style={{ marginTop: 40 }}>Godkänn ligor</div>

      <div className="cat-title">Väntar på godkännande ({pending.length})</div>
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

      <div className="cat-title" style={{ marginTop: 30 }}>Senast godkända</div>
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

      {/* ---- Synliga spel ---- */}
      <header style={{ margin: '40px 0 20px' }}>
        <div className="eyebrow">Adminpanel</div>
        <h1 className="brand" style={{ fontSize: 28 }}>Välj synliga och medlemsspel</h1>
        <p className="subhead">
          <b style={{ color: 'var(--amber-glow)' }}>Synligt</b> = visas för alla på startsidan, även utan konto.{' '}
          <b style={{ color: 'var(--amber-glow)' }}>Medlemsspel</b> = kräver inloggning men inget betalt medlemskap,
          syns aldrig som Dagens utmaning — byt gärna ut dessa varje månad för att ge inloggade-men-ej-betalande
          en anledning att komma tillbaka.
        </p>
        <p className="subhead">
          Just nu: <b style={{ color: 'var(--amber-glow)' }}>{checked.size}</b> synliga,{' '}
          <b style={{ color: 'var(--amber-glow)' }}>{checkedMember.size}</b> medlemsspel.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={saveGames} disabled={savingGames}>
          {savingGames ? 'Sparar…' : 'Spara'}
        </button>
        <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={() => setShowPool(s => !s)}>
          {showPool ? 'Dölj' : 'Visa'} Dagens utmaning-poolen
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

      {/* ---- Samlad vy: bara de aktuella medlemsspelen, oavsett kategori ---- */}
      {checkedMember.size > 0 && (
        <div className="panel" style={{ marginBottom: 24, border: '1px solid #5b8fd6' }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, textTransform: 'uppercase', color: '#9ab8e6', marginBottom: 10 }}>
            Aktuella medlemsspel ({checkedMember.size})
          </div>
          <div className="list-grid">
            {games.filter(g => checkedMember.has(g.id)).map(g => (
              <label
                key={g.id}
                className="plaque"
                style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderColor: '#5b8fd6' }}
              >
                <input
                  type="checkbox"
                  checked
                  onChange={() => toggleMemberGame(g.id)}
                  style={{ width: 16, height: 16, accentColor: '#5b8fd6' }}
                />
                {g.title}
              </label>
            ))}
          </div>
          <p className="subhead" style={{ fontSize: 12, marginTop: 10, marginBottom: 0 }}>
            Bocka ur här för att snabbt plocka bort ett spel ur den här månadens medlemsspel — glöm inte att trycka Spara.
          </p>
        </div>
      )}

      {/* ---- Dagens utmaning-poolen: användningsstatistik ---- */}
      {showPool && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, textTransform: 'uppercase', marginBottom: 4 }}>
            Dagens utmaning-poolen
          </div>
          <p className="subhead" style={{ fontSize: 12.5, marginBottom: 14 }}>
            Alla spel som INTE är medlemsspel kan slumpas fram som Dagens utmaning. Cron-jobbet väljer alltid
            bland de som använts minst — listan nedan är sorterad så de som ligger överst är de som troligen
            slumpas fram näst.
          </p>
          {games
            .filter(g => !checkedMember.has(g.id))
            .map(g => ({ ...g, usage: dailyUsage[g.id]?.count || 0, lastUsed: dailyUsage[g.id]?.lastUsed || null }))
            .sort((a, b) => a.usage - b.usage || a.title.localeCompare(b.title))
            .map(g => (
              <div key={g.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
                <span>{g.title}</span>
                <span className="subhead" style={{ fontSize: 12 }}>
                  {g.usage === 0 ? 'Aldrig använt' : `Använt ${g.usage} ${g.usage === 1 ? 'gång' : 'gånger'}${g.lastUsed ? ` · senast ${g.lastUsed}` : ''}`}
                </span>
              </div>
            ))}
        </div>
      )}

      {showStats && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, textTransform: 'uppercase', marginBottom: 4 }}>
            Spelstatistik — övningsspel
          </div>
          <p className="subhead" style={{ fontSize: 12.5, marginBottom: 14 }}>
            Bygger på sparade resultat från inloggade spelare. Anonyma besökares spelningar sparas inte alls
            just nu, så siffrorna visar bara en del av det verkliga intresset — säg till om du vill att jag
            bygger in spårning för anonyma också.
          </p>
          {statsLoading ? (
            <p className="subhead">Laddar…</p>
          ) : gameStats.length === 0 ? (
            <p className="subhead">Inga resultat sparade än.</p>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                <span>Spel</span>
                <span style={{ display: 'flex', gap: 20 }}>
                  <span style={{ width: 70, textAlign: 'right' }}>Spelningar</span>
                  <span style={{ width: 60, textAlign: 'right' }}>Snitt %</span>
                  <span style={{ width: 70, textAlign: 'right' }}>Klarade %</span>
                </span>
              </div>
              {gameStats.map(g => (
                <div key={g.list_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--line)', fontSize: 13 }}>
                  <span>{g.title}</span>
                  <span style={{ display: 'flex', gap: 20 }}>
                    <span style={{ width: 70, textAlign: 'right', color: 'var(--amber-glow)' }}>{g.play_count}</span>
                    <span style={{ width: 60, textAlign: 'right' }} className="subhead">{g.avg_percent != null ? `${g.avg_percent}%` : '—'}</span>
                    <span style={{ width: 70, textAlign: 'right' }} className="subhead">{g.completion_rate != null ? `${g.completion_rate}%` : '—'}</span>
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ---- Legend, så man slipper gissa vilken kryssruta som är vilken ---- */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 14, fontSize: 12 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, border: '2px solid var(--amber)', display: 'inline-block' }} />
          <b style={{ color: 'var(--amber-glow)' }}>SYN</b> = Synligt för alla
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 14, height: 14, borderRadius: 3, border: '2px solid #5b8fd6', display: 'inline-block' }} />
          <b style={{ color: '#9ab8e6' }}>MED</b> = Medlemsspel
        </span>
      </div>

      {categories.map(cat => {
        const catGames = games.filter(g => g.category_id === cat.id);
        if (catGames.length === 0) return null;
        return (
          <div key={cat.id} style={{ marginBottom: 18 }}>
            <div className="cat-title">{cat.name}</div>
            <div className="list-grid">
              {catGames.map(g => (
                <div
                  key={g.id}
                  className="plaque"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    borderColor: checked.has(g.id) ? 'var(--amber)' : (checkedMember.has(g.id) ? '#5b8fd6' : undefined)
                  }}
                >
                  <span style={{ flex: 1 }}>{g.title}</span>
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
              ))}
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
