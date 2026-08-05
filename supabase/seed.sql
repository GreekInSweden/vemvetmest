-- ============================================================
-- RANGLISTAN — seed-data
-- Kör EFTER schema.sql, i samma SQL Editor i Supabase
-- ============================================================

insert into public.categories (slug, name, sort_order) values
  ('sport', 'Sport', 1),
  ('geografi', 'Geografi', 2),
  ('historia', 'Historia', 3),
  ('ovrigt', 'Övrigt', 4)
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- 1. Allsvenska maratontabellen
-- ------------------------------------------------------------
insert into public.game_lists (category_id, slug, title, subtitle, source, value_format, value_suffix, sort_order)
values (
  (select id from public.categories where slug = 'sport'),
  'allsvenskan-maratontabellen',
  'Allsvenska maratontabellen',
  'Alla 67 klubbar som spelat i Allsvenskan sedan 1924/25',
  'Källa: Svenska Fotbollförbundet, maratontabell t.o.m. säsongen 2025',
  'plain', ' p', 1
) on conflict (slug) do nothing;

insert into public.list_items (list_id, rank, name, value, aliases)
select l.id, t.rank, t.name, t.value, t.aliases from (values
(1,'Malmö FF',3920,array['MFF','Malmö']),
(2,'IFK Göteborg',3714,array['Göteborg','Blåvitt','IFK Gbg']),
(3,'AIK',3705,array[]::text[]),
(4,'IFK Norrköping',3193,array['Norrköping','IFK Nkpg']),
(5,'IF Elfsborg',3007,array['Elfsborg']),
(6,'Djurgårdens IF',2669,array['Djurgården','DIF']),
(7,'Helsingborgs IF',2542,array['Helsingborg','HIF']),
(8,'Hammarby IF',1937,array['Hammarby','Bajen']),
(9,'Halmstads BK',1883,array['Halmstad','HBK']),
(10,'GAIS',1786,array[]::text[]),
(11,'Örgryte IS',1782,array['Örgryte','ÖIS']),
(12,'Örebro SK',1750,array['Örebro','ÖSK']),
(13,'Kalmar FF',1330,array['Kalmar']),
(14,'Östers IF',1142,array['Öster','Östers']),
(15,'BK Häcken',998,array['Häcken']),
(16,'Degerfors IF',979,array['Degerfors']),
(17,'Landskrona BoIS',977,array['Landskrona','BoIS']),
(18,'Åtvidabergs FF',649,array['Åtvidaberg','ÅFF']),
(19,'Sandvikens IF',576,array['Sandviken']),
(20,'Mjällby AIF',525,array['Mjällby']),
(21,'Trelleborgs FF',523,array['Trelleborg','TFF']),
(22,'GIF Sundsvall',495,array['Sundsvall']),
(23,'IK Brage',487,array['Brage']),
(24,'IK Sleipner',472,array['Sleipner']),
(25,'Gefle IF',467,array['Gefle']),
(26,'IK Sirius',395,array['Sirius']),
(27,'IFK Malmö',333,array[]::text[]),
(28,'IFK Eskilstuna',317,array[]::text[]),
(29,'Jönköpings Södra IF',314,array['Jönköpings Södra','J-Södra']),
(30,'Västra Frölunda IF',257,array['Frölunda']),
(31,'IF Brommapojkarna',250,array['Brommapojkarna','BP']),
(32,'IS Halmia',231,array['Halmia']),
(33,'Östersunds FK',213,array['Östersund','ÖFK']),
(34,'Gårda BK',211,array['Gårda']),
(35,'IFK Sundsvall',145,array[]::text[]),
(36,'IFK Värnamo',129,array['Värnamo']),
(37,'Varbergs BoIS',120,array['Varberg']),
(38,'Falkenbergs FF',117,array['Falkenberg']),
(39,'Västerås SK',109,array[]::text[]),
(40,'Syrianska FC',76,array['Syrianska']),
(41,'Råå IF',56,array['Råå']),
(42,'Ljungskile SK',44,array['Ljungskile']),
(43,'Athletic Eskilstuna',40,array[]::text[]),
(44,'Westermalms IF',37,array['Westermalm']),
(45,'Umeå FC',30,array['Umeå']),
(46,'IFK Uddevalla',30,array['Uddevalla']),
(47,'Hallstahammars SK',30,array['Hallstahammar']),
(48,'Stattena IF',28,array['Stattena']),
(49,'Motala AIF',25,array['Motala']),
(50,'Dalkurd FF',24,array['Dalkurd']),
(51,'Redbergslids IK',20,array['Redbergslid']),
(52,'Ludvika FK',20,array['Ludvika']),
(53,'IK Oddevold',19,array['Oddevold']),
(54,'IFK Luleå',18,array['Luleå']),
(55,'IF Saab',18,array['Saab']),
(56,'Reymersholms IK',16,array['Reymersholm']),
(57,'Norrby IF',15,array['Norrby']),
(58,'BK Derby',15,array['Derby']),
(59,'Assyriska FF',14,array['Assyriska']),
(60,'Brynäs IF',14,array['Brynäs']),
(61,'Enköpings SK',14,array['Enköping']),
(62,'Högadals IS',12,array['Högadal']),
(63,'Västerås IK',11,array[]::text[]),
(64,'IFK Holmsund',10,array['Holmsund']),
(65,'Sandvikens AIK',7,array[]::text[]),
(66,'IK City',7,array[]::text[]),
(67,'Billingsfors IK',3,array['Billingsfors'])
) as t(rank,name,value,aliases)
cross join (select id from public.game_lists where slug = 'allsvenskan-maratontabellen') l
on conflict (list_id, rank) do nothing;

