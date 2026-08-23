/**
 * Beräknar "plattkarte-riktningen" mellan två punkter, dvs vinkeln man
 * skulle rita en pil i om man bara tittade på longitud/latitud som
 * X/Y-koordinater på en platt karta (ekvidistant cylindrisk projektion).
 *
 * Medvetet INTE den geografiskt "korrekta" globkompass-riktningen
 * (storcirkelbäring) — den kan bli kontraintuitiv och skulle inte
 * matcha pilen som ritas på den platta kartan i avslöjandet. Se
 * konversationen där det här beslutades: enkelhet och visuell
 * konsekvens vägde tyngre än geografisk exakthet över klotets krökning.
 *
 * Returnerar grader medurs från norr (0=norr, 90=öst, 180=söder, 270=väster).
 */
export function berakningPlattkarteVinkel(franLat, franLon, tillLat, tillLon) {
  const dx = tillLon - franLon; // öst-väst
  const dy = tillLat - franLat; // nord-syd

  // atan2(dx, dy) ger vinkel från norr (positiv y), medurs — precis
  // det vi vill ha för en kompassvisning.
  let grader = (Math.atan2(dx, dy) * 180) / Math.PI;
  if (grader < 0) grader += 360;
  return grader;
}

/** Kortaste vinkelavståndet mellan två grader (0-180), hanterar 360-wrap. */
export function vinkelSkillnad(a, b) {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

/**
 * Avgör träff och poäng givet spelarens val (vinkel + bredd) och den
 * verkliga riktningen. Träff = den verkliga riktningen ligger inom
 * halva bredden på vardera sida av vald vinkel. Poäng avtar mjukt ju
 * längre från mitten av den valda pilen den verkliga riktningen ligger,
 * så en nätt träff nära kanten ger färre poäng än en rakt i mitten.
 */
export function berakningPoang(valdVinkel, valdBredd, rattVinkel, maxPoang = 500) {
  const avvikelse = vinkelSkillnad(valdVinkel, rattVinkel);
  const halvBredd = valdBredd / 2;
  const traff = avvikelse <= halvBredd;

  if (!traff) return { traff: false, poang: 0, avvikelse };

  // Full poäng rakt i mitten, avtar linjärt mot 40% av maxpoäng vid kanten
  // av den valda bredden — en träff ska alltid kännas belönande, bara
  // en TRÄFFSÄKER träff ska ge full pott.
  const andelAvKant = avvikelse / halvBredd; // 0 (mitten) till 1 (kanten)
  const poang = Math.round(maxPoang * (1 - andelAvKant * 0.6));
  return { traff: true, poang, avvikelse };
}
