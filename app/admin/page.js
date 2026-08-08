'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function AdminOverview() {
  const [loading, setLoading] = useState(true);
  const [launched, setLaunched] = useState(false);
  const [launchMsg, setLaunchMsg] = useState('');
  const [pendingLeagues, setPendingLeagues] = useState(0);
  const [untestedGames, setUntestedGames] = useState(0);
  const [featuredCount, setFeaturedCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [poolCount, setPoolCount] = useState(0);

  async function load() {
    const { data: settings } = await supabase.from('app_settings').select('daily_pool_launched').eq('id', 1).single();
    setLaunched(!!settings?.daily_pool_launched);

    const { count: pendingCount } = await supabase
      .from('leagues').select('id', { count: 'exact', head: true }).eq('status', 'pending');
    setPendingLeagues(pendingCount || 0);

    const { data: games } = await supabase.from('game_lists').select('featured, member_exclusive, daily_pool, tested, child_package');
    const rows = games || [];
    setFeaturedCount(rows.filter(g => g.featured && !g.child_package).length);
    setMemberCount(rows.filter(g => g.member_exclusive && !g.child_package).length);
    setPoolCount(rows.filter(g => g.daily_pool && !g.child_package).length);
    setUntestedGames(rows.filter(g => !g.featured && !g.member_exclusive && !g.daily_pool && !g.tested && !g.child_package).length);

    setLoading(false);
  }

  useEffect(() => { load(); }, []);

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

  if (loading) return <p className="subhead">Laddar…</p>;

  return (
    <>
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

      {/* ---- Genvägskort till varje del ---- */}
      <div className="cat-title" style={{ marginTop: 0 }}>Snabböversikt</div>
      <div className="list-grid">
        <a href="/admin/ligor" className="plaque" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Ligor</span>
          {pendingLeagues > 0 ? (
            <span style={{ background: 'var(--miss)', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
              {pendingLeagues} väntar
            </span>
          ) : (
            <span className="subhead" style={{ fontSize: 12 }}>Inget väntar</span>
          )}
        </a>
        <a href="/admin/spel" className="plaque" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Spel</span>
          <span className="subhead" style={{ fontSize: 12 }}>
            {featuredCount} syn · {memberCount} med · {poolCount} pool
            {untestedGames > 0 && <> · <span style={{ color: 'var(--amber-glow)' }}>{untestedGames} otestade</span></>}
          </span>
        </a>
        <a href="/admin/betalningar" className="plaque">Betalningar</a>
        <a href="/admin/statistik" className="plaque">Statistik</a>
      </div>
    </>
  );
}
