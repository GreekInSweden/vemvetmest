import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * ADMIN-klient — samma mönster som redan används i app/api/game/guess/route.js:
 * service role-nyckeln kringgår RLS medvetet, för att kunna skriva/läsa data
 * (t.ex. facit) som klienten aldrig ska se direkt.
 *
 * Importeras ENDAST i API-routes (app/api/**), aldrig i en 'use client'-fil.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
