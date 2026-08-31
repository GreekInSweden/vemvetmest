import { verifyUser, createAdminClient } from '../../../../lib/party/auth';
import { checkGuess } from '../../../../lib/gameMatch';

const POANG_PER_RATT = 100;

export async function POST(request) {
  const check = await verifyUser(request);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: check.status });
  }

  const { partyId, guess } = await request.json();
  if (!partyId || typeof guess !== 'string' || !guess.trim()) {
    return Response.json({ error: 'partyId och guess krävs.' }, { status: 400 });
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

  if (runda.typ !== 'kanduallalista') {
    return Response.json({ error: 'Den här rundan är inte en listrunda.' }, { status: 400 });
  }

  const forflutenSekunder = (Date.now() - new Date(party.aktuell_runda_startad_at).getTime()) / 1000;
  const NATVERKS_MARGINAL = 2;
  if (forflutenSekunder > runda.tidsgrans_sekunder + NATVERKS_MARGINAL) {
    return Response.json({ error: 'Tiden är ute för den här rundan.' }, { status: 400 });
  }

  const { data: listRow } = await supabase.from('game_lists').select('guess_mode').eq('id', runda.list_id).single();
  const { data: items } = await supabase.from('list_items').select('rank, name, value, aliases').eq('list_id', runda.list_id);

  const { data: redanGissat } = await supabase
    .from('party_lista_gissningar')
    .select('item_rank')
    .eq('runda_id', runda.id)
    .eq('deltagare_id', deltagare.id);
  const guessedRanks = (redanGissat || []).map((r) => r.item_rank);

  const result = checkGuess(guess, items || [], guessedRanks, listRow?.guess_mode || 'default');

  if (result.correct && result.matches?.length > 0) {
    const nyaRader = result.matches.map((m) => ({
      runda_id: runda.id,
      deltagare_id: deltagare.id,
      item_rank: m.rank,
      item_namn: m.name,
    }));
    await supabase.from('party_lista_gissningar').insert(nyaRader);

    const poangOkning = nyaRader.length * POANG_PER_RATT;
    await supabase
      .from('party_deltagare')
      .update({ poang_total: deltagare.poang_total + poangOkning })
      .eq('id', deltagare.id);
  }

  return Response.json(result);
}
