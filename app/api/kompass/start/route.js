import { verifyUser, createAdminClient } from '../../../../lib/kompass/auth';

export async function POST(request) {
  const check = await verifyUser(request);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: check.status });
  }

  const { lageId } = await request.json();
  if (!lageId) {
    return Response.json({ error: 'lageId krävs.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: lage, error: lageError } = await supabase
    .from('kompass_lagen')
    .select('*')
    .eq('id', lageId)
    .eq('aktiv', true)
    .single();

  if (lageError || !lage) {
    return Response.json({ error: 'Läget hittades inte eller är inte aktivt.' }, { status: 404 });
  }

  let query = supabase.from('kompass_lander').select('iso2, namn, huvudstad_namn');
  if (lage.region_filter) query = query.eq('region', lage.region_filter);
  const { data: kandidater, error: landerError } = await query;

  if (landerError || !kandidater || kandidater.length === 0) {
    return Response.json({ error: 'Inga länder matchar det här lägets filter.' }, { status: 500 });
  }

  const startLand = kandidater[Math.floor(Math.random() * kandidater.length)];
  const malKandidater = kandidater.filter((k) => k.iso2 !== startLand.iso2);
  const forstaMal = malKandidater[Math.floor(Math.random() * malKandidater.length)];

  const { data: parti, error: partiError } = await supabase
    .from('kompass_partier')
    .insert({
      spelare_id: check.userId,
      lage_id: lageId,
      start_iso2: startLand.iso2,
      aktuell_iso2: startLand.iso2,
      kommande_mal_iso2: forstaMal.iso2,
    })
    .select()
    .single();

  if (partiError) {
    return Response.json({ error: partiError.message }, { status: 500 });
  }

  return Response.json({
    partiId: parti.id,
    lage: { namn: lage.namn, typ: lage.typ, regler: lage.regler, kategori: lage.kategori },
    aktuelltLand: {
      iso2: startLand.iso2,
      namn: startLand.namn,
      huvudstadNamn: startLand.huvudstad_namn,
    },
    malLand: {
      iso2: forstaMal.iso2,
      namn: forstaMal.namn,
      huvudstadNamn: forstaMal.huvudstad_namn,
    },
  });
}
