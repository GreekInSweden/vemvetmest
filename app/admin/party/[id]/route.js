import { verifyAdmin, createAdminClient } from '../../../../../lib/party/auth';

export async function DELETE(request, { params }) {
  const check = await verifyAdmin(request);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: check.status });
  }

  const { id } = await params;
  const supabase = createAdminClient();

  // party_rundor, party_deltagare, party_svar och party_lista_gissningar
  // har alla "on delete cascade" mot party — en radering här räcker.
  const { error } = await supabase.from('party').delete().eq('id', id);
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
