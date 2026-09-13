'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

async function authedDelete(url) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Något gick fel.');
  return data;
}

function formatDatum(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('sv-SE') + ' ' + d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminPartyPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  async function load() {
    setLoading(true);
    const { data: partier } = await supabase
      .from('party')
      .select('id, namn, kod, status, ledare_id, skapad_at')
      .order('skapad_at', { ascending: false });

    const ledareIds = [...new Set((partier || []).map((p) => p.ledare_id))];
    const { data: profiler } = await supabase
      .from('profiles')
      .select('id, username, paid_until')
      .in('id', ledareIds.length > 0 ? ledareIds : ['00000000-0000-0000-0000-000000000000']);
    const profilMap = Object.fromEntries((profiler || []).map((p) => [p.id, p]));

    const { data: allaDeltagare } = await supabase.from('party_deltagare').select('party_id');
    const antalPerParty = {};
    (allaDeltagare || []).forEach((d) => {
      antalPerParty[d.party_id] = (antalPerParty[d.party_id] || 0) + 1;
    });

    const idag = new Date().toISOString().slice(0, 10);
    const sammanslaget = (partier || []).map((p) => {
      const ledare = profilMap[p.ledare_id];
      const arBetalande = !!ledare?.paid_until && ledare.paid_until >= idag;
      return {
        ...p,
        ledareUsername: ledare?.username || '(okänd)',
        ledareBetalande: arBetalande,
        antalDeltagare: antalPerParty[p.id] || 0,
      };
    });

    setRows(sammanslaget);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function raderaParty(p) {
    const ok = window.confirm(
      `Radera partyt "${p.namn}" (${p.kod}) permanent? Alla deltagare, rundor och resultat försvinner med. Går inte att ångra.`
    );
    if (!ok) return;
    setMsg('');
    try {
      await authedDelete(`/api/admin/party/${p.id}`);
      setRows((prev) => prev.filter((r) => r.id !== p.id));
      setMsg(`"${p.namn}" raderat.`);
    } catch (e) {
      setMsg('Kunde inte radera: ' + e.message);
    }
  }

  if (loading) return <p className="subhead">Laddar…</p>;

  const igangNu = rows.filter((p) => p.status !== 'avslutad').length;

  return (
    <div>
      <div className="cat-title">Party — ledare och deltagare</div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div className="plaque" style={{ cursor: 'default', textAlign: 'center', flex: 1 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, color: 'var(--amber-glow)' }}>{igangNu}</div>
          <div className="subhead" style={{ fontSize: 11 }}>igång just nu (lobby + aktiv)</div>
        </div>
        <div className="plaque" style={{ cursor: 'default', textAlign: 'center', flex: 1 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22 }}>{rows.length}</div>
          <div className="subhead" style={{ fontSize: 11 }}>totalt skapade</div>
        </div>
      </div>

      {msg && <div className="toast" style={{ marginBottom: 14 }}>{msg}</div>}
      {rows.length === 0 && <p className="subhead">Inga party har skapats än.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {rows.map((p) => (
          <div
            key={p.id}
            className="plaque"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'default', gap: 12 }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>
                {p.namn} <span className="subhead" style={{ fontSize: 11 }}>({p.kod})</span>
              </div>
              <div className="subhead" style={{ fontSize: 12 }}>
                Ledare: {p.ledareUsername}
                {!p.ledareBetalande && (
                  <span style={{ color: '#e78a6c' }}> — inte betalande just nu</span>
                )}
              </div>
              <div className="subhead" style={{ fontSize: 11 }}>Skapat: {formatDatum(p.skapad_at)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>
                  {p.antalDeltagare} deltagare
                </div>
                <div className="subhead" style={{ fontSize: 11, textTransform: 'uppercase' }}>{p.status}</div>
              </div>
              <button
                onClick={() => raderaParty(p)}
                style={{ background: 'none', border: 'none', color: 'var(--miss)', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: '2px 4px' }}
                title="Radera party"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
