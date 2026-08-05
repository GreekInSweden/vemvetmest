'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [categories, setCategories] = useState([]);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/login');
        return;
      }

      const userId = sessionData.session.user.id;
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .single();
      setUsername(profile?.username || '');

      const { data: cats } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order');
      const { data: gameLists } = await supabase
        .from('game_lists')
        .select('id, slug, title, subtitle, category_id')
        .order('sort_order');

      setCategories(cats || []);
      setLists(gameLists || []);
      setLoading(false);
    }
    load();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) {
    return <div className="wrap"><p className="subhead">Laddar…</p></div>;
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="user">Inloggad som <b style={{ color: 'var(--amber-glow)' }}>{username}</b></div>
        <button className="btn btn-ghost" onClick={handleLogout}>Logga ut</button>
      </div>

      <header style={{ textAlign: 'center', marginBottom: 10 }}>
        <div className="eyebrow">Skriv &middot; Gissa &middot; Fyll listan</div>
        <h1 className="brand">Ranglistan</h1>
        <p className="subhead">Välj ett spel — fler kategorier och listor läggs till löpande.</p>
      </header>

      {categories.map(cat => {
        const catLists = lists.filter(l => l.category_id === cat.id);
        if (catLists.length === 0) return null;
        return (
          <div key={cat.id}>
            <div className="cat-title">{cat.name}</div>
            <div className="list-grid">
              {catLists.map(l => (
                <a key={l.id} className="plaque" href={`/play/${l.slug}`}>
                  <span className="tag">{cat.name}</span>
                  {l.title}
                </a>
              ))}
            </div>
          </div>
        );
      })}

      <footer className="site">Fler listor på gång — samma spel, nya frågor.</footer>
    </div>
  );
}
