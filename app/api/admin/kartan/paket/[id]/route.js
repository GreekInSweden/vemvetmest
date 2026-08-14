import { createAdminClient } from '../../../../../../lib/kartan/admin';
import { verifyAdmin } from '../../../../../../lib/kartan/verifyAdmin';

export async function PATCH(request, { params }) {
  const check = await verifyAdmin(request);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;
  const { status } = await request.json();

  if (!['utkast', 'publicerad'].includes(status)) {
    return Response.json({ error: "status måste vara 'utkast' eller 'publicerad'." }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('kartan_paket')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ paket: data });
}
