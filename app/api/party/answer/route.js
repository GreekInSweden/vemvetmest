import { verifyUser, createAdminClient } from '../../../../lib/party/auth';

export async function POST(request) {
  const check = await verifyUser(request);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: check.status });
  }

  const { partyId, svar } = await request.json();
  if (!partyId || svar === undefined) {
    return Response.json({ error: 'partyId och svar krävs.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: party } = await supabase.from('party').select('*').eq('id', partyId).single();
  if (!party || party.status !== 'aktiv') {
    return Response.json({ error: 'Ingen aktiv omgång just nu.' }, { status: 400 });
  }

  const { data: deltagare } = await supabase
    .from('party_deltagare')
    .select('id, poang_total')
    .eq('party_id', partyId)
    .eq('spelare_id', check.userId)
    .single();
  if (!deltagare) {
    return Response.json({ error: 'Du är inte med i det här partyt.' }, { status: 403 });
  }

  const { data: runda } = await supabase
    .from('party_rundor')
    .select('*')
    .eq('party_id', partyId)
    .eq('ordning', party.aktuell_runda_index)
    .single();

  const forflutenSekunder = (Date.now() - new Date(party.aktuell_runda_startad_at).getTime()) / 1000;
  const NATVERKS_MARGINAL = 2;
  if (forflutenSekunder > runda.tidsgrans_sekunder + NATVERKS_MARGINAL) {
    return Response.json({ error: 'Tiden är ute för den här frågan.' }, { status: 400 });
  }

  const ratt = svar.trim().toLowerCase() === runda.ratt_svar.trim().toLowerCase();
  const andelKvarTid = Math.max(0, 1 - forflutenSekunder / runda.tidsgrans_sekunder);
  const poang = ratt ? Math.round(200 + 300 * andelKvarTid) : 0;

  const { error: svarError } = await supabase.from('party_svar').insert({
    runda_id: runda.id,
    deltagare_id: deltagare.id,
    svar,
    ratt,
    poang,
  });

  if (svarError) {
    return Response.json({ error: 'Du har redan svarat på den här frågan.' }, { status: 400 });
  }

  await supabase
    .from('party_deltagare')
    .update({ poang_total: deltagare.poang_total + poang })
    .eq('id', deltagare.id);

  return Response.json({ ratt, poang });
}
