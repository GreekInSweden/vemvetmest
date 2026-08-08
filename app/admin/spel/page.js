'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function AdminSpel() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [games, setGames] = useState([]);
  const [checked, setChecked] = useState(new Set());
  const [checkedMember, setCheckedMember] = useState(new Set());
  const [checkedPool, setCheckedPool] = useState(new Set());
  const [openFolder, setOpenFolder] = useState(null);
  const [dailyUsage, setDailyUsage] = useState({});
  const [gamesMsg, setGamesMsg] = useState('');
  const [savingGames, setSavingGames] = useState(false);

  async function load() {
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

  function toggleGame(id) {
    setChecked(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleMemberGame(id) {
    setCheckedMember(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function togglePoolGame(id) {
    setCheckedPool(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
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
      ...g, featured: checked.has(g.id), member_exclusive: checkedMember.has(g.id), daily_pool: checkedPool.has(g.id)
    })));
  }

  async function removeGame(id, title) {
    if (!window.confirm(`Ta bort spelet "${title}" permanent? Detta tar även bort eventuell historik om spelet någon gång använts som Dagens Utmaning. Går inte att ångra.`)) return;
    setGamesMsg('');
    const { error } = await supabase.from('game_lists').delete().eq('id', id);
    if (error) { setGamesMsg('Kunde inte ta bort: ' + error.message); return; }
    setGames(prev => prev.filter(g => g.id !== id));
    setChecked(prev => { const next = new Set(prev); next.delete(id); return next; });
    setGamesMsg(`"${title}" borttaget.`);
  }

  if (loading) return <p className="subhead">Laddar…</p>;

  return (
    <>
      <header style={{ marginBottom: 20 }}>
        <p className="subhead">
          <b style={{ color: 'var(--amber-glow)' }}>Synligt</b> = visas för alla, även utan konto.{' '}
          <b style={{ color: '#9ab8e6' }}>Medlem</b> = kräver inloggning, inget betalt medlemskap.{' '}
          <b style={{ color: '#7fc98f' }}>Pool</b> = kan slumpas fram som Dagens utmaning. Ett spel som inte har
          någon kryssruta ibockad syns ingenstans för vanliga besökare — bara du kan testspela det, precis rätt
          för nya listor innan du litar på dem.
        </p>
      </header>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={saveGames} disabled={savingGames}>
          {savingGames ? 'Sparar…' : 'Spara'}
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
                              <input type="checkbox" checked onChange={() => f.toggle(g.id)} style={{ width: 16, height: 16, accentColor: f.color }} />
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

      {/* ---- Legend ---- */}
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
                      <input type="checkbox" checked={checked.has(g.id)} onChange={() => toggleGame(g.id)} style={{ width: 16, height: 16, accentColor: 'var(--amber)' }} />
                      <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.03em', color: 'var(--amber-glow)' }}>SYN</span>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: 1 }} title="Medlemsspel (kräver konto, inte betalning)">
                      <input type="checkbox" checked={checkedMember.has(g.id)} onChange={() => toggleMemberGame(g.id)} style={{ width: 16, height: 16, accentColor: '#5b8fd6' }} />
                      <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.03em', color: '#9ab8e6' }}>MED</span>
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: 1 }} title="Kan slumpas fram som Dagens utmaning">
                      <input type="checkbox" checked={checkedPool.has(g.id)} onChange={() => togglePoolGame(g.id)} style={{ width: 16, height: 16, accentColor: '#4f9e63' }} />
                      <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.03em', color: '#7fc98f' }}>POOL</span>
                    </label>
                    <button
                      onClick={() => removeGame(g.id, g.title)}
                      style={{ background: 'none', border: 'none', color: 'var(--miss)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px' }}
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
    </>
  );
}
