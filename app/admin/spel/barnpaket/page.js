'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';

const ALLA_ALDRAR = [6, 7, 8, 9, 10, 11, 12];

function AlderKryssrutor({ g, listSetter, onSave }) {
  const [valda, setValda] = useState(new Set(g.alder_lista || []));

  function toggle(alder) {
    const nya = new Set(valda);
    if (nya.has(alder)) nya.delete(alder);
    else nya.add(alder);
    setValda(nya);
    onSave(g.id, Array.from(nya).sort((a, b) => a - b), listSetter);
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
      {ALLA_ALDRAR.map((alder) => (
        <label
          key={alder}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            borderRadius: 4,
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            cursor: 'pointer',
            border: `1px solid ${valda.has(alder) ? 'var(--amber)' : 'var(--line)'}`,
            background: valda.has(alder) ? 'rgba(232, 163, 61, 0.18)' : 'transparent',
            color: valda.has(alder) ? 'var(--amber-glow)' : 'var(--muted)',
          }}
          title={`${alder} år`}
        >
          <input type="checkbox" checked={valda.has(alder)} onChange={() => toggle(alder)} style={{ display: 'none' }} />
          {alder}
        </label>
      ))}
    </div>
  );
}

function TidsgransFalt({ g, listSetter, onSave }) {
  const [varde, setVarde] = useState(g.time_limit_seconds ?? '');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
      <input
        type="number"
        value={varde}
        onChange={(e) => setVarde(e.target.value)}
        onBlur={() => onSave(g.id, Number(varde), listSetter)}
        style={{ width: 52, background: 'var(--bg-2, #0a1712)', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--text)', padding: '2px 4px', fontSize: 11 }}
      />
      <span style={{ color: 'var(--muted)' }}>sek</span>
    </div>
  );
}

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
      .select('id, slug, title, tested, alder_lista, time_limit_seconds')
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

  async function sparaAlder(id, alderLista, listSetter) {
    const { error } = await supabase.from('game_lists').update({ alder_lista: alderLista }).eq('id', id);
    if (error) { setMsg('Kunde inte spara ålder: ' + error.message); return; }
    listSetter(prev => prev.map(g => g.id === id ? { ...g, alder_lista: alderLista } : g));
    setMsg('Åldrar sparade.');
  }

  async function sparaTidsgrans(id, sekunder, listSetter) {
    if (!sekunder || sekunder <= 0) return;
    const { error } = await supabase.from('game_lists').update({ time_limit_seconds: sekunder }).eq('id', id);
    if (error) { setMsg('Kunde inte spara tidsgräns: ' + error.message); return; }
    listSetter(prev => prev.map(g => g.id === id ? { ...g, time_limit_seconds: sekunder } : g));
    setMsg('Tidsgräns sparad.');
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
              <AlderKryssrutor g={g} listSetter={setUntested} onSave={sparaAlder} />
              <TidsgransFalt g={g} listSetter={setUntested} onSave={sparaTidsgrans} />
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
              <AlderKryssrutor g={g} listSetter={setTested} onSave={sparaAlder} />
              <TidsgransFalt g={g} listSetter={setTested} onSave={sparaTidsgrans} />
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