-- ------------------------------------------------------------
-- 2. Världens 50 största huvudstäder
-- ------------------------------------------------------------
insert into public.game_lists (category_id, slug, title, subtitle, source, value_format, value_suffix, sort_order)
values (
  (select id from public.categories where slug = 'geografi'),
  'varldens-huvudstader',
  'Världens 50 största huvudstäder',
  'Rankade efter folkmängd i själva staden (ej storstadsregion)',
  'Källa: nationella folkräkningar/uppskattningar, sammanställda 2026',
  'millions_inv', '', 1
) on conflict (slug) do nothing;

insert into public.list_items (list_id, rank, name, value, aliases)
select l.id, t.rank, t.name, t.value, t.aliases from (values
(1,'Peking',21705033,array['Beijing']),
(2,'Moskva',11514405,array['Moscow']),
(3,'Jakarta',10135067,array[]::text[]),
(4,'Kinshasa',10076161,array[]::text[]),
(5,'Seoul',10063256,array['Söul']),
(6,'New Delhi',9879234,array['Delhi']),
(7,'Tokyo',8967744,array['Tokio']),
(8,'Dhaka',8906059,array[]::text[]),
(9,'Mexico City',8800078,array['Mexiko City','Ciudad de Mexico']),
(10,'Lima',8486908,array[]::text[]),
(11,'Bangkok',8280930,array[]::text[]),
(12,'London',8173921,array[]::text[]),
(13,'Kairo',8105079,array['Cairo']),
(14,'Bogotá',7980003,array['Bogota']),
(15,'Teheran',7797530,array['Tehran']),
(16,'Bagdad',7055260,array['Baghdad']),
(17,'Hanoi',6448867,array[]::text[]),
(18,'Santiago',5279229,array[]::text[]),
(19,'Riyadh',5188328,array['Riyad']),
(20,'Singapore',5183731,array['Singapore City']),
(21,'Ankara',3945712,array[]::text[]),
(22,'Addis Abeba',3480295,array['Addis Ababa']),
(23,'Nairobi',3476670,array[]::text[]),
(24,'Santo Domingo',3339411,array[]::text[]),
(25,'Alger',3335515,array['Algiers']),
(26,'Berlin',3326095,array[]::text[]),
(27,'Pyongyang',3255309,array[]::text[]),
(28,'Aten',3168940,array['Athens']),
(29,'Madrid',3155368,array[]::text[]),
(30,'Kabul',3071427,array[]::text[]),
(31,'Kathmandu',3008538,array['Katmandu']),
(32,'Kiev',2888522,array['Kyiv']),
(33,'Rom',2870515,array['Rome','Roma']),
(34,'Brasília',2852395,array['Brasilia']),
(35,'Buenos Aires',2776202,array[]::text[]),
(36,'Taipei',2696335,array[]::text[]),
(37,'Khartoum',2682459,array['Khartum']),
(38,'Luanda',2644394,array[]::text[]),
(39,'Antananarivo',2610025,array[]::text[]),
(40,'Dakar',2583084,array[]::text[]),
(41,'Sanaa',2575406,array['Sana']),
(42,'Guatemala City',2541651,array['Guatemala Stad']),
(43,'Bukarest',2354546,array['Bucharest']),
(44,'Accra',2291445,array[]::text[]),
(45,'Paris',2240676,array[]::text[]),
(46,'Tasjkent',2135763,array['Tashkent']),
(47,'Havanna',2126069,array['Havana']),
(48,'Harare',2123198,array[]::text[]),
(49,'Baku',2092054,array[]::text[]),
(50,'Stockholm',1981339,array[]::text[])
) as t(rank,name,value,aliases)
cross join (select id from public.game_lists where slug = 'varldens-huvudstader') l
on conflict (list_id, rank) do nothing;

