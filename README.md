# Ranglistan

Ett flerspelsspel där man skriver namn och gissar hela ranglistor — lag, städer,
floder, presidenter osv. Byggt med Next.js + Supabase (inloggning + databas),
tänkt att köras på Vercel.

Just nu ingår 8 färdiga listor i fyra kategorier (Sport, Geografi, Historia,
Övrigt). Fler listor läggs till genom att bara skriva mer SQL i `supabase/seed.sql`
— ingen kodändring krävs.

---

## 1. Skapa Supabase-projektet

1. Gå till [supabase.com](https://supabase.com) och skapa ett konto/logga in.
2. Klicka **New project**. Välj namn, lösenord för databasen och region (t.ex.
   Frankfurt/Stockholm om det finns).
3. Vänta tills projektet är klart (tar ca 1–2 minuter).
4. Gå till **SQL Editor** i vänstermenyn → **New query**.
   - Klistra in hela innehållet i `supabase/schema.sql` → **Run**.
   - Ny query, klistra in hela `supabase/seed.sql` → **Run**.
5. Gå till **Authentication → Providers → Email** och slå **av**
   "Confirm email". Vi använder påhittade e-postadresser internt
   (baserat på användarnamn) som aldrig kan ta emot riktiga mejl, så
   bekräftelse måste vara avstängd annars kan ingen logga in direkt.
6. Gå till **Project Settings → API**. Notera:
   - **Project URL**
   - **anon public key**

   Dessa behövs i steg 3.

---

## 2. Lägg upp koden på GitHub

```bash
cd ranglistan-app
git init
git add .
git commit -m "Första versionen av Ranglistan"
```

Skapa ett nytt, tomt repo på [github.com/new](https://github.com/new) (utan
README/gitignore), följ sedan instruktionerna GitHub visar för att pusha ett
befintligt repo, t.ex.:

```bash
git remote add origin https://github.com/DITT-ANVANDARNAMN/ranglistan.git
git branch -M main
git push -u origin main
```

---

## 3. Deploya på Vercel

1. Gå till [vercel.com](https://vercel.com), logga in med GitHub.
2. **Add New… → Project** → välj `ranglistan`-repot.
3. Under **Environment Variables**, lägg till:
   - `NEXT_PUBLIC_SUPABASE_URL` = din Project URL från Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = din anon public key från Supabase
4. Klicka **Deploy**. Efter ~1 minut får du en live-URL, t.ex.
   `ranglistan.vercel.app`.

Klart! Skapa ett konto på sidan (användarnamn + lösenord) och spela.

---

## Köra lokalt (valfritt, för utveckling)

```bash
npm install
cp .env.local.example .env.local   # fyll i dina Supabase-värden
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000).

---

## Lägga till fler listor

Öppna `supabase/seed.sql` och kopiera ett av blocken (t.ex. listan om
planeterna, som är kortast). Byt ut:

- `slug` — unik URL-del, t.ex. `sveriges-landskap`
- `title`, `subtitle`, `source`
- `value_format` — `'plain'` (tal + `value_suffix`), `'millions_inv'`
  (delar på en miljon, för folkmängd) eller `'year'` (visar "tillträdde XXXX")
- listan med `(rang, namn, värde, alias-array)`

Kör sedan bara det nya blocket i Supabase SQL Editor — ingen ny kod eller
deploy behövs, listan dyker upp på startsidan automatiskt (så länge
`category_id` pekar på en befintlig kategori).

## Kända begränsningar / nästa steg

- Autentiseringen körs client-side (ingen SSR-skyddad routing). Fungerar bra
  för ett litet spel, men är inte hårdvaru-säkert mot en påstridig angripare.
- `results`-tabellen sparar varje spelomgång men det finns ännu ingen
  topplista i gränssnittet — bra nästa steg om ni vill ha tävlingsmoment.
- Fler listor (t.ex. NHL, Nobelpristagare, Sveriges landskap, huvudstäder i
  Europa) kan läggas till i omgångar — hör av dig när du vill ha nästa batch.
