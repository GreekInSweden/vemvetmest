'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function AdminStatistik() {
  const [gameStats, setGameStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsOnlyFeatured, setStatsOnlyFeatured] = useState(true);
  const [distribution, setDistribution] = useState({});
  const [openDistributionId, setOpenDistributionId] = useState(null);

  async function load() {
    const { data, error } = await supabase.rpc('game_play_stats');
    if (!error) setGameStats(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function toggleDistribution(listId) {
    if (openDistributionId === listId) { setOpenDistributionId(null); return; }
    setOpenDistributionId(listId);
    if (!distribution[listId]) {
      const { data, error } = await supabase.rpc('game_score_distribution', { p_list_id: listId });
      if (!error) setDistribution(prev => ({ ...prev, [listId]: data || [] }));
    }
  }

  if (loading) return <p className="subhead">Laddar…</p>;

  return (
    <>
      <div className="cat-title" style={{ marginTop: 0 }}>Spelstatistik</div>
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

      {gameStats.length === 0 ? (
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
            .filter(g => !statsOnlyFeatured || g.featured)
            .map(g => (
            <div key={g.list_id}>
              <div
                onClick={() => toggleDistribution(g.list_id)}
                style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 13, cursor: 'pointer' }}
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
                            <div style={{ width: `${Math.max(4, (r.player_count / maxCount) * 100)}%`, background: 'var(--amber)', height: '100%' }} />
                          </div>
                          <span style={{ width: 70, fontSize: 11.5, textAlign: 'right', flexShrink: 0 }} className="subhead">
                            {r.player_count} spelare
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
    </>
  );
}
