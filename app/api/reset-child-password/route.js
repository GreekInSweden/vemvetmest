import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  try {
    const { childProfileId, newPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return Response.json({ error: 'Lösenordet måste vara minst 6 tecken.' }, { status: 400 });
    }

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

    // Kontrollera att den som frågar verkligen är förälder till det här
    // barnkontot - annars skulle vem som helst kunna byta lösenord på
    // andras barn.
    const { data: pkg } = await supabaseAdmin
      .from('child_packages')
      .select('id')
      .eq('parent_id', parentUser.id)
      .eq('child_profile_id', childProfileId)
      .maybeSingle();

    if (!pkg) {
      return Response.json({ error: 'Du är inte registrerad som förälder till det här kontot.' }, { status: 403 });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(childProfileId, {
      password: newPassword
    });
    if (updateError) {
      return Response.json({ error: 'Kunde inte byta lösenord: ' + updateError.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