-- ------------------------------------------------------------
-- 3. Premier League all-time-tabell
-- ------------------------------------------------------------
insert into public.game_lists (category_id, slug, title, subtitle, source, value_format, value_suffix, sort_order)
values (
  (select id from public.categories where slug = 'sport'),
  'premier-league-alltime',
  'Premier League — genom tiderna',
  'Alla 51 klubbar som spelat i Premier League sedan starten 1992/93',
  'Källa: premierleague.com/stats/all-time, uppdaterad t.o.m. januari 2026',
  'plain', ' p', 2
) on conflict (slug) do nothing;

insert into public.list_items (list_id, rank, name, value, aliases)
select l.id, t.rank, t.name, t.value, t.aliases from (values
(1,'Manchester United',2614,array['Man United','Man Utd','United']),
(2,'Arsenal',2473,array[]::text[]),
(3,'Liverpool',2402,array[]::text[]),
(4,'Chelsea',2366,array[]::text[]),
(5,'Tottenham Hotspur',1992,array['Tottenham','Spurs']),
(6,'Manchester City',1958,array['Man City','City']),
(7,'Everton',1755,array[]::text[]),
(8,'Newcastle United',1656,array['Newcastle']),
(9,'Aston Villa',1618,array['Villa']),
(10,'West Ham United',1432,array['West Ham']),
(11,'Southampton',1100,array[]::text[]),
(12,'Blackburn Rovers',970,array['Blackburn']),
(13,'Leeds United',867,array['Leeds']),
(14,'Leicester City',846,array['Leicester']),
(15,'Fulham',845,array[]::text[]),
(16,'Crystal Palace',756,array['Palace']),
(17,'Sunderland',672,array[]::text[]),
(18,'Middlesbrough',664,array[]::text[]),
(19,'Bolton Wanderers',575,array['Bolton']),
(20,'Wolverhampton Wanderers',497,array['Wolves']),
(21,'West Bromwich Albion',490,array['West Brom']),
(22,'Stoke City',457,array['Stoke']),
(23,'Brighton and Hove Albion',433,array['Brighton']),
(24,'Nottingham Forest',422,array['Forest']),
(25,'AFC Bournemouth',411,array['Bournemouth']),
(26,'Coventry City',409,array['Coventry']),
(27,'Norwich City',402,array['Norwich']),
(28,'Sheffield Wednesday',392,array[]::text[]),
(29,'Wimbledon FC',391,array['Wimbledon']),
(30,'Burnley',371,array[]::text[]),
(31,'Charlton Athletic',361,array['Charlton']),
(32,'Wigan Athletic',331,array['Wigan']),
(33,'Swansea City',312,array['Swansea']),
(34,'Queens Park Rangers',308,array['QPR']),
(35,'Birmingham City',301,array['Birmingham']),
(36,'Portsmouth',302,array[]::text[]),
(37,'Watford',285,array[]::text[]),
(38,'Derby County',274,array['Derby']),
(39,'Brentford',253,array[]::text[]),
(40,'Ipswich Town',246,array['Ipswich']),
(41,'Sheffield United',225,array[]::text[]),
(42,'Hull City',171,array['Hull']),
(43,'Reading',119,array[]::text[]),
(44,'Oldham Athletic',89,array['Oldham']),
(45,'Cardiff City',64,array['Cardiff']),
(46,'Bradford City',62,array['Bradford']),
(47,'Huddersfield Town',53,array['Huddersfield']),
(48,'Blackpool',39,array[]::text[]),
(49,'Barnsley',35,array[]::text[]),
(50,'Swindon Town',30,array['Swindon']),
(51,'Luton Town',26,array['Luton'])
) as t(rank,name,value,aliases)
cross join (select id from public.game_lists where slug = 'premier-league-alltime') l
on conflict (list_id, rank) do nothing;

