'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Skickar en gissning till submit_kartan_guess-RPC:en (SECURITY DEFINER).
 * All poängsättning och facit-avslöjande sker server-side. RPC:en
 * enforcerar också en gissning per spelare/rond/dag.
 */
export function useSubmitKartanGuess(spelareId) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function submitGuess(guess, paketId) {
    setSubmitting(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('submit_kartan_guess', {
      p_runda_id: guess.rundaId,
      p_spelare_id: spelareId,
      p_plats_id: guess.typ === 'lan' || guess.typ === 'kommun' ? guess.platsId : null,
      p_guess_lat: guess.typ === 'punkt' ? guess.lat : null,
      p_guess_lon: guess.typ === 'punkt' ? guess.lon : null,
      p_paket_id: paketId ?? null,
    });

    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      setError('Inget svar från servern.');
      return null;
    }

    return {
      korrekt: row.korrekt,
      avstandKm: row.avstand_km,
      poang: row.poang,
      rattPlatsId: row.ratt_plats_id ?? undefined,
      rattLat: row.ratt_lat ?? undefined,
      rattLon: row.ratt_lon ?? undefined,
      visadVarde: row.visad_varde,
    };
  }

  return { submitGuess, submitting, error };
}
