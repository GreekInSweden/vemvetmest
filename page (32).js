'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '../../../../lib/supabaseClient';

export default function BarnStatistik() {
  const router = useRouter();
  const params = useParams();
  const [loading, setLoading] = useState(true);
  const [childUsername, setChildUsername] = useState('');
  const [stats, setStats] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.push('/login'); return; }

      const { data: childProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', params.childId)
        .single();
      setChildUsername(childProfile?.username || 'Barnet');

      const { data, error: rpcError } = await supabase.rpc('child_package_stats', { p_child_profile_id: params.childId });
      if (rpcError) {
        setError('Kunde inte hämta statistik — antingen är du inte förälder till det här kontot, eller så har inget spelats än.');
      } else {
        setStats(data || []);
      }
      setLoading(false);
    }
    load();
  }, [params.childId, router]);

  if (loading) return <div className="wrap"><p className="subhead">Laddar…</p></div>;

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="btn btn-ghost" href="/profil">&larr; Min profil</a>
      </div>

      <header style={{ marginBottom: 24 }}>
        <div className="eyebrow">Barnpaket</div>
        <h1 className="brand" style={{ fontSize: 30 }}>{childUsername}s aktivitet</h1>
      </header>

      {error && <p className="subhead">{error}</p>}

      {!error && stats.length === 0 && (
        <p className="subhead">Inget spelat än — dyker upp här så fort barnet testat något av de 50 spelen.</p>
      )}

      {stats.map(s => {
        const improved = s.best_guessed > s.first_guessed;
        return (
          <div key={s.list_id} className="panel" style={{ marginBottom: 12 }}>
            <div style={{ fontFamily: "'Oswald', sans-serif", fontSize: 16, textTransform: 'uppercase', marginBottom: 8 }}>
              {s.title}
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: improved ? 10 : 0 }}>
              <div className="stat">Spelat <b style={{ color: 'var(--amber-glow)' }}>{s.play_count}</b> {s.play_count === 1 ? 'gång' : 'gånger'}</div>
              <div className="stat">
                Bästa: <b style={{ color: 'var(--amber-glow)' }}>{s.best_guessed}/{s.best_total}</b>
                {s.best_date && <span className="subhead" style={{ fontSize: 11 }}> &middot; {new Date(s.best_date).toLocaleDateString('sv-SE')}</span>}
              </div>
            </div>
            {improved && (
              <div className="toast" style={{ margin: 0 }}>
                🎉 Har blivit bättre! Första försöket {s.first_guessed}/{s.first_total} rätt, nu som bäst {s.best_guessed}/{s.best_total} rätt.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
