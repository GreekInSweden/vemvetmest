import { createAdminClient } from '../../../../../../lib/kartan/admin';
import { verifyAdmin } from '../../../../../../lib/kartan/verifyAdmin';

export async function PATCH(request, { params }) {
  const check = await verifyAdmin(request);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;
  const { status, kraverMedlemskap, dagligPool } = await request.json();

  const updates = {};
  if (status !== undefined) {
    if (!['utkast', 'publicerad'].includes(status)) {
      return Response.json({ error: "status måste vara 'utkast' eller 'publicerad'." }, { status: 400 });
    }
    updates.status = status;
  }
  if (kraverMedlemskap !== undefined) {
    updates.kraver_medlemskap = !!kraverMedlemskap;
  }
  if (dagligPool !== undefined) {
    updates.daglig_pool = !!dagligPool;
  }
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'Inget att uppdatera.' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('kartan_paket')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ paket: data });
}
