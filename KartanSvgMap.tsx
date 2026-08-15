"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { FeatureCollection } from "geojson";
import { buildSwedenProjection } from "@/lib/kartan/geo";
import styles from "./kartan.module.css";

const VIEWPORT_W = 400;
const VIEWPORT_H = 760;
const MIN_SCALE = 1;
const MAX_SCALE = 20;

export interface RevealTarget {
  x: number;
  y: number;
}

interface KartanSvgMapProps {
  /** "sweden-regions" (21 län) eller "sweden-municipalities" (290 kommuner) */
  geoSource: "sweden-regions" | "sweden-municipalities";
  /** Om satt: klick på en region returnerar dess id. Annars är kartan fri att klicka var som helst (nålgissning). */
  clickMode: "region" | "point";
  guessRegionId?: string | null;
  guessPoint?: { lat: number; lon: number } | null;
  correctRegionId?: string | null;
  correctPoint?: { lat: number; lon: number } | null;
  revealed: boolean;
  onRegionClick?: (id: string, name: string) => void;
  onMapClick?: (lat: number, lon: number, pixel: { x: number; y: number }) => void;
  /** Valfri: tonar kartans kantfärg för att visuellt skilja kommun- och nålgissningsfrågor åt. */
  modeHint?: "kommun" | "punkt";
  /**
   * Valfri: ram runt ett geografiskt område (lat/lon-gränser) som kartan
   * ska starta inzoomad på, istället för hela Sverige. Används av
   * temapaket (t.ex. "Stockholm och omnejd") så spelaren slipper zooma
   * in manuellt varje fråga. Slumpade blandpaket skickar inte med detta,
   * och visar då hela landet som förut.
   */
  viewBounds?: { latMin: number; latMax: number; lonMin: number; lonMax: number } | null;
}

interface PanZoom {
  x: number;
  y: number;
  scale: number;
}

const IDENTITY: PanZoom = { x: 0, y: 0, scale: 1 };

/** Klämmer position/scale inom rimliga gränser — kan aldrig "rymma iväg" till extrema tal. */
function clampPanZoom(pz: PanZoom): PanZoom {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pz.scale));
  // Tillåt en del överpanorering, men aldrig så mycket att kartan helt lämnar vyn.
  const maxX = VIEWPORT_W * 0.6;
  const minX = -(VIEWPORT_W * scale - VIEWPORT_W * 0.4);
  const maxY = VIEWPORT_H * 0.6;
  const minY = -(VIEWPORT_H * scale - VIEWPORT_H * 0.4);
  return {
    scale,
    x: Number.isFinite(pz.x) ? Math.min(maxX, Math.max(minX, pz.x)) : 0,
    y: Number.isFinite(pz.y) ? Math.min(maxY, Math.max(minY, pz.y)) : 0,
  };
}

/**
 * Räknar ut vilken pan/zoom som ramar in ett givet lat/lon-område så det
 * fyller merparten av vyn — grunden för att temapaket kan starta
 * inzoomade på t.ex. Stockholm och omnejd istället för hela Sverige.
 */
function computeFramingPanZoom(
  bounds: { latMin: number; latMax: number; lonMin: number; lonMax: number },
  projection: ReturnType<typeof buildSwedenProjection>["projection"]
): PanZoom | null {
  const corners: [number, number][] = [
    [bounds.lonMin, bounds.latMin],
    [bounds.lonMin, bounds.latMax],
    [bounds.lonMax, bounds.latMin],
    [bounds.lonMax, bounds.latMax],
  ];
  const projected = corners.map((c) => projection(c)).filter(Boolean) as [number, number][];
  if (projected.length === 0) return null;

  const xs = projected.map((p) => p[0]);
  const ys = projected.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);

  const bboxW = Math.max(x1 - x0, 1);
  const bboxH = Math.max(y1 - y0, 1);
  const padding = 0.8; // fyll ~80% av vyn, lite luft runt kanterna

  const scale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, Math.min((VIEWPORT_W * padding) / bboxW, (VIEWPORT_H * padding) / bboxH))
  );

  const centerX = (x0 + x1) / 2;
  const centerY = (y0 + y1) / 2;

  return clampPanZoom({
    scale,
    x: VIEWPORT_W / 2 - centerX * scale,
    y: VIEWPORT_H / 2 - centerY * scale,
  });
}

