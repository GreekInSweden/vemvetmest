'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export const TIERS = [
  { key: 'featured', label: 'SYN', title: 'Synligt för alla', color: 'var(--amber)', glow: 'var(--amber-glow)' },
  { key: 'member_exclusive', label: 'MED', title: 'Medlemsspel (kräver konto, inte betalning)', color: '#5b8fd6', glow: '#9ab8e6' },
  { key: 'daily_pool', label: 'POOL', title: 'Kan slumpas fram som Dagens utmaning', color: '#4f9e63', glow: '#7fc98f' },
  { key: 'tested', label: 'TEST', title: 'Kvalitetstestat och godkänt av dig', color: '#c98f4f', glow: '#e0b37f' }
];

// filterTier: en av TIERS[].key, eller 'untested' för spel utan någon markering alls
export default function GameTierList({ filterTier }) {
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState([]);
  const [edits, setEdits] = useState({}); // { gameId: { featured, member_exclusive, daily_pool, tested } }
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');

  async function load() {
    const { data } = await supabase
      .from('game_lists')
      .select('id, slug, title, featured, member_exclusive, daily_pool, tested, child_package')
      .order('title');

    const rows = data || [];
    // Barnpaket-spel lever helt separat - de ska aldrig dyka upp i
    // någon av de fyra vanliga nivåerna, inte ens om de råkar vara
    // markerade "tested" inom Barnpaketets egen ej-testade/testade-
    // uppdelning.
    const filtered = filterTier === 'untested'
      ? rows.filter(g => !g.featured && !g.member_exclusive && !g.daily_pool && !g.tested && !g.child_package)
      : rows.filter(g => g[filterTier] && !g.child_package);

    setGames(filtered);
    const initialEdits = {};
    filtered.forEach(g => {
      initialEdits[g.id] = {
        featured: g.featured, member_exclusive: g.member_exclusive,
        daily_pool: g.daily_pool, tested: g.tested
      };
    });
    setEdits(initialEdits);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filterTier]);

  function toggle(gameId, tierKey) {
    setEdits(prev => ({
      ...prev,
      [gameId]: { ...prev[gameId], [tierKey]: !prev[gameId][tierKey] }
    }));
  }

  function setAllForTier(tierKey, value) {
    setEdits(prev => {
      const next = { ...prev };
      visibleGames.forEach(g => {
        next[g.id] = { ...next[g.id], [tierKey]: value };
      });
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setMsg('');
    for (const game of games) {
      const e = edits[game.id];
      const changed = TIERS.some(t => e[t.key] !== game[t.key]);
      if (changed) {
        await supabase.from('game_lists').update(e).eq('id', game.id);
      }
    }
    setSaving(false);
    setMsg('Sparat! Listan uppdateras...');
    await load();
  }

  async function removeGame(id, title) {
    if (!window.confirm(`Ta bort spelet "${title}" permanent? Går inte att ångra.`)) return;
    const { error } = await supabase.from('game_lists').delete().eq('id', id);
    if (error) { setMsg('Kunde inte ta bort: ' + error.message); return; }
    load();
  }

  const visibleGames = games.filter(g => g.title.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <p className="subhead">Laddar…</p>;

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={save} disabled={saving}>
          {saving ? 'Sparar…' : 'Spara ändringar'}
        </button>
        <input
          className="field"
          style={{ maxWidth: 240 }}
          placeholder="Sök i den här listan…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {msg && <span className="toast" style={{ margin: 0 }}>{msg}</span>}
      </div>

      <p className="subhead" style={{ fontSize: 12, marginBottom: 10 }}>
        {games.length} spel här. Bocka i/ur för att flytta ett spel till en annan kategori — glöm inte att trycka Spara.
      </p>

      {/* ---- Snabbval: markera/avmarkera alla synliga (filtrerade) rader per kolumn ---- */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16, padding: '10px 12px', background: 'var(--bg-2)', borderRadius: 6 }}>
        {TIERS.map(t => (
          <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: t.glow, letterSpacing: '.03em' }}>{t.label}:</span>
            <button
              onClick={() => setAllForTier(t.key, true)}
              style={{ background: 'none', border: `1px solid ${t.color}`, color: t.glow, borderRadius: 3, fontSize: 11, padding: '2px 8px', cursor: 'pointer' }}
            >
              Alla
            </button>
            <button
              onClick={() => setAllForTier(t.key, false)}
              style={{ background: 'none', border: '1px solid var(--line)', color: 'var(--muted)', borderRadius: 3, fontSize: 11, padding: '2px 8px', cursor: 'pointer' }}
            >
              Ingen
            </button>
          </div>
        ))}
        <span className="subhead" style={{ fontSize: 11, marginLeft: 'auto' }}>Gäller bara raderna som visas nedan (efter sökfilter)</span>
      </div>

      {visibleGames.length === 0 ? (
        <p className="subhead">Inga spel matchar.</p>
      ) : (
        <div className="list-grid">
          {visibleGames.map(g => (
            <div key={g.id} className="plaque" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: '1 1 120px', minWidth: 0 }}>{g.title}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <a href={`/play/${g.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 11 }} title="Testspela">🔍</a>
                {TIERS.map(t => (
                  <label key={t.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: 1 }} title={t.title}>
                    <input
                      type="checkbox"
                      checked={!!edits[g.id]?.[t.key]}
                      onChange={() => toggle(g.id, t.key)}
                      style={{ width: 15, height: 15, accentColor: t.color }}
                    />
                    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '.03em', color: t.glow }}>{t.label}</span>
                  </label>
                ))}
                <button
                  onClick={() => removeGame(g.id, g.title)}
                  style={{ background: 'none', border: 'none', color: 'var(--miss)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '2px 4px' }}
                  title="Ta bort spelet permanent"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={save} disabled={saving}>
          {saving ? 'Sparar…' : 'Spara ändringar'}
        </button>
      </div>
    </>
  );
}
