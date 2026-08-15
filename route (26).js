import { createClient } from '@supabase/supabase-js';
import { checkGuess } from '../../../../lib/gameMatch';

// Kollar en gissning helt server-side. Klienten skickar bara texten
// och vilka ranks den redan har rätt på - den FULLA listan med facit
// hämtas bara här, med service role-nyckeln, och skickas ALDRIG till
// webbläsaren i sin helhet. Enda som returneras är själva träffen
// (om det blev rätt) - resten av listan förblir okänd för klienten.
export async function POST(request) {
  try {
    const { listId, guess, guessedRanks } = await request.json();

    if (!listId || typeof guess !== 'string' || !guess.trim()) {
      return Response.json({ error: 'Ogiltig förfrågan.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: listRow } = await supabaseAdmin
      .from('game_lists')
      .select('guess_mode')
      .eq('id', listId)
      .single();
    if (!listRow) {
      return Response.json({ error: 'Listan hittades inte.' }, { status: 404 });
    }

    const { data: items } = await supabaseAdmin
      .from('list_items')
      .select('rank, name, value, aliases')
      .eq('list_id', listId);

    const result = checkGuess(guess, items || [], Array.isArray(guessedRanks) ? guessedRanks : [], listRow.guess_mode || 'default');
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
