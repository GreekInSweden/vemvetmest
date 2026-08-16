import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function stockholmNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Stockholm' }));
}

function ymd(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function GET(request) {
  // Samma autentisering som daily-challenge-cronen: Vercel Cron skickar
  // Authorization: Bearer <CRON_SECRET> automatiskt, eller ?secret=... i
  // URL:en för manuell testning i webbläsaren.
  const authHeader = request.headers.get('authorization');
  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret');
  const ok =
    authHeader === `Bearer ${process.env.CRON_SECRET}` ||
    (querySecret && querySecret === process.env.CRON_SECRET);

  if (!ok) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Samma globala lanseringsspärr som KanDuAlla:s egen dagsrotation —
  // återanvänder app_settings.daily_pool_launched, inte en egen flagga,
  // så en enda växel styr båda spelens lansering samtidigt.
  const { data: settings } = await supabase
    .from('app_settings')
    .select('daily_pool_launched')
    .eq('id', 1)
    .single();
  if (!settings?.daily_pool_launched) {
    return Response.json({ skipped: true, reason: 'daily pool not launched yet' });
  }

  const now = stockholmNow();
  const isoWeekday = ((now.getDay() + 6) % 7) + 1; // 1=mån ... 7=sön
  const today = ymd(now);

  // Kartans dagar: tisdag (2) och torsdag (4) — KanDuAlla har måndag/onsdag.
  if (![2, 4].includes(isoWeekday)) {
    return Response.json({ skipped: true, reason: 'not a kartan challenge day', today, isoWeekday });
  }

  const { data: existing } = await supabase
    .from('kartan_daily_challenges')
    .select('id')
    .eq('challenge_date', today)
    .maybeSingle();

  if (existing) {
    return Response.json({ skipped: true, reason: 'already exists for today', today });
  }

  const { data: paket, error: paketError } = await supabase
    .from('kartan_paket')
    .select('id')
    .eq('daglig_pool', true)
    .eq('status', 'publicerad');

  if (paketError || !paket || paket.length === 0) {
    return Response.json({ error: 'no kartan_paket in daglig_pool' }, { status: 500 });
  }

  const { data: usedRows } = await supabase.from('kartan_daily_challenges').select('paket_id');

  const useCount = {};
  paket.forEach((p) => {
    useCount[p.id] = 0;
  });
  (usedRows || []).forEach((r) => {
    if (useCount[r.paket_id] !== undefined) useCount[r.paket_id] += 1;
  });

  const minCount = Math.min(...Object.values(useCount));
  const candidates = Object.keys(useCount).filter((id) => useCount[id] === minCount);
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];

  const weekdayNames = { 2: 'tisdag', 4: 'torsdag' };

  const { error: insertError } = await supabase.from('kartan_daily_challenges').insert({
    challenge_date: today,
    weekday: weekdayNames[isoWeekday],
    paket_id: chosen,
  });

  if (insertError) {
    if (insertError.code === '23505') {
      return Response.json({ skipped: true, reason: 'already exists (race)', today });
    }
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  return Response.json({ created: true, today, weekday: weekdayNames[isoWeekday], paket_id: chosen });
}
