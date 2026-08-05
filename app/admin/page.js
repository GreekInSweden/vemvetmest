'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(null);
  const [pending, setPending] = useState([]);
  const [approved, setApproved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.push('/login');
      return;
    }
    const userId = sessionData.session.user.id;

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single();

    if (!profile?.is_admin) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }
    setIsAdmin(true);

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

  if (loading) return <div className="wrap"><p className="subhead">Laddar…</p></div>;

  if (isAdmin === false) {
    return (
      <div className="wrap">
        <p className="subhead">Den här sidan är bara till för administratörer.</p>
        <a className="btn btn-ghost" href="/">&larr; Till startsidan</a>
      </div>
    );
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="btn btn-ghost" href="/">&larr; Alla spel</a>
      </div>

      <header style={{ marginBottom: 20 }}>
        <div className="eyebrow">Adminpanel</div>
        <h1 className="brand" style={{ fontSize: 32 }}>Godkänn ligor</h1>
      </header>

      {msg && <div className="error-msg">{msg}</div>}

      <div className="cat-title">Väntar på godkännande ({pending.length})</div>
      {pending.length === 0 && <p className="subhead" style={{ marginBottom: 20 }}>Inga väntande ansökningar.</p>}
      {pending.map(l => (
        <div key={l.id} className="panel" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, textTransform: 'uppercase' }}>{l.name}</div>
            <div className="subhead" style={{ fontSize: 12 }}>Skapad {new Date(l.created_at).toLocaleDateString('sv-SE')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => approve(l.id)}>Godkänn</button>
            <button className="btn btn-ghost" onClick={() => reject(l.id)}>Neka</button>
          </div>
        </div>
      ))}

      <div className="cat-title" style={{ marginTop: 30 }}>Senast godkända</div>
      {approved.length === 0 && <p className="subhead">Inga godkända ligor än.</p>}
      {approved.map(l => (
        <div key={l.id} className="panel" style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 15, textTransform: 'uppercase' }}>{l.name}</div>
          <div className="stat" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{l.invite_code}</div>
        </div>
      ))}
    </div>
  );
}