-- ------------------------------------------------------------
-- 4. Världens längsta floder
-- ------------------------------------------------------------
insert into public.game_lists (category_id, slug, title, subtitle, source, value_format, value_suffix, sort_order)
values (
  (select id from public.categories where slug = 'geografi'),
  'varldens-langsta-floder',
  'Världens längsta floder',
  'De 15 längsta floderna, ungefärliga längder (mätmetod varierar mellan källor)',
  'Källa: allmänt citerade geografiska uppslagsverk',
  'plain', ' km', 2
) on conflict (slug) do nothing;

insert into public.list_items (list_id, rank, name, value, aliases)
select l.id, t.rank, t.name, t.value, t.aliases from (values
(1,'Nilen',6650,array['Nile']),
(2,'Amazonfloden',6400,array['Amazonas','Amazon']),
(3,'Yangtzefloden',6300,array['Yangtze','Chang Jiang']),
(4,'Mississippi-Missouri',6275,array['Mississippi']),
(5,'Jenisej-Angara',5539,array['Yenisei']),
(6,'Gula floden',5464,array['Huang He','Huanghe']),
(7,'Ob-Irtysj',5410,array['Ob']),
(8,'Kongofloden',4700,array['Congo','Kongo']),
(9,'Amurfloden',4444,array['Amur']),
(10,'Lenafloden',4400,array['Lena']),
(11,'Mekong',4350,array[]::text[]),
(12,'Mackenziefloden',4241,array['Mackenzie']),
(13,'Nigerfloden',4184,array['Niger']),
(14,'Brahmaputra',3969,array[]::text[]),
(15,'Volga',3531,array[]::text[])
) as t(rank,name,value,aliases)
cross join (select id from public.game_lists where slug = 'varldens-langsta-floder') l
on conflict (list_id, rank) do nothing;

-- ------------------------------------------------------------
-- 5. Världens högsta berg (åttatusenarna)
-- ------------------------------------------------------------
insert into public.game_lists (category_id, slug, title, subtitle, source, value_format, value_suffix, sort_order)
values (
  (select id from public.categories where slug = 'geografi'),
  'varldens-hogsta-berg',
  'Världens högsta berg',
  'De 14 bergstopparna över 8 000 meter',
  'Källa: allmänt citerade geografiska uppslagsverk',
  'plain', ' m', 3
) on conflict (slug) do nothing;

