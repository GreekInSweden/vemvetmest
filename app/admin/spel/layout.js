'use client';

import { usePathname } from 'next/navigation';

const SPEL_LINKS = [
  { href: '/admin/spel', label: '📁 Översikt' },
  { href: '/admin/spel/synliga', label: 'Synliga' },
  { href: '/admin/spel/medlemmar', label: 'Medlemsspel' },
  { href: '/admin/spel/pool', label: 'Pool' },
  { href: '/admin/spel/testade', label: 'Testade' },
  { href: '/admin/spel/ej-tilldelade', label: 'Ej tilldelade' },
  { href: '/admin/spel/barnpaket', label: 'Barnpaket' }
];

export default function SpelLayout({ children }) {
  const pathname = usePathname();

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {SPEL_LINKS.map(l => (
          <a
            key={l.href}
            href={l.href}
            className="plaque"
            style={{
              padding: '8px 14px', fontSize: 13,
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
