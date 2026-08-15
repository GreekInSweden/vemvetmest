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

  // ---- Lanseringsnedräkning (helt egen mekanism) ----
  const [launchAt, setLaunchAt] = useState(null); // ISO-sträng eller null
  const [launchAtInput, setLaunchAtInput] = useState('');
  const [launchCountdownMsg, setLaunchCountdownMsg] = useState('');

  async function load() {
    const { data: settings } = await supabase.from('app_settings').select('daily_pool_launched, launch_at').eq('id', 1).single();
    setLaunched(!!settings?.daily_pool_launched);
    setLaunchAt(settings?.launch_at || null);
    if (settings?.launch_at) {
      const dt = new Date(settings.launch_at);
      const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setLaunchAtInput(local);
    }

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

  async function saveLaunchAt() {
    if (!launchAtInput) {
      setLaunchCountdownMsg('Välj ett datum och en tid först.');
      return;
    }
    const iso = new Date(launchAtInput).toISOString();
    const ok = window.confirm(
      `Sätt lanseringen till ${new Date(iso).toLocaleString('sv-SE')}? Dagens utmaning, Topplistor och de förvalda medlemsspelen hålls låsta för ALLA (även redan betalande) fram tills dess. Betalning fungerar som vanligt hela tiden.`
    );
    if (!ok) return;
    setLaunchCountdownMsg('');
    const { error } = await supabase.from('app_settings').update({ launch_at: iso }).eq('id', 1);
    if (error) {
      setLaunchCountdownMsg('Kunde inte spara: ' + error.message);
      return;
    }
    setLaunchAt(iso);
    setLaunchCountdownMsg('Sparat! Nedräkningen är aktiv.');
  }

  async function clearLaunchAt() {
    const ok = window.confirm('Ta bort lanseringsdatumet helt? Dagens utmaning, Topplistor och medlemsspelen blir då direkt tillgängliga för alla som betalat, utan väntetid.');
    if (!ok) return;
    setLaunchCountdownMsg('');
    const { error } = await supabase.from('app_settings').update({ launch_at: null }).eq('id', 1);
    if (error) {
      setLaunchCountdownMsg('Kunde inte ta bort: ' + error.message);
      return;
    }
    setLaunchAt(null);
    setLaunchAtInput('');
    setLaunchCountdownMsg('Borttaget — allt är nu direkt tillgängligt för betalande, ingen nedräkning aktiv.');
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

  if (loading) return <p className="subhead">Laddar…</p>;

  return (
    <>
      {/* ---- Lanseringsnedräkning: helt egen mekanism, engångsgrej ---- */}
      <div className="panel" style={{ marginBottom: 24, border: `2px solid ${launchAt ? 'var(--amber)' : 'var(--line)'}` }}>
        <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, textTransform: 'uppercase', color: launchAt ? 'var(--amber-glow)' : 'var(--text)' }}>
          ⏱ Lanseringsnedräkning
        </div>
        <p className="subhead" style={{ margin: '4px 0 12px', fontSize: 12.5 }}>
          {launchAt
            ? `Aktiv — Dagens utmaning, Topplistor och de förvalda medlemsspelen är låsta för alla (även betalande) fram till ${new Date(launchAt).toLocaleString('sv-SE')}. Betalning fungerar som vanligt hela tiden.`
            : 'Ingen nedräkning aktiv — allt är direkt tillgängligt för den som betalat, precis som idag.'}
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="datetime-local"
            className="field"
            style={{ maxWidth: 240 }}
            value={launchAtInput}
            onChange={e => setLaunchAtInput(e.target.value)}
          />
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={saveLaunchAt}>
            {launchAt ? 'Uppdatera datum' : 'Sätt lanseringsdatum'}
          </button>
          {launchAt && (
            <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={clearLaunchAt}>
              Ta bort nedräkning
            </button>
          )}
        </div>
        {launchCountdownMsg && <p className="toast" style={{ margin: '8px 0 0' }}>{launchCountdownMsg}</p>}
      </div>

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
        <a href="/admin/ligor" className="plaque" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '2px 8px' }}>
          <span>Ligor</span>
          {pendingLeagues > 0 ? (
            <span style={{ background: 'var(--miss)', color: '#fff', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
              {pendingLeagues} väntar
            </span>
          ) : (
            <span className="subhead" style={{ fontSize: 12 }}>Inget väntar</span>
          )}
        </a>
        <a href="/admin/spel" className="plaque" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '2px 8px' }}>
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