insert into public.list_items (list_id, rank, name, value, aliases)
select l.id, t.rank, t.name, t.value, t.aliases from (values
(1,'Mount Everest',8849,array['Everest','Sagarmatha','Chomolungma']),
(2,'K2',8611,array['Chhogori']),
(3,'Kangchenjunga',8586,array[]::text[]),
(4,'Lhotse',8516,array[]::text[]),
(5,'Makalu',8485,array[]::text[]),
(6,'Cho Oyu',8188,array[]::text[]),
(7,'Dhaulagiri I',8167,array['Dhaulagiri']),
(8,'Manaslu',8163,array[]::text[]),
(9,'Nanga Parbat',8126,array[]::text[]),
(10,'Annapurna I',8091,array['Annapurna']),
(11,'Gasherbrum I',8080,array['Hidden Peak']),
(12,'Broad Peak',8051,array[]::text[]),
(13,'Gasherbrum II',8035,array[]::text[]),
(14,'Shishapangma',8027,array[]::text[])
) as t(rank,name,value,aliases)
cross join (select id from public.game_lists where slug = 'varldens-hogsta-berg') l
on conflict (list_id, rank) do nothing;

-- ------------------------------------------------------------
-- 6. Världens största länder efter yta
-- ------------------------------------------------------------
insert into public.game_lists (category_id, slug, title, subtitle, source, value_format, value_suffix, sort_order)
values (
  (select id from public.categories where slug = 'geografi'),
  'varldens-storsta-lander',
  'Världens största länder',
  'De 20 största länderna efter yta',
  'Källa: allmänt citerade geografiska uppslagsverk',
  'plain', ' km²', 4
) on conflict (slug) do nothing;

insert into public.list_items (list_id, rank, name, value, aliases)
select l.id, t.rank, t.name, t.value, t.aliases from (values
(1,'Ryssland',17098242,array['Russia']),
(2,'Kanada',9984670,array['Canada']),
(3,'USA',9833517,array['Förenta staterna','United States']),
(4,'Kina',9596960,array['China']),
(5,'Brasilien',8515767,array['Brazil']),
(6,'Australien',7692024,array['Australia']),
(7,'Indien',3287263,array['India']),
(8,'Argentina',2780400,array[]::text[]),
(9,'Kazakstan',2724900,array['Kazakhstan']),
(10,'Algeriet',2381741,array['Algeria']),
(11,'DR Kongo',2344858,array['Kongo-Kinshasa']),
(12,'Saudiarabien',2149690,array['Saudi Arabia']),
(13,'Mexiko',1964375,array['Mexico']),
(14,'Indonesien',1904569,array['Indonesia']),
(15,'Sudan',1861484,array[]::text[]),
(16,'Libyen',1759540,array['Libya']),
(17,'Iran',1648195,array[]::text[]),
(18,'Mongoliet',1564110,array['Mongolia']),
(19,'Peru',1285216,array[]::text[]),
(20,'Tchad',1284000,array['Chad'])
) as t(rank,name,value,aliases)
cross join (select id from public.game_lists where slug = 'varldens-storsta-lander') l
on conflict (list_id, rank) do nothing;

-- ------------------------------------------------------------
-- 7. USA:s presidenter i ordning
-- ------------------------------------------------------------
insert into public.game_lists (category_id, slug, title, subtitle, source, value_format, value_suffix, sort_order)
values (
  (select id from public.categories where slug = 'historia'),
  'usas-presidenter',
  'USA:s presidenter',
  'Alla 47 presidentskap i ordning — skriv namnet, siffran är presidentnumret',
  'Källa: allmänt känd historisk fakta',
  'year', '', 1
) on conflict (slug) do nothing;

