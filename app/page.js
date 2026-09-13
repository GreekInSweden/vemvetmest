'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Tillfälligt: bara KanDuAlla ska synas. Kartan, Kompass och Party
// finns kvar orörda i koden (app/kartan, app/kompass, app/party) —
// bara dolda, inte borttagna. Slå på hub-sidan igen genom att byta
// tillbaka den här filen mot den sparade hub-versionen när ni är redo.
export default function RootRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/kandualla');
  }, [router]);

  return (
    <div className="wrap">
      <p className="subhead">Laddar…</p>
    </div>
  );
}
