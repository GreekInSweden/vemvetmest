import { createAdminClient } from '../../../../../lib/kartan/admin';
import { verifyAdmin } from '../../../../../lib/kartan/verifyAdmin';

export async function POST(request) {
  const check = await verifyAdmin(request);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: check.status });
  }

  const { namn, beskrivning, typ } = await request.json();

  if (!namn || !typ || !['lan', 'kommun', 'punkt'].includes(typ)) {
    return Response.json({ error: 'namn och giltig typ krävs.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('kartan_kategorier')
    .insert({ namn, beskrivning: beskrivning || null, typ })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ kategori: data });
}
