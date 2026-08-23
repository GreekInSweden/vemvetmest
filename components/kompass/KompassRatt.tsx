"use client";

import { useRef, useState, useCallback } from "react";
import styles from "./kompass.module.css";

const SIZE = 300;
const CENTER = SIZE / 2;
const RADIUS = 120;

function vinkelFranPunkt(clientX: number, clientY: number, rect: DOMRect) {
  const x = clientX - rect.left - CENTER;
  const y = clientY - rect.top - CENTER;
  let grader = (Math.atan2(x, -y) * 180) / Math.PI;
  if (grader < 0) grader += 360;
  return grader;
}

function punktPaCirkel(gradVinkel: number, radie: number) {
  const rad = (gradVinkel * Math.PI) / 180;
  return {
    x: CENTER + radie * Math.sin(rad),
    y: CENTER - radie * Math.cos(rad),
  };
}

function konPath(centerVinkel: number, bredd: number, radie: number) {
  const start = centerVinkel - bredd / 2;
  const slut = centerVinkel + bredd / 2;
  const p1 = punktPaCirkel(start, radie);
  const p2 = punktPaCirkel(slut, radie);
  const largeArc = bredd > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${p1.x} ${p1.y} A ${radie} ${radie} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`;
}

interface KompassRattProps {
  bredd: number;
  vinkel: number | null;
  onVinkelChange: (v: number) => void;
  revealed?: boolean;
  rattVinkel?: number | null;
  traff?: boolean | null;
  disabled?: boolean;
}

export function KompassRatt({
  bredd,
  vinkel,
  onVinkelChange,
  revealed = false,
  rattVinkel = null,
  traff = null,
  disabled = false,
}: KompassRattProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  const uppdateraFranPekare = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current || disabled || revealed) return;
      const rect = svgRef.current.getBoundingClientRect();
      const v = vinkelFranPunkt(clientX, clientY, rect);
      onVinkelChange(v);
    },
    [disabled, revealed, onVinkelChange]
  );

  const visadVinkel = vinkel ?? 0;
  const nal = punktPaCirkel(visadVinkel, RADIUS - 8);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className={styles.ratt}
      onPointerDown={(e) => {
        if (disabled || revealed) return;
        setDragging(true);
        (e.target as Element).setPointerCapture?.(e.pointerId);
        uppdateraFranPekare(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => dragging && uppdateraFranPekare(e.clientX, e.clientY)}
      onPointerUp={() => setDragging(false)}
      style={{ cursor: disabled || revealed ? "default" : "crosshair", touchAction: "none" }}
    >
      <circle cx={CENTER} cy={CENTER} r={RADIUS} className={styles.rattBakgrund} />

      {[0, 90, 180, 270].map((g) => {
        const p = punktPaCirkel(g, RADIUS + 16);
        const label = ({ 0: "N", 90: "Ö", 180: "S", 270: "V" } as Record<number, string>)[g];
        return (
          <text key={g} x={p.x} y={p.y} className={styles.vaderstreck} textAnchor="middle" dominantBaseline="middle">
            {label}
          </text>
        );
      })}

      {!revealed && vinkel !== null && (
        <path d={konPath(visadVinkel, bredd, RADIUS)} className={styles.konYta} />
      )}

      {!revealed && vinkel !== null && (
        <line x1={CENTER} y1={CENTER} x2={nal.x} y2={nal.y} className={styles.nal} />
      )}

      {revealed && rattVinkel !== null && (
        <>
          <path
            d={konPath(visadVinkel, bredd, RADIUS)}
            className={traff ? styles.konYtaTraff : styles.konYtaMiss}
          />
          {(() => {
            const r = punktPaCirkel(rattVinkel, RADIUS - 4);
            return <line x1={CENTER} y1={CENTER} x2={r.x} y2={r.y} className={styles.rattLinje} />;
          })()}
        </>
      )}

      <circle cx={CENTER} cy={CENTER} r={5} className={styles.centrumPrick} />
    </svg>
  );
}
