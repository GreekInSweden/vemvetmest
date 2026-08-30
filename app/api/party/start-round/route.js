import { verifyUser, createAdminClient } from '../../../../lib/party/auth';

export async function POST(request) {
  const check = await verifyUser(request);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: check.status });
  }

  const { partyId } = await request.json();
  if (!partyId) {
    return Response.json({ error: 'partyId krävs.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: party, error: partyError } = await supabase.from('party').select('*').eq('id', partyId).single();
  if (partyError || !party) {
    return Response.json({ error: 'Partyt hittades inte.' }, { status: 404 });
  }
  if (party.ledare_id !== check.userId) {
    return Response.json({ error: 'Bara ledaren kan starta en omgång.' }, { status: 403 });
  }

  const { data: alla_rundor } = await supabase
    .from('party_rundor')
    .select('id, ordning')
    .eq('party_id', partyId)
    .order('ordning');

  const nastaIndex = party.status === 'lobby' ? 0 : party.aktuell_runda_index + 1;

  if (nastaIndex >= alla_rundor.length) {
    await supabase.from('party').update({ status: 'avslutad' }).eq('id', partyId);
    return Response.json({ avslutat: true });
  }

  if (party.status === 'aktiv') {
    const foregaendeRunda = alla_rundor[party.aktuell_runda_index];
    const { data: deltagare } = await supabase.from('party_deltagare').select('id').eq('party_id', partyId);
    const { data: redanSvarat } = await supabase
      .from('party_svar')
      .select('deltagare_id')
      .eq('runda_id', foregaendeRunda.id);
    const svaratSet = new Set((redanSvarat || []).map((s) => s.deltagare_id));
    const saknas = (deltagare || []).filter((d) => !svaratSet.has(d.id));

    if (saknas.length > 0) {
      await supabase.from('party_svar').insert(
        saknas.map((d) => ({ runda_id: foregaendeRunda.id, deltagare_id: d.id, svar: null, ratt: false, poang: 0 }))
      );
    }
  }

  const nyRunda = alla_rundor[nastaIndex];
  await supabase
    .from('party')
    .update({ status: 'aktiv', aktuell_runda_index: nastaIndex, aktuell_runda_startad_at: new Date().toISOString() })
    .eq('id', partyId);

  return Response.json({ rundaId: nyRunda.id, rundaIndex: nastaIndex });
}
