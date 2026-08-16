import { createAdminClient } from '../../../../../lib/kartan/admin';
import { verifyAdmin } from '../../../../../lib/kartan/verifyAdmin';

export async function GET(request) {
  const check = await verifyAdmin(request);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: check.status });
  }

  const supabase = createAdminClient();

  const { data: kategorier, error: katError } = await supabase
    .from('kartan_kategorier')
    .select('id, namn, beskrivning, typ')
    .order('namn');
  if (katError) return Response.json({ error: katError.message }, { status: 500 });

  const { data: rundor, error: rundorError } = await supabase
    .from('kartan_rundor')
    .select('id, kategori_id, titel, typ, is_aktiv, visad_varde, ratt_plats_id, ratt_lat, ratt_lon')
    .order('skapad_at', { ascending: false });
  if (rundorError) return Response.json({ error: rundorError.message }, { status: 500 });

  const { data: paket, error: paketError } = await supabase
    .from('kartan_paket')
    .select('id, namn, status, skapad_at, kraver_medlemskap, daglig_pool')
    .order('skapad_at', { ascending: false });
  if (paketError) return Response.json({ error: paketError.message }, { status: 500 });

  const { data: paketRundor, error: prError } = await supabase
    .from('kartan_paket_rundor')
    .select('paket_id, runda_id, ordning')
    .order('ordning');
  if (prError) return Response.json({ error: prError.message }, { status: 500 });

  return Response.json({ kategorier, rundor, paket, paketRundor });
}
