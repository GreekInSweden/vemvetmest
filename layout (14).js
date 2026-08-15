'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabaseClient';

const FULL_LINKS = [
  { href: '/admin', label: 'Översikt' },
  { href: '/admin/betalningar', label: 'Betalningar' },
  { href: '/admin/ligor', label: 'Ligor' },
  { href: '/admin/spel', label: 'Spel' },
  { href: '/admin/kartan', label: 'Kartan' },
  { href: '/admin/statistik', label: 'Statistik' },
  { href: '/admin/meddelanden', label: 'Meddelanden' }
];

const SEMI_ADMIN_LINKS = [
  { href: '/admin/spel', label: 'Spel' }
];

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState('loading'); // loading | denied | full | semi

  useEffect(() => {
    async function check() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { router.push('/login'); return; }
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, is_semi_admin')
        .eq('id', sessionData.session.user.id)
        .single();

      if (profile?.is_admin) {
        setStatus('full');
      } else if (profile?.is_semi_admin) {
        // Semi-admin får bara vistas under /admin/spel - skickas
        // tillbaka dit om de på något sätt hamnar någon annanstans
        // (t.ex. genom att skriva en annan admin-url direkt).
        if (!pathname.startsWith('/admin/spel')) {
          router.replace('/admin/spel');
          return;
        }
        setStatus('semi');
      } else {
        setStatus('denied');
      }
    }
    check();
  }, [router, pathname]);

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

  const links = status === 'full' ? FULL_LINKS : SEMI_ADMIN_LINKS;

  return (
    <div className="wrap">
      <div className="topbar">
        <a className="btn btn-ghost" href="/">&larr; Alla spel</a>
      </div>

      <header style={{ marginBottom: 20 }}>
        <div className="eyebrow">{status === 'semi' ? 'Adminpanel — spel' : 'Adminpanel'}</div>
        <h1 className="brand" style={{ fontSize: 32 }}>Kan Du Alla</h1>
      </header>

      {/* ---- Meny mellan admin-delarna ---- */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {links.map(l => (
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
