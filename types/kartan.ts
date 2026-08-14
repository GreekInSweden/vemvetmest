// Delade typer för Kartan-spelet (Spelmoment 1: länsklick, Spelmoment 2: nålgissning)

export type KartanSpeltyp = "lan" | "kommun" | "punkt";

export interface KartanPlats {
  id: string; // t.ex. "01" (länskod) eller "0138" (kommunkod)
  namn: string;
  lat: number;
  lon: number;
  lanCode?: string; // endast för kommuner
}

export interface KartanKategori {
  id: string;
  namn: string;
  beskrivning: string | null;
  typ: KartanSpeltyp;
}

export interface KartanRunda {
  id: string;
  kategoriId: string;
  titel: string; // frågan, t.ex. "Flest registrerade fritidsbåtar per invånare"
  typ: KartanSpeltyp;
  // För typ "lan": rätt svar är en plats (län)
  rattPlatsId?: string;
  // För typ "punkt": rätt svar är fri koordinat (t.ex. historisk händelse)
  rattLat?: number;
  rattLon?: number;
  visadVarde: string; // texten som visas vid avslöjande, t.ex. "1 båt per 6 invånare"
}

export interface KartanGuessRegion {
  typ: "lan" | "kommun";
  rundaId: string;
  platsId: string;
}

export interface KartanGuessPunkt {
  typ: "punkt";
  rundaId: string;
  lat: number;
  lon: number;
}

export type KartanGuess = KartanGuessRegion | KartanGuessPunkt;

export interface KartanGuessResultat {
  korrekt: boolean; // endast relevant för "lan"
  avstandKm: number | null; // endast relevant för "punkt"
  poang: number;
  rattPlatsId?: string;
  rattLat?: number;
  rattLon?: number;
  visadVarde: string;
}

export interface KartanPaketSummering {
  id: string;
  namn: string;
}

export interface KartanPaketFraga {
  rundaId: string;
  titel: string;
  typ: KartanSpeltyp;
  ordning: number;
}

export interface GeoJsonRegionProps {
  id: string;
  name: string;
}

export interface GeoJsonMunicipalityProps {
  id: string;
  name: string;
  lan_code: string;
}
