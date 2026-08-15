"use client";

import { useState } from "react";
import { KartanSvgMap } from "./KartanSvgMap";
import { KartanLeafletMap } from "./KartanLeafletMap";
import { usePaketFragor } from "@/hooks/useKartanPaket";
import { useSubmitKartanGuess } from "@/hooks/useSubmitKartanGuess";
import type { KartanGuessResultat } from "@/types/kartan";
import styles from "./kartan.module.css";

interface PaketSpelProps {
  paketId: string;
  paketNamn: string;
  spelareId: string;
  onKlar?: () => void;
  /** Om paketet är ett temapaket (t.ex. Stockholm och omnejd): ramen
   * kartan ska starta inzoomad på, istället för hela Sverige. */
  viewBounds?: { latMin: number; latMax: number; lonMin: number; lonMax: number } | null;
}

export function PaketSpel({ paketId, paketNamn, spelareId, onKlar, viewBounds }: PaketSpelProps) {
  const { fragor, loading } = usePaketFragor(paketId);
  const { submitGuess, submitting, error: guessError } = useSubmitKartanGuess(spelareId);

  const [index, setIndex] = useState(0);
  const [guessId, setGuessId] = useState<string | null>(null);
  const [guessName, setGuessName] = useState<string | null>(null);
  const [guessPoint, setGuessPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [resultat, setResultat] = useState<KartanGuessResultat | null>(null);
  const [totalPoang, setTotalPoang] = useState(0);
  const [antalRatt, setAntalRatt] = useState(0);

  if (loading) return <p style={{ color: "#8b94a3" }}>Laddar paket…</p>;
  if (fragor.length === 0) return <p style={{ color: "#8b94a3" }}>Det här paketet har inga frågor.</p>;

  const klar = index >= fragor.length;

  if (klar) {
    const maxPoang = fragor.length * 5000;
    return (
      <div className={styles.resultCard} style={{ maxWidth: 400 }}>
        <p className={styles.resultLabel}>{paketNamn} — klart!</p>
        <p className={styles.resultValue} style={{ fontSize: 28 }}>
          {totalPoang} / {maxPoang} poäng
        </p>
        <p className={`${styles.resultDetail} ${styles.resultDetailGood}`}>
          {antalRatt} av {fragor.length} träffar
        </p>
        {onKlar && (
          <button className={styles.secondaryButton} onClick={onKlar}>
            Till alla paket
          </button>
        )}
      </div>
    );
  }

  const fraga = fragor[index];
  const revealed = resultat !== null;
  const geoSource = fraga.typ === "kommun" ? "sweden-municipalities" : "sweden-regions";

  async function handleVisaSvar() {
    if (!fraga) return;
    const guess =
      fraga.typ === "punkt"
        ? guessPoint && { typ: "punkt" as const, rundaId: fraga.rundaId, lat: guessPoint.lat, lon: guessPoint.lon }
        : guessId && { typ: fraga.typ as "lan" | "kommun", rundaId: fraga.rundaId, platsId: guessId };
    if (!guess) return;

    const res = await submitGuess(guess, paketId);
    if (res) {
      setResultat(res);
      setTotalPoang((t) => t + res.poang);
      if (res.korrekt) setAntalRatt((a) => a + 1);
    }
  }

  function handleNasta() {
    setIndex((i) => i + 1);
    setGuessId(null);
    setGuessName(null);
    setGuessPoint(null);
    setResultat(null);
  }

  const correctPoint =
    resultat?.rattLat != null && resultat?.rattLon != null
      ? { lat: resultat.rattLat, lon: resultat.rattLon }
      : null;

  return (
    <div className={styles.gameLayout}>
      <div className={styles.sidebar}>
        <div className={styles.questionBar}>
          <p className={styles.quotaLabel} style={{ marginBottom: 10 }}>
            Fråga {index + 1} av {fragor.length} — {totalPoang} poäng hittills
          </p>
          <div className={styles.quotaBarTrack} style={{ marginBottom: 18 }}>
            <div
              className={styles.quotaBarFill}
              style={{ width: `${(index / fragor.length) * 100}%` }}
            />
          </div>

          <p className={`${styles.modeBadge} ${fraga.typ === "punkt" ? styles.modeBadgePunkt : styles.modeBadgeKommun}`}>
            {fraga.typ === "punkt" ? "NÅLGISSNING" : "KOMMUN"}
          </p>
          <p className={styles.category}>{fraga.titel}</p>
        </div>

        {!revealed ? (
          <div className={styles.actionBar}>
            <button
              className={styles.primaryButton}
              disabled={(fraga.typ === "punkt" ? !guessPoint : !guessId) || submitting}
              onClick={handleVisaSvar}
            >
              {fraga.typ === "punkt"
                ? guessPoint
                  ? "Visa svar"
                  : "Placera en nål"
                : guessId
                ? `Visa svar (gissning: ${guessName})`
                : fraga.typ === "kommun"
                ? "Välj en kommun"
                : "Välj ett län"}
            </button>
            {guessError && <p className={styles.errorNote}>{guessError}</p>}
          </div>
        ) : (
          <div className={`${styles.resultCard} ${styles.actionBar}`}>
            <p className={styles.resultLabel}>Rätt svar</p>
            <p className={styles.resultValue}>{resultat?.visadVarde}</p>
            {fraga.typ === "punkt" ? (
              <>
                <p className={`${styles.resultDetail} ${styles.resultDetailGood}`}>
                  Din gissning låg {Math.round(resultat?.avstandKm ?? 0)} km från rätt plats
                </p>
                {resultat?.korrekt && (
                  <p className={`${styles.resultDetail} ${styles.resultDetailGood}`}>Träff — inom tolerans!</p>
                )}
              </>
            ) : (
              <p
                className={
                  resultat?.korrekt
                    ? `${styles.resultDetail} ${styles.resultDetailGood}`
                    : styles.resultDetail
                }
              >
                {resultat?.korrekt ? "Helt rätt!" : "Inte riktigt — men nära nog?"}
              </p>
            )}
            <p className={styles.resultDetail}>Poäng: {resultat?.poang}</p>
            <button className={styles.secondaryButton} onClick={handleNasta}>
              {index + 1 >= fragor.length ? "Se resultat" : "Nästa fråga"}
            </button>
          </div>
        )}
      </div>

      <div className={styles.mapArea}>
        {fraga.typ === "punkt" ? (
          <KartanLeafletMap
            key={fraga.rundaId}
            guessPoint={guessPoint}
            correctPoint={correctPoint}
            revealed={revealed}
            viewBounds={viewBounds}
            onMapClick={(lat, lon) => {
              if (!revealed) setGuessPoint({ lat, lon });
            }}
          />
        ) : (
          <KartanSvgMap
            geoSource={geoSource}
            clickMode="region"
            modeHint="kommun"
            guessRegionId={guessId}
            correctRegionId={resultat?.rattPlatsId ?? null}
            revealed={revealed}
            onRegionClick={(id, name) => {
              if (!revealed) {
                setGuessId(id);
                setGuessName(name);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
