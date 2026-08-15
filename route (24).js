import { createClient } from '@supabase/supabase-js';

// Visar hela facit. Tänkt att bara anropas när spelet redan är slut
// (tid ute, gett upp, eller klarat allt). OBS: den här rutten litar
// på klienten att bara anropa den då - den har inget eget sätt att
// bevisa att spelet faktiskt är slut. Det stänger de enkla vägarna
// att fuska (nätverksfliken, eller att fråga databasen direkt) men
// skyddar inte mot någon som medvetet skriver ett skript som anropar
// den direkt. Går att härda ytterligare med spelsessioner/token om
// det behövs senare.
export async function POST(request) {
  try {
    const { listId } = await request.json();
    if (!listId) {
      return Response.json({ error: 'Ogiltig förfrågan.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: items } = await supabaseAdmin
      .from('list_items')
      .select('rank, name, value')
      .eq('list_id', listId)
      .order('rank');

    return Response.json({ items: items || [] });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
