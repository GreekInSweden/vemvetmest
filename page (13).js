'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function AdminLigor() {
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  async function load() {
    const { data: pendingLeagues } = await supabase
      .from('leagues')
      .select('*')
      .eq('status', 'pending')
      .order('created_at');
    const { data: approvedLeagues } = await supabase
      .from('leagues')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(20);

    setPending(pendingLeagues || []);
    setApproved(approvedLeagues || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function approve(id) {
    setMsg('');
    const { error } = await supabase.from('leagues').update({ status: 'approved' }).eq('id', id);
    if (error) { setMsg('Kunde inte godkänna: ' + error.message); return; }
    load();
  }

  async function reject(id) {
    setMsg('');
    const { error } = await supabase.from('leagues').update({ status: 'rejected' }).eq('id', id);
    if (error) { setMsg('Kunde inte neka: ' + error.message); return; }
    load();
  }

  async function remove(id, name) {
    if (!window.confirm(`Ta bort ligan "${name}" permanent? Alla medlemskap tas bort samtidigt.`)) return;
    setMsg('');
    const { error } = await supabase.from('leagues').delete().eq('id', id);
    if (error) { setMsg('Kunde inte ta bort: ' + error.message); return; }
    load();
  }

  if (loading) return <p className="subhead">Laddar…</p>;

  return (
    <>
      {msg && <div className="error-msg">{msg}</div>}

      <div className="cat-title" style={{ marginTop: 0 }}>Väntar på godkännande ({pending.length})</div>
      {pending.length === 0 && <p className="subhead" style={{ marginBottom: 20 }}>Inga väntande ansökningar.</p>}
      {pending.map(l => (
        <div key={l.id} className="panel" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, textTransform: 'uppercase' }}>{l.name}</div>
            <div className="subhead" style={{ fontSize: 12 }}>Skapad {new Date(l.created_at).toLocaleDateString('sv-SE')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => approve(l.id)}>Godkänn</button>
            <button className="btn btn-ghost" onClick={() => reject(l.id)}>Neka</button>
            <button className="btn btn-ghost" style={{ color: 'var(--miss)' }} onClick={() => remove(l.id, l.name)}>Ta bort</button>
          </div>
        </div>
      ))}

      <div className="cat-title" style={{ marginTop: 30 }}>Senast godkända</div>
      {approved.length === 0 && <p className="subhead">Inga godkända ligor än.</p>}
      {approved.map(l => (
        <div key={l.id} className="panel" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, textTransform: 'uppercase' }}>{l.name}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="stat" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{l.invite_code}</div>
            <button className="btn btn-ghost" style={{ color: 'var(--miss)' }} onClick={() => remove(l.id, l.name)}>Ta bort</button>
          </div>
        </div>
      ))}
    </>
  );
}
