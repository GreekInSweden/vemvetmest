"use client";

import { useEffect, useMemo, useState } from "react";
import type { FeatureCollection } from "geojson";
import { buildWorldProjection } from "@/lib/kompass/geo";
import styles from "./kompass.module.css";

const VIEW_W = 400;
const VIEW_H = 200;

interface Punkt {
  namn: string;
  lat: number;
  lon: number;
}

interface VarldsKartaProps {
  aktuell: Punkt | null;
  mal: Punkt | null;
  revealed: boolean;
}

export function VarldsKarta({ aktuell, mal, revealed }: VarldsKartaProps) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/data/kompass/world.geo.json")
      .then((r) => r.json())
      .then((d) => !cancelled && setGeoData(d));
    return () => {
      cancelled = true;
    };
  }, []);

  const { projection, path } = useMemo(() => {
    if (!geoData) return { projection: null, path: null };
    return buildWorldProjection(geoData, VIEW_W, VIEW_H);
  }, [geoData]);

  if (!geoData || !projection || !path) {
    return <div className={styles.kartaLoading}>Laddar karta…</div>;
  }

  const aktuellPixel = aktuell ? projection([aktuell.lon, aktuell.lat]) : null;
  const malPixel = revealed && mal ? projection([mal.lon, mal.lat]) : null;

  return (
    <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className={styles.varldskarta}>
      {geoData.features.map((f, i) => (
        <path key={i} d={path(f) ?? undefined} className={styles.land} />
      ))}

      {aktuellPixel && (
        <>
          <circle cx={aktuellPixel[0]} cy={aktuellPixel[1]} r={4} className={styles.aktuellPrick} />
          <circle cx={aktuellPixel[0]} cy={aktuellPixel[1]} r={4} className={styles.aktuellPing} />
        </>
      )}

      {malPixel && aktuellPixel && (
        <line
          x1={aktuellPixel[0]}
          y1={aktuellPixel[1]}
          x2={malPixel[0]}
          y2={malPixel[1]}
          className={styles.pilLinje}
          markerEnd="url(#kompassPilhuvud)"
        />
      )}

      {malPixel && <circle cx={malPixel[0]} cy={malPixel[1]} r={4} className={styles.malPrick} />}

      <defs>
        <marker id="kompassPilhuvud" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="#7ed321" />
        </marker>
      </defs>
    </svg>
  );
}
