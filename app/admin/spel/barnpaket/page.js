'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';

export default function BarnpaketSpel() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState([]); // bara de spel som HAR child_package = true
  const [msg, setMsg] = useState('');

  // ---- Lägg till nya spel ----
  const [addSearch, setAddSearch] = useState('');
  const [addResults, setAddResults] = useState([]);
  const [addSearching, setAddSearching] = useState(false);

  async function loadMembers() {
    setLoading(true);
    const { data } = await supabase
      .from('game_lists')
      .select('id, slug, title')
      .eq('child_package', true)
      .order('title');
    setMembers(data || []);
    setLoading(false);
  }

  useEffect(() => { loadMembers(); }, []);

  async function removeFromPackage(id, title) {
    setMsg('');
    const { error } = await supabase.from('game_lists').update({ child_package: false }).eq('id', id);
    if (error) { setMsg('Kunde inte ta bort: ' + error.message); return; }
    setMembers(prev => prev.filter(g => g.id !== id));
    setMsg(`"${title}" borttaget ur Barnpaketet.`);
  }

  async function searchToAdd(e) {
    e.preventDefault();
    const term = addSearch.trim();
    if (!term) { setAddResults([]); return; }
    setAddSearching(true);
    const { data } = await supabase
      .from('game_lists')
      .select('id, title, child_package')
      .ilike('title', `%${term}%`)
      .order('title')
      .limit(15);
    setAddSearching(false);
    setAddResults((data || []).filter(g => !g.child_package)); // dölj de som redan är med
  }

  async function addToPackage(id, title) {
    setMsg('');
    const { error } = await supabase.from('game_lists').update({ child_package: true }).eq('id', id);
    if (error) { setMsg('Kunde inte lägga till: ' + error.message); return; }
    setAddResults(prev => prev.filter(g => g.id !== id));
    setMembers(prev => [...prev, { id, title }].sort((a, b) => a.title.localeCompare(b.title)));
    setMsg(`"${title}" tillagt i Barnpaketet.`);
  }

  if (loading) return <p className="subhead">Laddar…</p>;

  return (
    <>
      <div className="cat-title" style={{ marginTop: 0, color: '#e0b37f' }}>📂 Barnpaket</div>
      <p className="subhead" style={{ marginBottom: 14 }}>
        Helt separat pool, blandas aldrig med de andra fyra nivåerna. Detta är de spel som ingår när
        någon köper Barnpaketet (99 kr/år). Listan nedan visar <b style={{ color: '#e0b37f' }}>bara de spel som redan är med</b> —
        bocka ur för att ta bort. Vill du lägga till fler, sök i rutan längre ner.
      </p>
      {msg && <div className="toast" style={{ marginBottom: 14 }}>{msg}</div>}

      <div className="cat-title" style={{ fontSize: 14 }}>Nuvarande spel ({members.length})</div>
      {members.length === 0 ? (
        <p className="subhead" style={{ marginBottom: 20 }}>Inga spel i Barnpaketet än — sök nedan för att lägga till några.</p>
      ) : (
        <div className="list-grid" style={{ marginBottom: 24 }}>
          {members.map(g => (
            <div
              key={g.id}
              className="plaque"
              style={{ display: 'flex', alignItems: 'center', gap: 10, borderColor: '#c98f4f' }}
            >
              <input
                type="checkbox"
                checked
                onChange={() => removeFromPackage(g.id, g.title)}
                style={{ width: 16, height: 16, accentColor: '#c98f4f', cursor: 'pointer' }}
              />
              <span style={{ flex: 1 }}>{g.title}</span>
              <a
                href={`/play/${g.slug}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 11 }}
                title="Testspela"
              >
                🔍
              </a>
            </div>
          ))}
        </div>
      )}

      <div className="panel" style={{ border: '1px dashed var(--line)' }}>
        <div className="cat-title" style={{ fontSize: 13, marginTop: 0 }}>Lägg till fler spel</div>
        <form onSubmit={searchToAdd} className="input-row" style={{ marginBottom: 10 }}>
          <input
            className="field"
            placeholder="Sök bland alla 351 spel…"
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
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left' }}
                onClick={() => addToPackage(g.id, g.title)}
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
