'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function AdminStatistik() {
  const [view, setView] = useState('spel'); // 'spel' | 'medlem'
  const [gameStats, setGameStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsOnlyFeatured, setStatsOnlyFeatured] = useState(true);
  const [distribution, setDistribution] = useState({});
  const [realTotals, setRealTotals] = useState({});
  const [openDistributionId, setOpenDistributionId] = useState(null);

  // ---- Medlemsvy ----
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState([]);
  const [memberSearching, setMemberSearching] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null); // { id, username }
  const [memberStats, setMemberStats] = useState([]);
  const [memberStatsLoading, setMemberStatsLoading] = useState(false);

  // ---- Export ----
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');

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
    if (!realTotals[listId]) {
      const { count } = await supabase
        .from('list_items')
        .select('id', { count: 'exact', head: true })
        .eq('list_id', listId);
      setRealTotals(prev => ({ ...prev, [listId]: count || 0 }));
    }
  }

  async function searchMembers(e) {
    e.preventDefault();
    const term = memberSearch.trim();
    if (!term) { setMemberResults([]); return; }
    setMemberSearching(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', `%${term}%`)
      .limit(15);
    setMemberSearching(false);
    setMemberResults(data || []);
  }

  async function selectMember(member) {
    setSelectedMember(member);
    setMemberResults([]);
    setMemberSearch('');
    setMemberStatsLoading(true);
    const { data, error } = await supabase.rpc('member_play_stats', { p_user_id: member.id });
    setMemberStatsLoading(false);
    if (!error) setMemberStats(data || []);
  }

  async function exportToExcel() {
    setExporting(true);
    setExportMsg('');
    try {
      const XLSX = await import('xlsx');
      const { data, error } = await supabase
        .from('results')
        .select('created_at, guessed, total, misses, seconds, difficulty, completed, profiles(username), game_lists(title)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows = (data || []).map(r => ({
        Användarnamn: r.profiles?.username || '(anonym)',
        Spel: r.game_lists?.title || '(borttaget spel)',
        Datum: r.created_at ? new Date(r.created_at).toLocaleString('sv-SE') : '',
        Rätt: r.guessed,
        Totalt: r.total,
        Fel: r.misses,
        'Tid (sek)': r.seconds,
        Svårighetsgrad: r.difficulty,
        Klarat: r.completed ? 'Ja' : 'Nej'
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Alla spelningar');
      XLSX.writeFile(workbook, `kan-du-alla-statistik-${new Date().toISOString().slice(0, 10)}.xlsx`);

      setExportMsg(`Klart! ${rows.length} rader exporterade.`);
    } catch (err) {
      setExportMsg('Kunde inte exportera: ' + err.message);
    }
    setExporting(false);
  }

  if (loading) return <p className="subhead">Laddar…</p>;

  return (
    <>
      <div className="cat-title" style={{ marginTop: 0 }}>Spelstatistik</div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <button className="plaque" style={{ borderColor: view === 'spel' ? 'var(--amber)' : undefined }} onClick={() => setView('spel')}>
          Per spel
        </button>
        <button className="plaque" style={{ borderColor: view === 'medlem' ? 'var(--amber)' : undefined }} onClick={() => setView('medlem')}>
          Per medlem
        </button>
        <span style={{ flex: 1 }} />
        <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={exportToExcel} disabled={exporting}>
          {exporting ? 'Exporterar…' : '⬇ Exportera allt till Excel'}
        </button>
      </div>
      {exportMsg && <div className="toast" style={{ marginBottom: 14 }}>{exportMsg}</div>}

      {/* ================= PER SPEL ================= */}
      {view === 'spel' && (
        <>
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
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '4px 8px', padding: '4px 0', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                <span>Spel</span>
                <span style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ width: 36, textAlign: 'right' }}>Anon</span>
                  <span style={{ width: 46, textAlign: 'right' }}>Medlem</span>
                  <span style={{ width: 50, textAlign: 'right' }}>Snitt</span>
                  <span style={{ width: 58, textAlign: 'right' }}>Klarat</span>
                </span>
              </div>
              {gameStats
                .filter(g => !statsOnlyFeatured || g.featured)
                .map(g => (
                <div key={g.list_id}>
                  <div
                    onClick={() => toggleDistribution(g.list_id)}
                    style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '4px 8px', padding: '8px 0', borderBottom: '1px solid var(--line)', fontSize: 13, cursor: 'pointer' }}
                  >
                    <span style={{ flex: '1 1 140px', minWidth: 0 }}>
                      {openDistributionId === g.list_id ? '▾' : '▸'} {g.title}
                      {!g.featured && <span className="subhead" style={{ fontSize: 10.5, marginLeft: 6 }}>(dolt)</span>}
                    </span>
                    <span style={{ display: 'flex', gap: 12, flexWrap: 'wrap', flexShrink: 0 }}>
                      <span style={{ width: 36, textAlign: 'right', color: '#9ab8e6' }}>{g.anon_count}</span>
                      <span style={{ width: 46, textAlign: 'right', color: 'var(--amber-glow)' }}>{g.member_count}</span>
                      <span style={{ width: 50, textAlign: 'right' }} className="subhead">{g.avg_percent != null ? `${g.avg_percent}%` : '—'}</span>
                      <span style={{ width: 58, textAlign: 'right' }} className="subhead">{g.completion_rate != null ? `${g.completion_rate}%` : '—'}</span>
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
                          const totalItems = realTotals[g.list_id] || rows[0]?.total || '?';
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
      )}

      {/* ================= PER MEDLEM ================= */}
      {view === 'medlem' && (
        <>
          <p className="subhead" style={{ fontSize: 12.5, marginBottom: 14 }}>
            Sök upp en medlem för att se allt de spelat — vilka spel, hur många gånger, och bästa resultat.
          </p>

          <form onSubmit={searchMembers} className="input-row" style={{ marginBottom: 14 }}>
            <input
              className="field"
              placeholder="Sök på användarnamn…"
              value={memberSearch}
              onChange={e => setMemberSearch(e.target.value)}
            />
            <button className="btn btn-primary" style={{ width: 'auto' }} type="submit" disabled={memberSearching}>
              {memberSearching ? 'Söker…' : 'Sök'}
            </button>
          </form>

          {memberResults.length > 0 && (
            <div className="list-grid" style={{ marginBottom: 20 }}>
              {memberResults.map(m => (
                <button key={m.id} className="plaque" style={{ textAlign: 'left' }} onClick={() => selectMember(m)}>
                  {m.username}
                </button>
              ))}
            </div>
          )}

          {selectedMember && (
            <>
              <div className="cat-title" style={{ fontSize: 15 }}>
                {selectedMember.username}s spelhistorik
                <button
                  className="btn btn-ghost"
                  style={{ width: 'auto', padding: '3px 10px', fontSize: 11, marginLeft: 12 }}
                  onClick={() => { setSelectedMember(null); setMemberStats([]); }}
                >
                  Byt medlem
                </button>
              </div>

              {memberStatsLoading ? (
                <p className="subhead">Laddar…</p>
              ) : memberStats.length === 0 ? (
                <p className="subhead">Har inte spelat något än.</p>
              ) : (
                memberStats.map(s => {
                  const pct = s.best_total ? Math.round((s.best_guessed / s.best_total) * 100) : 0;
                  return (
                    <div key={s.list_id} className="panel" style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: 14 }}>{s.title}</span>
                        <span className="subhead" style={{ fontSize: 11 }}>
                          Spelat {s.play_count}x &middot; Senast {s.last_played ? new Date(s.last_played).toLocaleDateString('sv-SE') : '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, background: 'var(--panel)', borderRadius: 3, overflow: 'hidden', height: 16 }}>
                          <div style={{ width: `${Math.max(4, pct)}%`, background: 'var(--amber)', height: '100%' }} />
                        </div>
                        <span style={{ fontSize: 12.5, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0, width: 90, textAlign: 'right' }}>
                          {s.best_guessed}/{s.best_total} ({pct}%)
                        </span>
                      </div>
                      {s.avg_percent != null && (
                        <p className="subhead" style={{ fontSize: 11, marginTop: 6, marginBottom: 0 }}>
                          Snitt över alla försök: {s.avg_percent}%
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </>
      )}
    </>
  );
}
