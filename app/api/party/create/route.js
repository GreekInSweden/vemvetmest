import { verifyUser, createAdminClient, genereraPartykod } from '../../../../lib/party/auth';

export async function POST(request) {
  const check = await verifyUser(request);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: check.status });
  }

  const { namn, rundor, ledareSmeknamn } = await request.json();
  if (!namn || !Array.isArray(rundor) || rundor.length === 0) {
    return Response.json({ error: 'namn och minst en runda krävs.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Ledaren måste vara betalande medlem (eller admin) för att skapa
  // ett party. Deltagare som senare går med behöver bara vara
  // inloggade — inget betalkrav på dem, bara på den som startar.
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, paid_until')
    .eq('id', check.userId)
    .single();

  const idag = new Date().toISOString().slice(0, 10);
  const arBetalande = !!profile?.is_admin || (!!profile?.paid_until && profile.paid_until >= idag);
  if (!arBetalande) {
    return Response.json({ error: 'Du behöver ett betalt medlemskap för att skapa ett party.' }, { status: 403 });
  }

  let kod;
  for (let försök = 0; försök < 5; försök++) {
    kod = genereraPartykod();
    const { data: krock } = await supabase.from('party').select('id').eq('kod', kod).maybeSingle();
    if (!krock) break;
  }

  const { data: party, error: partyError } = await supabase
    .from('party')
    .insert({ ledare_id: check.userId, namn, kod })
    .select()
    .single();

  if (partyError) {
    return Response.json({ error: partyError.message }, { status: 500 });
  }

  const rundorRows = rundor.map((r, i) => ({
    party_id: party.id,
    ordning: i,
    typ: r.typ || 'text',
    fraga: r.typ === 'kanduallalista' ? null : r.fraga,
    ratt_svar: r.typ === 'kanduallalista' ? null : r.rattSvar,
    list_id: r.typ === 'kanduallalista' ? r.listId : null,
    tidsgrans_sekunder: r.tidsgransSekunder || (r.typ === 'kanduallalista' ? 240 : 20),
  }));

  const { error: rundorError } = await supabase.from('party_rundor').insert(rundorRows);
  if (rundorError) {
    return Response.json({ error: rundorError.message }, { status: 500 });
  }

  // Ledaren läggs till som en riktig deltagare också — hen ska kunna
  // gissa precis som alla andra, inte bara administrera.
  const { error: ledareDeltagareError } = await supabase.from('party_deltagare').insert({
    party_id: party.id,
    spelare_id: check.userId,
    smeknamn: ledareSmeknamn || 'Ledaren',
  });
  if (ledareDeltagareError) {
    return Response.json({ error: ledareDeltagareError.message }, { status: 500 });
  }

  return Response.json({ partyId: party.id, kod: party.kod });
}
