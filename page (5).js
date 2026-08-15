'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export default function AdminSpelOverview() {
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ featured: 0, member: 0, pool: 0, tested: 0, untested: 0, childPackage: 0, total: 0 });

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('game_lists').select('featured, member_exclusive, daily_pool, tested, child_package');
      const rows = data || [];
      setCounts({
        featured: rows.filter(g => g.featured && !g.child_package).length,
        member: rows.filter(g => g.member_exclusive && !g.child_package).length,
        pool: rows.filter(g => g.daily_pool && !g.child_package).length,
        tested: rows.filter(g => g.tested && !g.child_package).length,
        childPackage: rows.filter(g => g.child_package).length,
        untested: rows.filter(g => !g.featured && !g.member_exclusive && !g.daily_pool && !g.tested && !g.child_package).length,
        total: rows.length
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p className="subhead">Laddar…</p>;

  const cards = [
    { href: '/admin/spel/synliga', label: 'Synliga spel', count: counts.featured, glow: 'var(--amber-glow)', border: 'var(--amber)' },
    { href: '/admin/spel/medlemmar', label: 'Medlemsspel', count: counts.member, glow: '#9ab8e6', border: '#5b8fd6' },
    { href: '/admin/spel/pool', label: 'Dagens utmaning-pool', count: counts.pool, glow: '#7fc98f', border: '#4f9e63' },
    { href: '/admin/spel/testade', label: 'Testade spel', count: counts.tested, glow: '#e0b37f', border: '#c98f4f' },
    { href: '/admin/spel/ej-tilldelade', label: 'Ej tilldelade (testläge)', count: counts.untested, glow: '#bbb', border: '#888' },
    { href: '/admin/spel/barnpaket', label: 'Barnpaket', count: counts.childPackage, glow: '#e0b37f', border: '#c98f4f' }
  ];

  return (
    <>
      <p className="subhead" style={{ marginBottom: 20 }}>
        {counts.total} spel totalt. Klicka in i en kategori för att se, redigera och flytta spel mellan lägena.
      </p>
      <div className="list-grid">
        {cards.map(c => (
          <a
            key={c.href}
            href={c.href}
            className="plaque"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: c.count > 0 ? c.border : undefined }}
          >
            <span style={{ color: c.glow }}>{c.label}</span>
            <span className="subhead" style={{ fontSize: 12 }}>{c.count} spel</span>
          </a>
        ))}
      </div>
    </>
  );
}
