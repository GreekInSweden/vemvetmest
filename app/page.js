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

  // Synliga (featured) KanDuAlla-spel — hämtas alltid, inloggad eller ej.
  const [categories, setCategories] = useState([]);
  const [featuredLists, setFeaturedLists] = useState([]);
  const [memberLists, setMemberLists] = useState([]);

  // Kartans paket, uppdelat på gratis och medlem — samma logik som /kartan.
  const [frittKartanPaket, setFrittKartanPaket] = useState([]);
  const [medlemsKartanPaket, setMedlemsKartanPaket] = useState([]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  useEffect(() => {
    async function load() {
      // --- Synligt skyltfönster: hämtas ALLTID, oavsett inloggning ---
      const { data: cats } = await supabase.from('categories').select('*').order('sort_order');
      const { data: gameLists } = await supabase
        .from('game_lists')
        .select('id, slug, title, subtitle, category_id')
        .eq('featured', true)
        .order('sort_order');
      setCategories(cats || []);
      setFeaturedLists(gameLists || []);

      const { data: kartanPaket } = await supabase
        .from('kartan_paket')
        .select('id, namn, kraver_medlemskap')
        .eq('status', 'publicerad');
      setFrittKartanPaket((kartanPaket || []).filter((p) => !p.kraver_medlemskap));

      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session ? sessionData.session.user.id : null;

      if (!uid) {
        setLoggedIn(false);
        setLoading(false);
        return;
      }

      setLoggedIn(true);

      const { data: memberGames } = await supabase
        .from('game_lists')
        .select('id, slug, title, subtitle, category_id')
        .eq('member_exclusive', true)
        .order('sort_order');
      setMemberLists(memberGames || []);
      setMedlemsKartanPaket((kartanPaket || []).filter((p) => p.kraver_medlemskap));

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, is_admin, is_semi_admin, paid_until')
        .eq('id', uid)
        .single();

      setUsername(profile?.username || '');
      setIsAdmin(!!profile?.is_admin || !!profile?.is_semi_admin);

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
        <div style={{ marginBottom: 32 }}>
          <div className="cat-title">Dagens utmaningar</div>
          <div className="list-grid">
            {kanduallaChallenge && (
              <a href={`/daily/${kanduallaChallenge.id}`} className="plaque" style={{ border: '1px solid var(--amber)' }}>
                <span className="tag">KAN DU ALLA</span>
                {kanduallaChallenge.game_lists?.title}
              </a>
            )}
            {kartanChallenge && (
              <a href={`/kartan?paket=${kartanChallenge.paket_id}`} className="plaque" style={{ border: '1px solid var(--amber)' }}>
                <span className="tag">KARTAN</span>
                {kartanChallenge.kartan_paket?.namn}
              </a>
            )}
          </div>
        </div>
      )}

      {loggedIn && !hasPaidAccess && (
        <div className="upgrade-card" style={{ marginBottom: 32 }}>
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

      {/* --- Synligt skyltfönster: KanDuAlla:s featured-spel, grupperat per kategori --- */}
      {categories.map((cat) => {
        const catLists = featuredLists.filter((l) => l.category_id === cat.id);
        if (catLists.length === 0) return null;
        return (
          <div key={cat.id}>
            <div className="cat-title">{cat.name} <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'none', letterSpacing: 0 }}>· Kan Du Alla</span></div>
            <div className="list-grid" style={{ marginBottom: 18 }}>
              {catLists.map((l) => (
                <a key={l.id} className="plaque" href={`/play/${l.slug}`}>
                  <span className="tag">{cat.name}</span>
                  {l.title}
                </a>
              ))}
            </div>
          </div>
        );
      })}

      {/* --- Synligt skyltfönster: Kartans gratispaket --- */}
      {frittKartanPaket.length > 0 && (
        <div>
          <div className="cat-title">Kartan <span style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'none', letterSpacing: 0 }}>· gratis att testa</span></div>
          <div className="list-grid" style={{ marginBottom: 18 }}>
            {frittKartanPaket.map((p) => (
              <a key={p.id} href={`/kartan?paket=${p.id}`} className="plaque">
                <span className="tag">KARTAN</span>
                {p.namn}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* --- Medlemsspel: bara för inloggade, oavsett betalstatus (samma som KanDuAlla:s befintliga mönster — synligt om inloggad, faktiskt spelbart avgörs inne på respektive spelsida) --- */}
      {loggedIn && (memberLists.length > 0 || medlemsKartanPaket.length > 0) && (
        <>
          <div className="cat-title">Medlemsspel</div>
          <div className="list-grid" style={{ marginBottom: 28 }}>
            {memberLists.map((l) => (
              <a key={l.id} className="plaque" href={`/play/${l.slug}`}>
                <span className="tag">KAN DU ALLA</span>
                {l.title}
              </a>
            ))}
            {medlemsKartanPaket.map((p) => (
              <a key={p.id} href={`/kartan?paket=${p.id}`} className="plaque">
                <span className="tag">KARTAN</span>
                {p.namn}
              </a>
            ))}
          </div>
        </>
      )}

      <p className="subhead" style={{ margin: '28px 0 14px' }}>Utforska allt i respektive spel</p>
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
