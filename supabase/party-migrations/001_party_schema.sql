-- ============================================================
-- Party-läge — realtidsbaserat, ledarstyrt gruppspel
-- Skiljer sig arkitektoniskt från allt annat i plattformen: här
-- måste ALLA deltagares skärmar uppdateras samtidigt när ledaren
-- agerar. Bygger på Supabase Realtime (postgres_changes) — klienter
-- prenumererar på ändringar i party/party_rundor istället för att
-- bara fråga en gång och vänta på svar.
--
-- OBS: den här första versionen använder EGNA, enkla testfrågor
-- (party_rundor.fraga/ratt_svar direkt på raden) — inte riktigt
-- innehåll från Kartan/KanDuAlla/Kompass än. Syftet är att bevisa
-- att själva realtids-synkroniseringen fungerar innan vi bygger
-- den betydligt större "blanda innehåll från alla spel"-biten.
-- ============================================================

create table if not exists party (
  id uuid primary key default gen_random_uuid(),
  ledare_id uuid not null,
  namn text not null,
  kod text not null unique,
  status text not null default 'lobby' check (status in ('lobby', 'aktiv', 'avslutad')),
  aktuell_runda_index integer not null default 0,
  aktuell_runda_startad_at timestamptz,
  skapad_at timestamptz not null default now()
);

create table if not exists party_deltagare (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references party(id) on delete cascade,
  spelare_id uuid not null,
  smeknamn text not null,
  poang_total integer not null default 0,
  ansluten_at timestamptz not null default now(),
  unique (party_id, spelare_id)
);

create table if not exists party_rundor (
  id uuid primary key default gen_random_uuid(),
  party_id uuid not null references party(id) on delete cascade,
  ordning integer not null,
  fraga text not null,
  ratt_svar text not null,
  tidsgrans_sekunder integer not null default 20,
  unique (party_id, ordning)
);

create table if not exists party_svar (
  id uuid primary key default gen_random_uuid(),
  runda_id uuid not null references party_rundor(id) on delete cascade,
  deltagare_id uuid not null references party_deltagare(id) on delete cascade,
  svar text,
  ratt boolean not null default false,
  poang integer not null default 0,
  svarade_at timestamptz not null default now(),
  unique (runda_id, deltagare_id)
);

alter table party enable row level security;
alter table party_deltagare enable row level security;
alter table party_rundor enable row level security;
alter table party_svar enable row level security;

create policy "Läs party" on party for select using (true);
create policy "Läs deltagare" on party_deltagare for select using (true);
create policy "Läs svar" on party_svar for select using (true);

-- OBS: INGEN publik select-policy på party_rundor självt — den
-- innehåller ratt_svar. Samma säkerhetsmönster som Kartans
-- kartan_rundor_public: klienten läser bara frågan + tidsgränsen via
-- vyn nedan, aldrig facit direkt.
create or replace view party_rundor_public as
select id, party_id, ordning, fraga, tidsgrans_sekunder
from party_rundor;

grant select on party_rundor_public to anon, authenticated;

-- Aktiverar realtidsuppdateringar — utan detta får klienterna aldrig
-- reda på att ledaren startat en ny omgång eller att poängen ändrats.
alter publication supabase_realtime add table party;
alter publication supabase_realtime add table party_deltagare;
alter publication supabase_realtime add table party_svar;