insert into public.list_items (list_id, rank, name, value, aliases)
select l.id, t.rank, t.name, t.value, t.aliases from (values
(1,'George Washington',1789,array[]::text[]),
(2,'John Adams',1797,array[]::text[]),
(3,'Thomas Jefferson',1801,array[]::text[]),
(4,'James Madison',1809,array[]::text[]),
(5,'James Monroe',1817,array[]::text[]),
(6,'John Quincy Adams',1825,array[]::text[]),
(7,'Andrew Jackson',1829,array[]::text[]),
(8,'Martin Van Buren',1837,array[]::text[]),
(9,'William Henry Harrison',1841,array[]::text[]),
(10,'John Tyler',1841,array[]::text[]),
(11,'James K. Polk',1845,array['James Polk']),
(12,'Zachary Taylor',1849,array[]::text[]),
(13,'Millard Fillmore',1850,array[]::text[]),
(14,'Franklin Pierce',1853,array[]::text[]),
(15,'James Buchanan',1857,array[]::text[]),
(16,'Abraham Lincoln',1861,array[]::text[]),
(17,'Andrew Johnson',1865,array[]::text[]),
(18,'Ulysses S. Grant',1869,array['Ulysses Grant']),
(19,'Rutherford B. Hayes',1877,array['Rutherford Hayes']),
(20,'James Garfield',1881,array[]::text[]),
(21,'Chester A. Arthur',1881,array['Chester Arthur']),
(22,'Grover Cleveland',1885,array[]::text[]),
(23,'Benjamin Harrison',1889,array[]::text[]),
(24,'Grover Cleveland',1893,array[]::text[]),
(25,'William McKinley',1897,array[]::text[]),
(26,'Theodore Roosevelt',1901,array['Teddy Roosevelt']),
(27,'William Howard Taft',1909,array[]::text[]),
(28,'Woodrow Wilson',1913,array[]::text[]),
(29,'Warren G. Harding',1921,array['Warren Harding']),
(30,'Calvin Coolidge',1923,array[]::text[]),
(31,'Herbert Hoover',1929,array[]::text[]),
(32,'Franklin D. Roosevelt',1933,array['FDR','Franklin Roosevelt']),
(33,'Harry S. Truman',1945,array['Harry Truman']),
(34,'Dwight D. Eisenhower',1953,array['Eisenhower']),
(35,'John F. Kennedy',1961,array['JFK','John Kennedy']),
(36,'Lyndon B. Johnson',1963,array['LBJ','Lyndon Johnson']),
(37,'Richard Nixon',1969,array[]::text[]),
(38,'Gerald Ford',1974,array[]::text[]),
(39,'Jimmy Carter',1977,array[]::text[]),
(40,'Ronald Reagan',1981,array[]::text[]),
(41,'George H. W. Bush',1989,array['George Bush','Bush senior']),
(42,'Bill Clinton',1993,array[]::text[]),
(43,'George W. Bush',2001,array['Bush junior']),
(44,'Barack Obama',2009,array[]::text[]),
(45,'Donald Trump',2017,array[]::text[]),
(46,'Joe Biden',2021,array[]::text[]),
(47,'Donald Trump',2025,array[]::text[])
) as t(rank,name,value,aliases)
cross join (select id from public.game_lists where slug = 'usas-presidenter') l
on conflict (list_id, rank) do nothing;

-- ------------------------------------------------------------
-- 8. Planeterna efter avstånd från solen
-- ------------------------------------------------------------
insert into public.game_lists (category_id, slug, title, subtitle, source, value_format, value_suffix, sort_order)
values (
  (select id from public.categories where slug = 'ovrigt'),
  'planeterna-efter-avstand',
  'Planeterna i solsystemet',
  'Efter genomsnittligt avstånd från solen — en lätt uppvärmningslista',
  'Källa: allmänt känd astronomisk fakta',
  'plain', ' milj. km', 1
) on conflict (slug) do nothing;

insert into public.list_items (list_id, rank, name, value, aliases)
select l.id, t.rank, t.name, t.value, t.aliases from (values
(1,'Mercurius',57.9,array['Mercury']),
(2,'Venus',108.2,array[]::text[]),
(3,'Jorden',149.6,array['Earth','Tellus']),
(4,'Mars',227.9,array[]::text[]),
(5,'Jupiter',778.5,array[]::text[]),
(6,'Saturnus',1434,array['Saturn']),
(7,'Uranus',2871,array[]::text[]),
(8,'Neptunus',4495,array['Neptune'])
) as t(rank,name,value,aliases)
cross join (select id from public.game_lists where slug = 'planeterna-efter-avstand') l
on conflict (list_id, rank) do nothing;
