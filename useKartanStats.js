'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Läser statistik för en spelare direkt via klienten, skyddat av RLS
 * (kartan_gissningar har policyn "spelare_id = auth.uid()"). Fungerar
 * nu korrekt eftersom appen körs med riktig inloggad session — i
 * Kartans fristående testversion, utan riktiga konton, gick den här
 * vägen inte att använda och en admin-bypass-route behövdes istället.
 */
export function useKartanStats(spelareId, typ, refreshKey = 0) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!spelareId) return;
    let cancelled = false;

    async function fetchStats() {
      setLoading(true);

      const { data: aktivaRundor } = await supabase
        .from('kartan_rundor_public')
        .select('id')
        .eq('typ', typ)
        .eq('is_aktiv', true);

      const aktivaIds = (aktivaRundor ?? []).map((r) => r.id);
      const totaltAntal = aktivaIds.length;

      if (totaltAntal === 0) {
        if (!cancelled) {
          setStats({ totaltAntal: 0, spelade: 0, kvarAntal: 0, snittPoang: 0, bastaPoang: 0 });
          setLoading(false);
        }
        return;
      }

      const { data: gissningar } = await supabase
        .from('kartan_gissningar')
        .select('poang, runda_id')
        .eq('spelare_id', spelareId)
        .in('runda_id', aktivaIds);

      const poangLista = (gissningar ?? []).map((g) => g.poang);
      const spelade = poangLista.length;
      const snittPoang = spelade > 0 ? Math.round(poangLista.reduce((a, b) => a + b, 0) / spelade) : 0;
      const bastaPoang = spelade > 0 ? Math.max(...poangLista) : 0;

      if (!cancelled) {
        setStats({ totaltAntal, spelade, kvarAntal: totaltAntal - spelade, snittPoang, bastaPoang });
        setLoading(false);
      }
    }

    fetchStats();
    return () => {
      cancelled = true;
    };
  }, [spelareId, typ, refreshKey]);

  return { stats, loading };
}
