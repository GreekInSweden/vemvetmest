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
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [isPaidActive, setIsPaidActive] = useState(false);
  const [daysUntilExpiry, setDaysUntilExpiry] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [categories, setCategories] = useState([]);
  const [lists, setLists] = useState([]);
  const [memberLists, setMemberLists] = useState([]);
  const [activeLeagues, setActiveLeagues] = useState([]);
  const [loading, setLoading] = useState(true);

  const [todayChallenge, setTodayChallenge] = useState(null);
  const [missedChallenges, setMissedChallenges] = useState([]);
  const [livesRemaining, setLivesRemaining] = useState(5);
  const [isFridayCatchup, setIsFridayCatchup] = useState(false);
  const [isSaturdayReveal, setIsSaturdayReveal] = useState(false);

  async function loadDailyChallenges(uid) {
    const now = stockholmNow();
    const isoWeekday = ((now.getDay() + 6) % 7) + 1;
    const todayStr = ymd(now);
    setIsFridayCatchup(isoWeekday === 5);
    setIsSaturdayReveal(isoWeekday === 6);

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

      // Spelen (featured) hämtas alltid, inloggad eller ej - det här är
      // skyltfönstret som ska sälja in kontot, inte gömmas bakom det.
      const { data: cats } = await supabase.from('categories').select('*').order('sort_order');
      const { data: gameLists } = await supabase
        .from('game_lists')
        .select('id, slug, title, subtitle, category_id')
        .eq('featured', true)
        .order('sort_order');
      setCategories(cats || []);
      setLists(gameLists || []);

      if (!sessionData.session) {
        setLoggedIn(false);
        setLoading(false);
        return;
      }
      setLoggedIn(true);
      const uid = sessionData.session.user.id;

      const { data: memberGames } = await supabase
        .from('game_lists')
        .select('id, slug, title, subtitle, category_id')
        .eq('member_exclusive', true)
        .order('sort_order');
      setMemberLists(memberGames || []);

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, is_admin, paid_until')
        .eq('id', uid)
        .single();
      setUsername(profile?.username || '');
      setIsAdmin(!!profile?.is_admin);

      const todayStr = ymd(stockholmNow());
      const paidUntil = profile?.paid_until || null;
      const active = !!paidUntil && paidUntil >= todayStr;
      setIsPaidActive(active);
      if (active) {
        const daysLeft = Math.round((new Date(paidUntil) - new Date(todayStr)) / 86400000);
        if (daysLeft <= 5) setDaysUntilExpiry(daysLeft);
      }

      const { data: memberships } = await supabase
        .from('league_members')
        .select('leagues(id, name, status, invite_code)')
        .eq('user_id', uid);
      const rows = (memberships || []).map(m => m.leagues).filter(Boolean);
      setActiveLeagues(rows.filter(l => l.status === 'approved'));

      if (active) {
        await loadDailyChallenges(uid);
      }
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
        {loggedIn ? (
          <>
            <div className="user">Inloggad som <b style={{ color: 'var(--amber-glow)' }}>{username}</b></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <a className="btn btn-ghost" href="/profil">Min profil</a>
              <a className="btn btn-ghost" href="/topplistor">Topplistor</a>
              {isAdmin && <a className="btn btn-ghost" href="/admin">Admin</a>}
              <button className="btn btn-ghost" onClick={handleLogout}>Logga ut</button>
            </div>
          </>
        ) : (
          <>
            <div className="user">Testa gratisspelen nedan — inget konto behövs</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <a className="btn btn-ghost" href="/login">Logga in</a>
              <a className="btn btn-primary" style={{ width: 'auto' }} href="/signup">Skapa konto</a>
            </div>
          </>
        )}
      </div>

      <header style={{ textAlign: 'center', marginBottom: 10 }}>
        <div className="eyebrow">Skriv &middot; Gissa &middot; Fyll listan</div>
        <h1 className="brand">Kan Du Alla</h1>
        <p className="subhead">Välj ett spel — fler kategorier och listor läggs till löpande.</p>
      </header>

      {/* ==== BETALANDE MEDLEMMAR: allt medlemskapet ger tillgång till, överst ==== */}
      {loggedIn && isPaidActive && (
        <>
          {daysUntilExpiry !== null && (
            <div className="panel" style={{ marginBottom: 16, border: '1px solid var(--amber)' }}>
              <div className="subhead">
                Ditt medlemskap går ut om <b style={{ color: 'var(--amber-glow)' }}>{daysUntilExpiry} {daysUntilExpiry === 1 ? 'dag' : 'dagar'}</b>.{' '}
                <a href="/prenumerera">Förnya här</a> för att inte tappa åtkomsten.
              </div>
            </div>
          )}

          {activeLeagues.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 10 }}>
              {activeLeagues.map(l => (
                <a key={l.id} href="/profil" className="stat" style={{ textDecoration: 'none', color: 'var(--text)' }}>
                  🏆 {l.name}
                </a>
              ))}
            </div>
          )}

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

          {isFridayCatchup && missedChallenges.length > 0 && (
            <>
              <div className="cat-title">Fredag — sista chansen den här veckan</div>
              <p className="subhead" style={{ marginBottom: 10 }}>
                Du har <b style={{ color: 'var(--amber-glow)' }}>{livesRemaining}</b> liv kvar i år.
                Imorgon (lördag) avslöjas veckans resultat för alla — sista chansen att hänga med idag.
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

          {isSaturdayReveal && (
            <a
              href="/topplistor"
              className="panel"
              style={{
                display: 'block', marginBottom: 20, textDecoration: 'none', color: 'inherit',
                border: '1px solid var(--amber)'
              }}
            >
              <div className="eyebrow">Lördag &middot; veckans resultat</div>
              <div style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: 20, color: 'var(--amber-glow)', margin: '4px 0' }}>
                Se var du hamnade →
              </div>
              <div className="subhead">Måndagens och onsdagens ämnen är nu avslöjade i topplistan.</div>
            </a>
          )}
        </>
      )}

      {/* ==== GRATIS ÖVNINGSSPEL: synliga direkt för alla, inloggad eller ej ==== */}
      <div className="cat-title" style={{ marginTop: loggedIn && isPaidActive ? 30 : 0 }}>Övningsspel</div>
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

      {/* ==== MEDLEMSSPEL: gratis men kräver konto, roterar månadsvis ==== */}
      {loggedIn && memberLists.length > 0 && (
        <>
          <div className="cat-title" style={{ marginTop: 30, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#7ba7e0' }}>Medlemsspel — den här månaden</span>
          </div>
          <p className="subhead" style={{ marginBottom: 12 }}>
            Gratis eftersom du har ett konto, men bara tillgängliga en begränsad tid — byts ut nästa månad.
          </p>
          <div className="list-grid" style={{ marginBottom: 10 }}>
            {memberLists.map(l => (
              <a key={l.id} className="plaque" href={`/play/${l.slug}`} style={{ borderColor: '#5b8fd6' }}>
                <span className="tag" style={{ background: '#243449', color: '#9ab8e6' }}>Medlemsspel</span>
                {l.title}
              </a>
            ))}
          </div>
        </>
      )}

      {/* ==== EJ BETALANDE MEDLEMMAR: säljande CTA EFTER att de sett spelen ==== */}
      {!(loggedIn && isPaidActive) && (
        <div className="upgrade-card" style={{ marginTop: 30 }}>
          <span className="upgrade-badge">Obegränsad tillgång</span>
          <div className="upgrade-title">Vill du tävla på riktigt?</div>
          <p className="subhead" style={{ maxWidth: 520, marginBottom: 0 }}>
            104 nya utmaningar om året — två färska varje vecka, dolda tills du klickar in.
            Skapa egna ligor med kollegorna och jaga topplistan.
          </p>
          <ul className="upgrade-perks">
            <li>✓ <b>Dagens utmaning</b> — måndag och onsdag, hela året</li>
            <li>✓ <b>Fredag</b> är sista chansen att lösa in ett liv om du missat något</li>
            <li>✓ <b>Egna privata ligor</b> med vänner och kollegor</li>
            <li>✓ <b>Topplistor</b> — avslöjas varje lördag, totalt, per liga och per omgång</li>
          </ul>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap' }}>
            <div>
              <div className="upgrade-price">29 kr<span> / månad</span></div>
              <div className="subhead" style={{ fontSize: 12, marginTop: 2 }}>eller 299 kr för hela året</div>
            </div>
            <a href="/prenumerera" className="btn btn-primary" style={{ width: 'auto', padding: '13px 26px' }}>
              Bli medlem →
            </a>
          </div>
        </div>
      )}

      <footer className="site">
        {loggedIn
          ? <>Vill du skapa eller gå med i en liga? Det gör du under <a href="/profil">Min profil</a>.</>
          : <>Redo att tävla på riktigt? <a href="/signup">Skapa ett konto</a> — tar under en minut.</>
        }
      </footer>
    </div>
  );
}
