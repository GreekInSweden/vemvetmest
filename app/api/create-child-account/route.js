import { createClient } from '@supabase/supabase-js';

// Använder EXAKT samma username->mejl-mönster som resten av appen
// (se lib/supabaseClient.js usernameToEmail) - ingen anledning att
// uppfinna ett separat system bara för barnkonton.
function usernameToEmail(username) {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  return `${clean}@users.ranglistan.local`;
}

// Skapar ett barnkonto helt server-side med service role-nyckeln, så
// förälderns egen inloggning i webbläsaren aldrig påverkas. Kontot
// skapas direkt (så användarnamnskollen är på riktigt), men får ingen
// tillgång till barnspelen förrän admin aktiverar betalningen separat.
export async function POST(request) {
  try {
    const { childUsername, childPassword } = await request.json();

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(childUsername)) {
      return Response.json({ error: 'Användarnamnet måste vara 3-20 tecken (bokstäver, siffror, _).' }, { status: 400 });
    }
    if (!childPassword || childPassword.length < 6) {
      return Response.json({ error: 'Lösenordet måste vara minst 6 tecken.' }, { status: 400 });
    }

    // Verifiera att anroparen faktiskt är inloggad (föräldern)
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return Response.json({ error: 'Inte inloggad.' }, { status: 401 });
    }

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data: { user: parentUser }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !parentUser) {
      return Response.json({ error: 'Inte inloggad.' }, { status: 401 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: available } = await supabaseAdmin.rpc('is_username_available', { p_username: childUsername });
    if (!available) {
      return Response.json({ error: 'Användarnamnet är upptaget.' }, { status: 409 });
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: usernameToEmail(childUsername),
      password: childPassword,
      email_confirm: true
    });
    if (createError) {
      return Response.json({ error: 'Kunde inte skapa kontot: ' + createError.message }, { status: 500 });
    }

    const childId = created.user.id;

    await supabaseAdmin.from('profiles').update({ username: childUsername, is_child: true }).eq('id', childId);

    const { data: pkg, error: pkgError } = await supabaseAdmin
      .from('child_packages')
      .insert({
        parent_id: parentUser.id,
        child_username_requested: childUsername,
        child_profile_id: childId,
        activated: false
      })
      .select('id')
      .single();

    if (pkgError) {
      return Response.json({ error: 'Kontot skapades, men barnpaketet kunde inte registreras: ' + pkgError.message }, { status: 500 });
    }

    return Response.json({ success: true, childId, packageId: pkg.id });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