export function KartanSvgMap({
  geoSource,
  clickMode,
  guessRegionId,
  guessPoint,
  correctRegionId,
  correctPoint,
  revealed,
  onRegionClick,
  onMapClick,
  modeHint,
  viewBounds,
}: KartanSvgMapProps) {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // --- Manuell pan/zoom, byggd ENBART på Pointer Events ---
  // (mus, touch och penna via samma API — inga separata touch-handlers,
  // vilket tidigare orsakade en krasch när båda systemen triggade samtidigt).
  const [panZoom, setPanZoom] = useState<PanZoom>(IDENTITY);
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDist = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const draggedRef = useRef(false);
  const [hoveredName, setHoveredName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const prevRevealed = useRef(revealed);

  useEffect(() => {
    let cancelled = false;
    fetch(`/data/kartan/${geoSource}.geojson`)
      .then((res) => res.json())
      .then((data: FeatureCollection) => {
        if (!cancelled) setGeoData(data);
      });
    return () => {
      cancelled = true;
    };
  }, [geoSource]);

  const { projection, path } = useMemo(() => {
    if (!geoData) return { projection: null, path: null };
    return buildSwedenProjection(geoData, VIEWPORT_W, VIEWPORT_H);
  }, [geoData]);

  // Startramen: om ett viewBounds (t.ex. Stockholm och omnejd) skickats
  // med, räkna ut vilken pan/zoom som ramar in det området. Annars
  // hela Sverige som förut (IDENTITY).
  const framedStart = useMemo(() => {
    if (!projection || !viewBounds) return IDENTITY;
    return computeFramingPanZoom(viewBounds, projection) ?? IDENTITY;
  }, [projection, viewBounds]);

  // Applicera startramen så fort kartan är redo (första gången
  // projektionen blir tillgänglig för just den här frågan).
  useEffect(() => {
    if (projection) setPanZoom(framedStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projection]);

  // Nollställ pan/zoom när en ny fråga börjar (revealed går från
  // true -> false) — till startramen (Sverige eller det tema-område
  // som gäller för just det här paketet).
  useEffect(() => {
    if (prevRevealed.current && !revealed) {
      setPanZoom(framedStart);
      activePointers.current.clear();
      lastPinchDist.current = null;
    }
    prevRevealed.current = revealed;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * VIEWPORT_W,
      y: ((clientY - rect.top) / rect.height) * VIEWPORT_H,
    };
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      // Zoom/pan tillåts fortfarande efter avslöjande, så man kan
      // utforska om gissning och facit hamnade långt isär.
      e.preventDefault();
      const { x: svgX, y: svgY } = clientToSvg(e.clientX, e.clientY);
      setPanZoom((pz) => {
        const factor = e.deltaY < 0 ? 1.25 : 0.8;
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pz.scale * factor));
        const dataX = (svgX - pz.x) / pz.scale;
        const dataY = (svgY - pz.y) / pz.scale;
        return clampPanZoom({ scale: newScale, x: svgX - dataX * newScale, y: svgY - dataY * newScale });
      });
    },
    [clientToSvg]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      (e.target as Element).setPointerCapture?.(e.pointerId);
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      draggedRef.current = false;
      if (activePointers.current.size === 1) {
        isDraggingRef.current = true;
        setIsDragging(true);
      } else {
        // En andra pekare tillkom -> vi går in i pinch-läge, inte drag-läge.
        isDraggingRef.current = false;
        setIsDragging(false);
        const pts = Array.from(activePointers.current.values());
        lastPinchDist.current = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      }
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!activePointers.current.has(e.pointerId)) return;
      const prev = activePointers.current.get(e.pointerId)!;
      activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.current.size === 1 && isDraggingRef.current && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const dx = ((e.clientX - prev.x) / rect.width) * VIEWPORT_W;
        const dy = ((e.clientY - prev.y) / rect.height) * VIEWPORT_H;
        if (Math.abs(e.clientX - prev.x) > 2 || Math.abs(e.clientY - prev.y) > 2) draggedRef.current = true;
        setPanZoom((pz) => clampPanZoom({ ...pz, x: pz.x + dx, y: pz.y + dy }));
        return;
      }

      if (activePointers.current.size === 2 && lastPinchDist.current !== null) {
        const pts = Array.from(activePointers.current.values());
        const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
        const midClientX = (pts[0].x + pts[1].x) / 2;
        const midClientY = (pts[0].y + pts[1].y) / 2;
        const { x: midSvgX, y: midSvgY } = clientToSvg(midClientX, midClientY);
        const ratio = dist / (lastPinchDist.current || dist);
        draggedRef.current = true;

        setPanZoom((pz) => {
          const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pz.scale * ratio));
          const dataX = (midSvgX - pz.x) / pz.scale;
          const dataY = (midSvgY - pz.y) / pz.scale;
          return clampPanZoom({ scale: newScale, x: midSvgX - dataX * newScale, y: midSvgY - dataY * newScale });
        });
        lastPinchDist.current = dist;
      }
    },
    [clientToSvg]
  );

  const endPointer = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    activePointers.current.delete(e.pointerId);
    if (activePointers.current.size < 2) lastPinchDist.current = null;
    if (activePointers.current.size === 0) {
      isDraggingRef.current = false;
      setIsDragging(false);
    }
  }, []);

  // OBS: correctPixel/guessPixel måste beräknas HÄR, före det villkorliga
  // "Laddar karta"-returnet nedan — annars anropas useEffect-hooken direkt
  // under i olika ordning mellan renderingar (laddar vs. klar), vilket
  // bryter Reacts hook-regler och kraschar hela komponenten.
  const correctPixel =
    geoData && projection
      ? clickMode === "point" && correctPoint
        ? projection([correctPoint.lon, correctPoint.lat])
        : clickMode === "region" && correctRegionId
        ? centroidOfFeature(geoData, correctRegionId, projection)
        : null
      : null;

  const guessPixel =
    geoData && projection && clickMode === "point" && guessPoint
      ? projection([guessPoint.lon, guessPoint.lat])
      : null;

  // Nålgissning: ramar in BÅDE gissningen och facit när svaret visas,
  // istället för att bara zooma blint mot facit — annars kunde en
  // gissning långt bort hamna helt utanför vyn, med panorering låst.
  useEffect(() => {
    if (clickMode !== "point") return;
    if (revealed && correctPixel) {
      const points: [number, number][] = guessPixel ? [guessPixel, correctPixel] : [correctPixel];
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      const x0 = Math.min(...xs);
      const x1 = Math.max(...xs);
      const y0 = Math.min(...ys);
      const y1 = Math.max(...ys);
      const bboxW = Math.max(x1 - x0, 1);
      const bboxH = Math.max(y1 - y0, 1);
      const padding = 0.55; // mer luft än startramen, så båda prickarna syns tydligt
      const scale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, Math.min((VIEWPORT_W * padding) / bboxW, (VIEWPORT_H * padding) / bboxH))
      );
      const centerX = (x0 + x1) / 2;
      const centerY = (y0 + y1) / 2;
      setPanZoom(
        clampPanZoom({
          scale,
          x: VIEWPORT_W / 2 - centerX * scale,
          y: VIEWPORT_H / 2 - centerY * scale,
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, clickMode]);

  if (!geoData || !projection || !path) {
    return (
      <div className={styles.mapLoading} style={{ aspectRatio: `${VIEWPORT_W}/${VIEWPORT_H}` }}>
        Laddar karta…
      </div>
    );
  }

  const proj = projection;

  // Region-läget (kommun/län) använder fortfarande den enkla CSS-baserade
  // zoomen mot facit-regionens mittpunkt — det finns bara EN punkt att
  // visa där (den färgade regionen), inget "både gissning och facit"-problem.
  const revealStyle =
    clickMode === "region" && revealed && correctPixel
      ? {
          transformOrigin: `${correctPixel[0]}px ${correctPixel[1]}px`,
          transform: "scale(2.2)",
        }
      : { transform: "scale(1)" };

  // Storleken på markörer/linjer ska vara konstant på SKÄRMEN, inte i
  // kart-enheter — annars blir de jättestora när man zoomat in långt
  // (exakt det som hände i stadspaketen: prickarna täckte halva vyn).
  const markerScale = 1 / panZoom.scale;

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (draggedRef.current) return; // en drag/pinch ska inte räknas som klick
    if (clickMode !== "point" || revealed || !onMapClick || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * VIEWPORT_W;
    const svgY = ((e.clientY - rect.top) / rect.height) * VIEWPORT_H;
    const px = (svgX - panZoom.x) / panZoom.scale;
    const py = (svgY - panZoom.y) / panZoom.scale;
    const inverted = proj.invert?.([px, py]);
    if (!inverted || !Number.isFinite(inverted[0]) || !Number.isFinite(inverted[1])) return;
    const [lon, lat] = inverted;
    onMapClick(lat, lon, { x: px, y: py });
  }

  return (
    <div
      className={`${styles.mapWrap} ${
        modeHint === "kommun" ? styles.mapWrapKommun : modeHint === "punkt" ? styles.mapWrapPunkt : ""
      }`}
      style={{ position: "relative" }}
    >
      {hoveredName && !revealed && <div className={styles.hoverBadge}>{hoveredName}</div>}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWPORT_W} ${VIEWPORT_H}`}
        className={styles.mapSvg}
        onClick={handleSvgClick}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
        style={{
          cursor: isDragging ? "grabbing" : !revealed && clickMode === "point" ? "crosshair" : "grab",
          touchAction: "none",
        }}
      >
        <g
          style={{
            transform: `translate(${panZoom.x}px, ${panZoom.y}px) scale(${panZoom.scale})`,
            transition: revealed ? "transform 900ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
          }}
        >
          <g className={styles.zoomGroup} style={revealStyle}>
            {geoData.features.map((feature) => {
              const id = String((feature.properties as { id: string }).id);
              const name = (feature.properties as { name: string }).name;
              const isGuess = clickMode === "region" && guessRegionId === id;
              const isCorrect = clickMode === "region" && revealed && correctRegionId === id;
              const d = path(feature) ?? undefined;

              let className = styles.region;
              if (isCorrect) className += ` ${styles.regionCorrect}`;
              else if (isGuess) className += ` ${styles.regionGuess}`;
              else if (revealed) className += ` ${styles.regionDimmed}`;

              return (
                <path
                  key={id}
                  d={d}
                  className={className}
                  onMouseEnter={() => !revealed && clickMode === "region" && setHoveredName(name)}
                  onMouseLeave={() => setHoveredName(null)}
                  onClick={() => {
                    if (draggedRef.current) return;
                    if (clickMode === "region" && !revealed && onRegionClick) {
                      onRegionClick(id, name);
                    }
                  }}
                />
              );
            })}

            {clickMode === "point" && guessPixel && (
              <circle
                cx={guessPixel[0]}
                cy={guessPixel[1]}
                r={5 * markerScale}
                strokeWidth={1.5 * markerScale}
                className={styles.guessDot}
              />
            )}

            {clickMode === "point" && revealed && correctPixel && (
              <>
                {guessPixel && (
                  <line
                    x1={guessPixel[0]}
                    y1={guessPixel[1]}
                    x2={correctPixel[0]}
                    y2={correctPixel[1]}
                    strokeWidth={0.8 * markerScale}
                    strokeDasharray={`${3 * markerScale} ${3 * markerScale}`}
                    className={styles.distanceLine}
                  />
                )}
                <circle
                  cx={correctPixel[0]}
                  cy={correctPixel[1]}
                  r={4 * markerScale}
                  className={styles.correctDot}
                />
                <circle
                  cx={correctPixel[0]}
                  cy={correctPixel[1]}
                  r={4 * markerScale}
                  strokeWidth={1.5 * markerScale}
                  className={styles.pingRing}
                />
              </>
            )}
          </g>
        </g>
      </svg>
      {!revealed && (
        <div className={styles.zoomHint}>Scrolla / nyp för att zooma, dra för att panorera</div>
      )}
    </div>
  );
}

function centroidOfFeature(
  geoData: FeatureCollection,
  id: string,
  projection: ReturnType<typeof buildSwedenProjection>["projection"]
): [number, number] | null {
  const feature = geoData.features.find(
    (f) => String((f.properties as { id: string }).id) === id
  );
  if (!feature || feature.geometry.type === "GeometryCollection") return null;
  const coords: number[][] = [];
  const collect = (geom: typeof feature.geometry) => {
    if (geom.type === "Polygon") geom.coordinates.forEach((ring) => coords.push(...ring));
    if (geom.type === "MultiPolygon")
      geom.coordinates.forEach((poly) => poly.forEach((ring) => coords.push(...ring)));
  };
  collect(feature.geometry);
  const projected = coords.map((c) => projection(c as [number, number])).filter(Boolean) as [
    number,
    number
  ][];
  if (projected.length === 0) return null;
  const xs = projected.map((p) => p[0]);
  const ys = projected.map((p) => p[1]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
}
