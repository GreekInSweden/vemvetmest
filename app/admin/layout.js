'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

const LINKS = [
  { href: '/admin', label: 'Översikt' },
  { href: '/admin/betalningar', label: 'Betalningar' },
  { href: '/admin/ligor', label: 'Ligor' },
  { href: '/admin/spel', label: 'Spel' },
  { href: '/admin/statistik', label: 'Statistik' }
];

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState('loading'); // loading | denied | ok

  useEffect(() => {
    async function check() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.push('/login'); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', sessionData.session.user.id)
        .single();
      setStatus(profile?.is_admin ? 'ok' : 'denied');
    }
    check();
  }, [router]);

  if (status === 'loading') {
    return <div className="wrap"><p className="subhead">Laddar…</p></div>;
  }

  if (status === 'denied') {
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
        <h1 className="brand" style={{ fontSize: 32 }}>Kan Du Alla</h1>
      </header>

      {/* ---- Meny mellan admin-delarna ---- */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {LINKS.map(l => (
          <a
            key={l.href}
            href={l.href}
            className="plaque"
            style={{
              borderColor: pathname === l.href ? 'var(--amber)' : undefined,
              color: pathname === l.href ? 'var(--text)' : undefined
            }}
          >
            {l.label}
          </a>
        ))}
      </div>

      {children}
    </div>
  );
}
