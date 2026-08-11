'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';

export default function BarnpaketSpel() {
  const [loading, setLoading] = useState(true);
  const [untested, setUntested] = useState([]); // child_package=true, tested=false
  const [tested, setTested] = useState([]);      // child_package=true, tested=true
  const [msg, setMsg] = useState('');

  // ---- Lägg till nya spel ----
  const [addSearch, setAddSearch] = useState('');
  const [addResults, setAddResults] = useState([]);
  const [addSearching, setAddSearching] = useState(false);

  async function loadMembers() {
    setLoading(true);
    const { data } = await supabase
      .from('game_lists')
      .select('id, slug, title, tested')
      .eq('child_package', true)
      .order('title');
    const rows = data || [];
    setUntested(rows.filter(g => !g.tested));
    setTested(rows.filter(g => g.tested));
    setLoading(false);
  }

  useEffect(() => { loadMembers(); }, []);

  async function removeFromPackage(id, title) {
    setMsg('');
    const { error } = await supabase.from('game_lists').update({ child_package: false }).eq('id', id);
    if (error) { setMsg('Kunde inte ta bort: ' + error.message); return; }
    setUntested(prev => prev.filter(g => g.id !== id));
    setTested(prev => prev.filter(g => g.id !== id));
    setMsg(`"${title}" borttaget ur Barnpaketet.`);
  }

  async function markTested(g, value) {
    setMsg('');
    const { error } = await supabase.from('game_lists').update({ tested: value }).eq('id', g.id);
    if (error) { setMsg('Kunde inte ändra: ' + error.message); return; }
    if (value) {
      setUntested(prev => prev.filter(x => x.id !== g.id));
      setTested(prev => [...prev, { ...g, tested: true }].sort((a, b) => a.title.localeCompare(b.title)));
    } else {
      setTested(prev => prev.filter(x => x.id !== g.id));
      setUntested(prev => [...prev, { ...g, tested: false }].sort((a, b) => a.title.localeCompare(b.title)));
    }
    setMsg(`"${g.title}" markerat som ${value ? 'testat' : 'ej testat'}.`);
  }

  async function searchToAdd(e) {
    e.preventDefault();
    const term = addSearch.trim();
    if (!term) { setAddResults([]); return; }
    setAddSearching(true);
    const { data } = await supabase
      .from('game_lists')
      .select('id, slug, title, child_package')
      .ilike('title', `%${term}%`)
      .order('title')
      .limit(15);
    setAddSearching(false);
    setAddResults((data || []).filter(g => !g.child_package)); // dölj de som redan är med
  }

  async function addToPackage(g) {
    setMsg('');
    const { error } = await supabase.from('game_lists').update({ child_package: true }).eq('id', g.id);
    if (error) { setMsg('Kunde inte lägga till: ' + error.message); return; }
    setAddResults(prev => prev.filter(x => x.id !== g.id));
    // Nya spel hamnar alltid som "ej testade" - precis som huvudpoolens
    // "Ej tilldelade"-tanke, fast skalad ner till bara Barnpaketet.
    setUntested(prev => [...prev, { id: g.id, slug: g.slug, title: g.title, tested: false }].sort((a, b) => a.title.localeCompare(b.title)));
    setMsg(`"${g.title}" tillagt i Barnpaketet — markera som testat när du kollat igenom det.`);
  }

  if (loading) return <p className="subhead">Laddar…</p>;

  return (
    <>
      <div className="cat-title" style={{ marginTop: 0, color: '#e0b37f' }}>📂 Barnpaket</div>
      <p className="subhead" style={{ marginBottom: 14 }}>
        Helt separat pool, blandas aldrig med de andra fyra nivåerna. Nya spel hamnar under
        "Ej testade" tills du kryssat igenom dem — precis som huvudpoolens system, fast inom Barnpaketet.
      </p>
      {msg && <div className="toast" style={{ marginBottom: 14 }}>{msg}</div>}

      {/* ---- Ej testade ---- */}
      <div className="cat-title" style={{ fontSize: 14, color: '#bbb' }}>📁 Ej testade ({untested.length})</div>
      {untested.length === 0 ? (
        <p className="subhead" style={{ marginBottom: 20 }}>Inga otestade spel just nu.</p>
      ) : (
        <div className="list-grid" style={{ marginBottom: 24 }}>
          {untested.map(g => (
            <div key={g.id} className="plaque" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderColor: '#888' }}>
              <span style={{ flex: '1 1 120px', minWidth: 0 }}>{g.title}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <a href={`/play/${g.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 11 }} title="Testspela">🔍</a>
                <button
                  className="btn btn-ghost"
                  style={{ width: 'auto', padding: '3px 10px', fontSize: 11, borderColor: '#7fc98f' }}
                  onClick={() => markTested(g, true)}
                >
                  ✓ Markera testat
                </button>
                <button
                  onClick={() => removeFromPackage(g.id, g.title)}
                  style={{ background: 'none', border: 'none', color: 'var(--miss)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '2px 4px' }}
                  title="Ta bort ur Barnpaketet"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- Testade och klara ---- */}
      <div className="cat-title" style={{ fontSize: 14, color: '#7fc98f' }}>📁 Testade och klara ({tested.length})</div>
      {tested.length === 0 ? (
        <p className="subhead" style={{ marginBottom: 20 }}>Inga testade spel än.</p>
      ) : (
        <div className="list-grid" style={{ marginBottom: 24 }}>
          {tested.map(g => (
            <div key={g.id} className="plaque" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderColor: '#7fc98f' }}>
              <span style={{ flex: '1 1 120px', minWidth: 0 }}>{g.title}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <a href={`/play/${g.slug}`} target="_blank" rel="noreferrer" style={{ fontSize: 11 }} title="Testspela">🔍</a>
                <button
                  className="btn btn-ghost"
                  style={{ width: 'auto', padding: '3px 10px', fontSize: 11 }}
                  onClick={() => markTested(g, false)}
                  title="Flytta tillbaka till Ej testade"
                >
                  Ångra
                </button>
                <button
                  onClick={() => removeFromPackage(g.id, g.title)}
                  style={{ background: 'none', border: 'none', color: 'var(--miss)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '2px 4px' }}
                  title="Ta bort ur Barnpaketet"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="panel" style={{ border: '1px dashed var(--line)' }}>
        <div className="cat-title" style={{ fontSize: 13, marginTop: 0 }}>Lägg till fler spel</div>
        <form onSubmit={searchToAdd} className="input-row" style={{ marginBottom: 10 }}>
          <input
            className="field"
            placeholder="Sök bland alla spel…"
            value={addSearch}
            onChange={e => setAddSearch(e.target.value)}
          />
          <button className="btn btn-primary" style={{ width: 'auto' }} type="submit" disabled={addSearching}>
            {addSearching ? 'Söker…' : 'Sök'}
          </button>
        </form>
        {addResults.length > 0 && (
          <div className="list-grid">
            {addResults.map(g => (
              <button
                key={g.id}
                className="plaque"
                style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left', gap: '2px 8px' }}
                onClick={() => addToPackage(g)}
              >
                <span>{g.title}</span>
                <span style={{ color: '#e0b37f', fontSize: 12 }}>+ Lägg till</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
