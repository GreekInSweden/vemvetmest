-- ============================================================
-- RANGLISTAN — databasschema för Supabase (Postgres)
-- Kör hela filen i Supabase Dashboard -> SQL Editor -> New query
-- ============================================================

-- Profiler: en rad per konto, kopplad till auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz default now()
);

-- Kategorier (Sport, Geografi, Historia, Övrigt, ...)
create table if not exists public.categories (
  id serial primary key,
  slug text unique not null,
  name text not null,
  sort_order int default 0
);

-- Ett spel/lista, t.ex. "Allsvenska maratontabellen"
create table if not exists public.game_lists (
  id serial primary key,
  category_id int references public.categories(id) on delete set null,
  slug text unique not null,
  title text not null,
  subtitle text,
  source text,
  -- value_format styr hur JS formaterar värdet i UI:
  --   'plain'        -> talet + value_suffix (t.ex. " p", " km", " m", " km²")
  --   'millions_inv' -> talet delat med 1 000 000, en decimal, "milj. inv."
  --   'year'         -> "tillträdde <år>"
  value_format text not null default 'plain',
  value_suffix text default '',
  sort_order int default 0
);

-- Raderna i en lista: rang, namn, värde, alternativa stavningar
create table if not exists public.list_items (
  id serial primary key,
  list_id int references public.game_lists(id) on delete cascade,
  rank int not null,
  name text not null,
  value numeric not null,
  aliases text[] default '{}',
  unique(list_id, rank)
);

-- Resultat per spelomgång (för framtida statistik/topplistor)
create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  list_id int references public.game_lists(id) on delete cascade,
  guessed int not null,
  total int not null,
  misses int not null,
  seconds int not null,
  completed boolean not null default false,
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.game_lists enable row level security;
alter table public.list_items enable row level security;
alter table public.results enable row level security;

-- Kategorier/listor/rader: publikt läsbara (spelinnehåll, ingen hemlig data)
create policy "categories readable by all" on public.categories for select using (true);
create policy "game_lists readable by all" on public.game_lists for select using (true);
create policy "list_items readable by all" on public.list_items for select using (true);

-- Profiler: man ser och skapar bara sin egen rad
create policy "profiles select own" on public.profiles for select using (auth.uid() = id);
create policy "profiles insert own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles update own" on public.profiles for update using (auth.uid() = id);

-- Resultat: man skapar och läser bara sina egna rader
create policy "results select own" on public.results for select using (auth.uid() = user_id);
create policy "results insert own" on public.results for insert with check (auth.uid() = user_id);
