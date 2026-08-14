import { createClient } from '@supabase/supabase-js';

/**
 * Verifierar att anroparen är inloggad OCH är admin (is_admin=true i
 * profiles). Samma mönster som redan används i
 * app/api/create-child-account/route.js — token skickas som
 * Authorization: Bearer <access_token> från klienten.
 *
 * Returnerar { ok: true, userId } vid godkänt, annars { ok: false,
 * status, error } att skicka tillbaka direkt som svar.
 */
export async function verifyAdmin(request) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) {
    return { ok: false, status: 401, error: 'Inte inloggad.' };
  }

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, error: 'Inte inloggad.' };
  }

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) {
    return { ok: false, status: 403, error: 'Kräver admin-behörighet.' };
  }

  return { ok: true, userId: user.id };
}
