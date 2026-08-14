import { createAdminClient } from '../../../../../lib/kartan/admin';
import { verifyAdmin } from '../../../../../lib/kartan/verifyAdmin';

export async function POST(request) {
  const check = await verifyAdmin(request);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: check.status });
  }

  const { kategoriId, titel, typ, rattPlatsId, rattLat, rattLon, toleransKm, visadVarde } =
    await request.json();

  if (!kategoriId || !titel || !visadVarde || !typ || !['lan', 'kommun', 'punkt'].includes(typ)) {
    return Response.json(
      { error: 'kategoriId, titel, visadVarde och giltig typ krävs.' },
      { status: 400 }
    );
  }

  if ((typ === 'lan' || typ === 'kommun') && !rattPlatsId) {
    return Response.json(
      { error: 'rattPlatsId krävs för lan/kommun-rundor (klicka på kartan).' },
      { status: 400 }
    );
  }

  if (typ === 'punkt' && (rattLat == null || rattLon == null)) {
    return Response.json(
      { error: 'rattLat/rattLon krävs för nålgissnings-rundor (klicka på kartan).' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { error: deactivateError } = await supabase
    .from('kartan_rundor')
    .update({ is_aktiv: false })
    .eq('kategori_id', kategoriId)
    .eq('is_aktiv', true);

  if (deactivateError) {
    return Response.json({ error: deactivateError.message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('kartan_rundor')
    .insert({
      kategori_id: kategoriId,
      titel,
      typ,
      ratt_plats_id: typ === 'lan' || typ === 'kommun' ? rattPlatsId : null,
      ratt_lat: typ === 'punkt' ? rattLat : null,
      ratt_lon: typ === 'punkt' ? rattLon : null,
      tolerans_km: typ === 'punkt' ? toleransKm ?? 15 : null,
      visad_varde: visadVarde,
      is_aktiv: true,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ runda: data });
}
