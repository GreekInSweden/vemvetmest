import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

// Vi använder användarnamn + lösenord, men Supabase Auth bygger på e-post
// under huven. Vi översätter därför användarnamnet till en teknisk,
// deterministisk "e-postadress" som aldrig behöver ta emot riktig post.
// Domänen users.ranglistan.local behöver inte existera.
export function usernameToEmail(username) {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  return `${clean}@users.ranglistan.local`;
}

export function isValidUsername(username) {
  const clean = username.trim();
  return /^[a-zA-Z0-9_]{3,20}$/.test(clean);
}
