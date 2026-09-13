'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function AdminPartyPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
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
    load();
  }, []);

  if (loading) return <p className="subhead">Laddar…</p>;

  return (
    <div>
      <div className="cat-title">Party — ledare och deltagare</div>
      {rows.length === 0 && <p className="subhead">Inga party har skapats än.</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {rows.map((p) => (
          <div
            key={p.id}
            className="plaque"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'default' }}
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
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14 }}>
                {p.antalDeltagare} deltagare
              </div>
              <div className="subhead" style={{ fontSize: 11, textTransform: 'uppercase' }}>{p.status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
