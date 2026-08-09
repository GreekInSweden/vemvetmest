import { createClient } from '@supabase/supabase-js';

// Ger bara första bokstaven av nästa olästa svar, aldrig hela namnet
// eller resten av listan.
export async function POST(request) {
  try {
    const { listId, guessedRanks } = await request.json();
    if (!listId) {
      return Response.json({ error: 'Ogiltig förfrågan.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: items } = await supabaseAdmin
      .from('list_items')
      .select('rank, name')
      .eq('list_id', listId);

    const guessedSet = new Set(Array.isArray(guessedRanks) ? guessedRanks : []);
    const remaining = (items || []).filter(item => !guessedSet.has(item.rank));
    if (remaining.length === 0) {
      return Response.json({ done: true });
    }
    const target = remaining.reduce((a, b) => (a.rank < b.rank ? a : b));

    return Response.json({ rank: target.rank, firstLetter: target.name[0].toUpperCase() });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
