import { verifyUser, createAdminClient } from '../../../../lib/party/auth';

export async function POST(request) {
  const check = await verifyUser(request);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: check.status });
  }

  const { kod, smeknamn } = await request.json();
  if (!kod || !smeknamn) {
    return Response.json({ error: 'kod och smeknamn krävs.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: party, error: partyError } = await supabase
    .from('party')
    .select('id, namn, status')
    .eq('kod', kod.toUpperCase())
    .maybeSingle();

  if (partyError || !party) {
    return Response.json({ error: 'Hittade inget party med den koden.' }, { status: 404 });
  }
  if (party.status === 'avslutad') {
    return Response.json({ error: 'Det partyt är redan avslutat.' }, { status: 400 });
  }

  const { data: deltagare, error: deltagareError } = await supabase
    .from('party_deltagare')
    .upsert(
      { party_id: party.id, spelare_id: check.userId, smeknamn },
      { onConflict: 'party_id,spelare_id' }
    )
    .select()
    .single();

  if (deltagareError) {
    return Response.json({ error: deltagareError.message }, { status: 500 });
  }

  return Response.json({ partyId: party.id, partyNamn: party.namn, deltagareId: deltagare.id });
}
