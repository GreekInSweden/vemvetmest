'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/** Hämtar alla publicerade paket — det spelaren väljer bland. */
export function usePubliceradePaket() {
  const [paket, setPaket] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from('kartan_paket')
      .select('id, namn, vy_lat_min, vy_lat_max, vy_lon_min, vy_lon_max, kraver_medlemskap')
      .eq('status', 'publicerad')
      .order('skapad_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          setPaket(data ?? []);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { paket, loading };
}

/**
 * Hämtar frågorna i ett specifikt paket, i rätt ordning — utan facit.
 * Frågorna kommer via kartan_rundor_public, som medvetet exkluderar
 * ratt_plats_id/ratt_lat/ratt_lon.
 */
export function usePaketFragor(paketId) {
  const [fragor, setFragor] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!paketId) {
      setFragor([]);
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function fetchFragor() {
      setLoading(true);
      const { data: lankar } = await supabase
        .from('kartan_paket_rundor')
        .select('runda_id, ordning')
        .eq('paket_id', paketId)
        .order('ordning');

      if (!lankar || lankar.length === 0) {
        if (!cancelled) {
          setFragor([]);
          setLoading(false);
        }
        return;
      }

      const rundaIds = lankar.map((l) => l.runda_id);
      const { data: rundor } = await supabase
        .from('kartan_rundor_public')
        .select('id, titel, typ')
        .in('id', rundaIds);

      const rundaMap = Object.fromEntries((rundor ?? []).map((r) => [r.id, r]));

      const result = lankar
        .map((l) => {
          const r = rundaMap[l.runda_id];
          if (!r) return null;
          return { rundaId: r.id, titel: r.titel, typ: r.typ, ordning: l.ordning };
        })
        .filter((x) => x !== null);

      if (!cancelled) {
        setFragor(result);
        setLoading(false);
      }
    }

    fetchFragor();
    return () => {
      cancelled = true;
    };
  }, [paketId]);

  return { fragor, loading };
}
