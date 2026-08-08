'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabaseClient';

export default function BarnpaketSpel() {
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState([]);
  const [checked, setChecked] = useState(new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('game_lists').select('id, title, child_package').order('title');
      const rows = data || [];
      setGames(rows);
      setChecked(new Set(rows.filter(g => g.child_package).map(g => g.id)));
      setLoading(false);
    }
    load();
  }, []);

  function toggle(id) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setMsg('');
    const allIds = games.map(g => g.id);
    const onIds = allIds.filter(id => checked.has(id));
    const offIds = allIds.filter(id => !checked.has(id));
    if (onIds.length > 0) await supabase.from('game_lists').update({ child_package: true }).in('id', onIds);
    if (offIds.length > 0) await supabase.from('game_lists').update({ child_package: false }).in('id', offIds);
    setSaving(false);
    setMsg(`Sparat! ${checked.size} spel i barnpaketet.`);
    setGames(prev => prev.map(g => ({ ...g, child_package: checked.has(g.id) })));
  }

  if (loading) return <p className="subhead">Laddar…</p>;

  const visible = games.filter(g => g.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="cat-title" style={{ marginTop: 0, color: '#e0b37f' }}>📂 Barnpaket</div>
      <p className="subhead" style={{ marginBottom: 14 }}>
        Helt separat pool, blandas aldrig med de andra fyra nivåerna. Detta är de spel som ingår när
        någon köper Barnpaketet (99 kr, permanent tillgång). Rekommenderat: ca 50 spel, gärna en bra
        blandning av redan byggt Gaming & Familj-innehåll och skolrelaterat.
      </p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={save} disabled={saving}>
          {saving ? 'Sparar…' : 'Spara'}
        </button>
        <input
          className="field"
          style={{ maxWidth: 240 }}
          placeholder="Sök bland alla spel…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="subhead" style={{ fontSize: 12 }}>{checked.size} valda av {games.length} totalt</span>
        {msg && <span className="toast" style={{ margin: 0 }}>{msg}</span>}
      </div>

      <div className="list-grid">
        {visible.map(g => (
          <label
            key={g.id}
            className="plaque"
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderColor: checked.has(g.id) ? '#c98f4f' : undefined }}
          >
            <input
              type="checkbox"
              checked={checked.has(g.id)}
              onChange={() => toggle(g.id)}
              style={{ width: 16, height: 16, accentColor: '#c98f4f' }}
            />
            {g.title}
          </label>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={save} disabled={saving}>
          {saving ? 'Sparar…' : 'Spara'}
        </button>
      </div>
    </>
  );
}
