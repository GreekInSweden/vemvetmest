"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import styles from "./kartanLeaflet.module.css";

// Leaflets standard-ikoner pekar på bildfiler som brukar gå sönder i
// Next.js-bundling. Vi undviker hela problemet genom att aldrig
// använda standard-ikonerna — egna divIcon-markörer istället.

const SVERIGE_CENTER = [62.5, 15.5];
const SVERIGE_DEFAULT_ZOOM = 4;

function buildDivIcon(L, colorVar, size, pulse) {
  return L.divIcon({
    className: "",
    html: `<div class="${styles.marker} ${pulse ? styles.markerPulse : ""}" style="width:${size}px;height:${size}px;background:${colorVar};"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

interface KartanLeafletMapProps {
  guessPoint?: { lat: number; lon: number } | null;
  correctPoint?: { lat: number; lon: number } | null;
  revealed: boolean;
  viewBounds?: { latMin: number; latMax: number; lonMin: number; lonMax: number } | null;
  onMapClick?: (lat: number, lon: number) => void;
}

export function KartanLeafletMap({
  guessPoint,
  correctPoint,
  revealed,
  viewBounds,
  onMapClick,
}: KartanLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const guessMarkerRef = useRef<any>(null);
  const correctMarkerRef = useRef<any>(null);
  const lineRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const LRef = useRef<any>(null);

  // Init — körs en gång per fråga (komponenten remountas via key i PaketSpel)
  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((leafletModule) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const L = leafletModule.default;
      LRef.current = L;

      const map = L.map(containerRef.current, {
        center: SVERIGE_CENTER,
        zoom: SVERIGE_DEFAULT_ZOOM,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      if (viewBounds) {
        map.fitBounds(
          [
            [viewBounds.latMin, viewBounds.lonMin],
            [viewBounds.latMax, viewBounds.lonMax],
          ],
          { padding: [20, 20] }
        );
      }

      map.on("click", (e: any) => {
        if (revealedRef.current) return;
        onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
      setReady(true);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refs så map-click-callbacken (satt en gång vid init) alltid har
  // färska värden utan att behöva initieras om.
  const revealedRef = useRef(revealed);
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    revealedRef.current = revealed;
    onMapClickRef.current = onMapClick;
  }, [revealed, onMapClick]);

  // Rita/uppdatera gissnings-markören
  useEffect(() => {
    if (!ready || !mapRef.current || !LRef.current) return;
    const L = LRef.current;
    if (guessMarkerRef.current) {
      mapRef.current.removeLayer(guessMarkerRef.current);
      guessMarkerRef.current = null;
    }
    if (guessPoint) {
      guessMarkerRef.current = L.marker([guessPoint.lat, guessPoint.lon], {
        icon: buildDivIcon(L, "#4fa8d8", 18, false),
        interactive: false,
      }).addTo(mapRef.current);
    }
  }, [ready, guessPoint]);

  // Avslöjande: rätt markör, linje mellan gissning och facit, zooma så
  // båda syns.
  useEffect(() => {
    if (!ready || !mapRef.current || !LRef.current || !revealed || !correctPoint) return;
    const L = LRef.current;
    const map = mapRef.current;

    correctMarkerRef.current = L.marker([correctPoint.lat, correctPoint.lon], {
      icon: buildDivIcon(L, "var(--amber, #e8a33d)", 22, true),
      interactive: false,
    }).addTo(map);

    const bounds: any[] = [[correctPoint.lat, correctPoint.lon]];
    if (guessPoint) {
      bounds.push([guessPoint.lat, guessPoint.lon]);
      lineRef.current = L.polyline(
        [
          [guessPoint.lat, guessPoint.lon],
          [correctPoint.lat, correctPoint.lon],
        ],
        { color: "#7fa08d", weight: 2, dashArray: "6 6" }
      ).addTo(map);
    }

    map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 15, duration: 0.9 });

    return () => {
      if (correctMarkerRef.current) map.removeLayer(correctMarkerRef.current);
      if (lineRef.current) map.removeLayer(lineRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, revealed, correctPoint]);

  return (
    <div className={styles.mapWrap}>
      <div ref={containerRef} className={styles.leafletContainer} />
      {!revealed && <div className={styles.zoomHint}>Klicka på kartan för att placera din nål</div>}
    </div>
  );
}
