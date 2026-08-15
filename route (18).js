import { createAdminClient } from '../../../../../lib/kartan/admin';
import { verifyAdmin } from '../../../../../lib/kartan/verifyAdmin';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function POST(request) {
  const check = await verifyAdmin(request);
  if (!check.ok) {
    return Response.json({ error: check.error }, { status: check.status });
  }

  const { namn, antalKommun = 5, antalPunkt = 5, kategoriIds, kraverMedlemskap = true } = await request.json();

  const supabase = createAdminClient();

  const { data: redanAnvanda, error: usedError } = await supabase
    .from('kartan_paket_rundor')
    .select('runda_id');
  if (usedError) return Response.json({ error: usedError.message }, { status: 500 });
  const uteslut = (redanAnvanda ?? []).map((r) => r.runda_id);

  const temaFilter = Array.isArray(kategoriIds) && kategoriIds.length > 0 ? kategoriIds : null;

  async function plockaSlumpade(typ, antal) {
    if (antal <= 0) return [];
    let query = supabase.from('kartan_rundor').select('id').eq('typ', typ).eq('is_aktiv', true);
    if (temaFilter) query = query.in('kategori_id', temaFilter);
    if (uteslut.length > 0) {
      query = query.not('id', 'in', `(${uteslut.join(',')})`);
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return shuffle(data ?? []).slice(0, antal);
  }

  let kommunRundor, punktRundor;
  try {
    kommunRundor = await plockaSlumpade('kommun', antalKommun);
    punktRundor = await plockaSlumpade('punkt', antalPunkt);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }

  if (kommunRundor.length < antalKommun || punktRundor.length < antalPunkt) {
    return Response.json(
      {
        error: `Inte tillräckligt med oanvända rundor kvar (hittade ${kommunRundor.length} kommun, ${punktRundor.length} punkt — behöver ${antalKommun} respektive ${antalPunkt}).`,
      },
      { status: 400 }
    );
  }

  // Temapaket (kategoriIds satt) med nålgissnings-rundor: räkna ut en
  // ungefärlig ramruta kring de faktiska koordinaterna, så spelaren
  // ser rätt del av kartan direkt istället för hela Sverige. Slumpade
  // blandpaket får INGEN ramruta — de ska visa hela landet med flit.
  let vyBounds = null;
  if (temaFilter && punktRundor.length > 0) {
    const { data: punktMedKoordinater } = await supabase
      .from('kartan_rundor')
      .select('ratt_lat, ratt_lon')
      .in('id', punktRundor.map((r) => r.id));

    const lats = (punktMedKoordinater ?? []).map((r) => r.ratt_lat).filter((v) => v != null);
    const lons = (punktMedKoordinater ?? []).map((r) => r.ratt_lon).filter((v) => v != null);

    if (lats.length > 0) {
      // Liten marginal runt ytterpunkterna så nålarna inte hamnar
      // exakt i kanten av vyn.
      const latPad = Math.max((Math.max(...lats) - Math.min(...lats)) * 0.15, 0.05);
      const lonPad = Math.max((Math.max(...lons) - Math.min(...lons)) * 0.15, 0.05);
      vyBounds = {
        vy_lat_min: Math.min(...lats) - latPad,
        vy_lat_max: Math.max(...lats) + latPad,
        vy_lon_min: Math.min(...lons) - lonPad,
        vy_lon_max: Math.max(...lons) + lonPad,
      };
    }
  }

  const { data: nyttPaket, error: paketError } = await supabase
    .from('kartan_paket')
    .insert({
      namn: namn || `Paket ${new Date().toISOString().slice(0, 10)}`,
      status: 'utkast',
      kraver_medlemskap: kraverMedlemskap,
      ...(vyBounds || {}),
    })
    .select()
    .single();

  if (paketError) return Response.json({ error: paketError.message }, { status: 500 });

  const blandat = shuffle([...kommunRundor, ...punktRundor]);
  const rows = blandat.map((r, i) => ({
    paket_id: nyttPaket.id,
    runda_id: r.id,
    ordning: i + 1,
  }));

  const { error: insertError } = await supabase.from('kartan_paket_rundor').insert(rows);
  if (insertError) return Response.json({ error: insertError.message }, { status: 500 });

  return Response.json({ paket: nyttPaket });
}
