import { verifyUser, createAdminClient } from '../../../../lib/kompass/auth';
import { berakningPlattkarteVinkel, berakningPoang } from '../../../../lib/kompass/bearing';

/** Bredden (grader) för ett givet steg i kedjan — smalnar linjärt av
 * från start_bredd (steg 1) till slut_bredd (sista steget). */
function raknaBredd(stegNummer, antalLander, regler) {
  const startBredd = regler.start_bredd ?? 90;
  const slutBredd = regler.slut_bredd ?? 25;
  if (antalLander <= 1) return startBredd;
  const andel = (stegNummer - 1) / (antalLander - 1);
  return startBredd - (startBredd - slutBredd) * Math.min(1, andel);
}

export async function POST(request) {
  const check = await verifyUser(request);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: check.status });
  }

  const { partiId, valdVinkel } = await request.json();
  if (!partiId || valdVinkel === undefined) {
    return Response.json({ error: 'partiId och valdVinkel krävs.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: parti, error: partiError } = await supabase
    .from('kompass_partier')
    .select('*')
    .eq('id', partiId)
    .eq('spelare_id', check.userId)
    .single();

  if (partiError || !parti) {
    return Response.json({ error: 'Partiet hittades inte.' }, { status: 404 });
  }
  if (parti.avslutad_at) {
    return Response.json({ error: 'Det här partiet är redan avslutat.' }, { status: 400 });
  }

  const { data: lage } = await supabase.from('kompass_lagen').select('*').eq('id', parti.lage_id).single();
  const antalLander = lage.regler.antal_lander ?? 10;
  const stegNummer = parti.antal_gissningar + 1;

  const [{ data: franLand }, { data: tillLand }] = await Promise.all([
    supabase.from('kompass_lander').select('*').eq('iso2', parti.aktuell_iso2).single(),
    supabase.from('kompass_lander').select('*').eq('iso2', parti.kommande_mal_iso2).single(),
  ]);

  const anvandKoordinat = lage.kategori === 'huvudstader'
    ? { franLat: franLand.huvudstad_lat, franLon: franLand.huvudstad_lon, tillLat: tillLand.huvudstad_lat, tillLon: tillLand.huvudstad_lon }
    : { franLat: franLand.land_lat, franLon: franLand.land_lon, tillLat: tillLand.land_lat, tillLon: tillLand.land_lon };

  const rattVinkel = berakningPlattkarteVinkel(
    anvandKoordinat.franLat, anvandKoordinat.franLon, anvandKoordinat.tillLat, anvandKoordinat.tillLon
  );
  const bredd = raknaBredd(stegNummer, antalLander, lage.regler);
  const { traff, poang, avvikelse } = berakningPoang(valdVinkel, bredd, rattVinkel, 500);

  await supabase.from('kompass_gissningar').insert({
    parti_id: partiId,
    steg_nummer: stegNummer,
    fran_iso2: parti.aktuell_iso2,
    till_iso2: parti.kommande_mal_iso2,
    vald_vinkel_grader: valdVinkel,
    vald_bredd_grader: bredd,
    ratt_vinkel_grader: rattVinkel,
    traff,
    poang,
  });

  const nyTotalPoang = parti.total_poang + poang;
  const nyaTraffar = parti.antal_traffar + (traff ? 1 : 0);
  const nyaGissningar = stegNummer;

  // Avsluta partiet om: sista landet i kedjan nått, ELLER överlevnadsläge
  // med en missad gissning.
  const kedjanKlar = nyaGissningar >= antalLander;
  const overlevnadMissad = lage.typ === 'overlevnad' && !traff;
  const partietSlut = kedjanKlar || overlevnadMissad;

  let klaradeUtmaningen = null;
  if (partietSlut) {
    if (lage.typ === 'poang') {
      klaradeUtmaningen = nyTotalPoang >= (lage.regler.min_poang ?? 0);
    } else if (lage.typ === 'hitta_x_av_y') {
      klaradeUtmaningen = nyaTraffar >= (lage.regler.min_traffar ?? 0);
    } else if (lage.typ === 'overlevnad') {
      klaradeUtmaningen = !overlevnadMissad;
    } else {
      klaradeUtmaningen = true; // 'tid' — tidsgränsen hanteras klient-sidan än så länge
    }
  }

  const uppdatering = {
    total_poang: nyTotalPoang,
    antal_traffar: nyaTraffar,
    antal_gissningar: nyaGissningar,
  };

  let nastaMal = null;
  if (!partietSlut) {
    const { data: alla } = await supabase.from('kompass_lander').select('iso2, namn, huvudstad_namn');
    const { data: tidigareGissningar } = await supabase
      .from('kompass_gissningar')
      .select('till_iso2')
      .eq('parti_id', partiId);
    const anvanda = new Set([parti.start_iso2, ...tidigareGissningar.map((g) => g.till_iso2)]);
    const kandidater = alla.filter((l) => !anvanda.has(l.iso2));
    nastaMal = kandidater[Math.floor(Math.random() * kandidater.length)];

    uppdatering.aktuell_iso2 = parti.kommande_mal_iso2;
    uppdatering.kommande_mal_iso2 = nastaMal.iso2;
  } else {
    uppdatering.avslutad_at = new Date().toISOString();
    uppdatering.klarade_utmaningen = klaradeUtmaningen;
  }

  await supabase.from('kompass_partier').update(uppdatering).eq('id', partiId);

  return Response.json({
    traff,
    poang,
    rattVinkel,
    avvikelse,
    beredd: bredd,
    facit: { franNamn: franLand.namn, tillNamn: tillLand.namn },
    totalPoang: nyTotalPoang,
    antalTraffar: nyaTraffar,
    stegNummer,
    partietSlut,
    klaradeUtmaningen,
    nastaMal: nastaMal
      ? { iso2: nastaMal.iso2, namn: nastaMal.namn, huvudstadNamn: nastaMal.huvudstad_namn }
      : null,
    nastaBredd: !partietSlut ? raknaBredd(stegNummer + 1, antalLander, lage.regler) : null,
  });
}
