import { createClient } from '@supabase/supabase-js';
 
export const dynamic = 'force-dynamic';
 
function stockholmNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Stockholm' }));
}
 
function ymd(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
 
export async function GET(request) {
  // Vercel Cron skickar automatiskt Authorization: Bearer <CRON_SECRET> om
  // miljövariabeln CRON_SECRET är satt. Vi tillåter även ?secret=... i URL:en
  // så du kan trigga den manuellt i webbläsaren för att testa.
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
 
  const now = stockholmNow();
  const isoWeekday = ((now.getDay() + 6) % 7) + 1; // 1=mån ... 7=sön
  const today = ymd(now);
 
  if (![1, 3, 5].includes(isoWeekday)) {
    return Response.json({ skipped: true, reason: 'not a challenge day', today, isoWeekday });
  }
 
  const { data: existing } = await supabase
    .from('daily_challenges')
    .select('id')
    .eq('challenge_date', today)
    .maybeSingle();
 
  if (existing) {
    return Response.json({ skipped: true, reason: 'already exists for today', today });
  }
 
  const { data: lists, error: listsError } = await supabase.from('game_lists').select('id');
  if (listsError || !lists || lists.length === 0) {
    return Response.json({ error: 'no game_lists found' }, { status: 500 });
  }
 
  const { data: usedRows } = await supabase.from('daily_challenges').select('list_id');
 
  const useCount = {};
  lists.forEach(l => { useCount[l.id] = 0; });
  (usedRows || []).forEach(r => {
    if (useCount[r.list_id] !== undefined) useCount[r.list_id] += 1;
  });
 
  const minCount = Math.min(...Object.values(useCount));
  const candidates = Object.keys(useCount)
    .filter(id => useCount[id] === minCount)
    .map(Number);
  const chosen = candidates[Math.floor(Math.random() * candidates.length)];
 
  const weekdayNames = { 1: 'måndag', 3: 'onsdag', 5: 'fredag' };
 
  const { error: insertError } = await supabase.from('daily_challenges').insert({
    challenge_date: today,
    weekday: weekdayNames[isoWeekday],
    list_id: chosen
  });
 
  if (insertError) {
    // Om en annan körning (t.ex. schemat + ett manuellt test samtidigt) hann
    // skapa dagens rad först, är det inget fel — bara att bekräfta det.
    if (insertError.code === '23505') {
      return Response.json({ skipped: true, reason: 'already exists (race)', today });
    }
    return Response.json({ error: insertError.message }, { status: 500 });
  }
 
  return Response.json({ created: true, today, weekday: weekdayNames[isoWeekday], list_id: chosen });
}
