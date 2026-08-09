'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function AdminMeddelanden() {
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState([]);
  const [answered, setAnswered] = useState([]);
  const [replyDrafts, setReplyDrafts] = useState({}); // { messageId: text }
  const [msg, setMsg] = useState('');
  const [showAnswered, setShowAnswered] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('support_messages')
      .select('id, message, admin_reply, status, created_at, replied_at, user_id, profiles(username)')
      .order('created_at', { ascending: false });
    const rows = data || [];
    setOpen(rows.filter(r => r.status === 'open'));
    setAnswered(rows.filter(r => r.status === 'answered'));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function sendReply(id) {
    const reply = (replyDrafts[id] || '').trim();
    if (!reply) return;
    setMsg('');
    const { error } = await supabase
      .from('support_messages')
      .update({ admin_reply: reply, status: 'answered', replied_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      setMsg('Kunde inte skicka svar: ' + error.message);
      return;
    }
    setMsg('Svar skickat!');
    await load();
  }

  if (loading) return <p className="subhead">Laddar…</p>;

  return (
    <>
      <div className="cat-title" style={{ marginTop: 0 }}>Meddelanden</div>
      <p className="subhead" style={{ marginBottom: 14 }}>
        Frågor som användare skickat in från sin profil. Ditt svar syns för dem under samma flik hos dem.
      </p>
      {msg && <div className="toast" style={{ marginBottom: 14 }}>{msg}</div>}

      <div className="cat-title" style={{ fontSize: 14, color: '#e0b37f' }}>Obesvarade ({open.length})</div>
      {open.length === 0 ? (
        <p className="subhead" style={{ marginBottom: 20 }}>Inga obesvarade meddelanden. 🎉</p>
      ) : (
        open.map(m => (
          <div key={m.id} className="panel" style={{ marginBottom: 12, borderColor: '#c98f4f' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <span style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: 14 }}>
                {m.profiles?.username || 'Okänd användare'}
              </span>
              <span className="subhead" style={{ fontSize: 11 }}>
                {new Date(m.created_at).toLocaleString('sv-SE')}
              </span>
            </div>
            <p style={{ marginBottom: 12, whiteSpace: 'pre-wrap' }}>{m.message}</p>
            <textarea
              className="field"
              rows={3}
              placeholder="Skriv ditt svar…"
              value={replyDrafts[m.id] || ''}
              onChange={e => setReplyDrafts(prev => ({ ...prev, [m.id]: e.target.value }))}
              style={{ marginBottom: 8, resize: 'vertical' }}
            />
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => sendReply(m.id)}>
              Skicka svar
            </button>
          </div>
        ))
      )}

      <button
        className="plaque"
        style={{ marginTop: 20, marginBottom: 14 }}
        onClick={() => setShowAnswered(s => !s)}
      >
        {showAnswered ? '▾' : '▸'} Besvarade ({answered.length})
      </button>

      {showAnswered && answered.map(m => (
        <div key={m.id} className="panel" style={{ marginBottom: 10, opacity: 0.8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
            <span style={{ fontFamily: "'Oswald', sans-serif", textTransform: 'uppercase', fontSize: 14 }}>
              {m.profiles?.username || 'Okänd användare'}
            </span>
            <span className="subhead" style={{ fontSize: 11 }}>{new Date(m.created_at).toLocaleString('sv-SE')}</span>
          </div>
          <p className="subhead" style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>{m.message}</p>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
            <span className="tag" style={{ marginBottom: 4 }}>Ditt svar</span>
            <p style={{ whiteSpace: 'pre-wrap' }}>{m.admin_reply}</p>
          </div>
        </div>
      ))}
    </>
  );
}
