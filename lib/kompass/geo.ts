import { geoEquirectangular, geoPath, type GeoPath, type GeoProjection } from "d3-geo";
import type { FeatureCollection } from "geojson";

/**
 * Bygger en likformig (icke-förvrängande) plattkarte-projektion för
 * hela världen. Avgörande att viewBox är 2:1 (bredd:höjd) — det
 * matchar exakt jordens lon:lat-förhållande (360°:180°), så
 * fitExtent skalar lika mycket i båda led. Om proportionerna inte
 * matchade skulle kartans pilar peka åt ett annat håll än vad
 * lib/kompass/bearing.js faktiskt räknar ut — då skulle avslöjandet
 * visuellt motsäga facit.
 */
export function buildWorldProjection(
  featureCollection: FeatureCollection,
  width: number,
  height: number,
  padding = 4
): { projection: GeoProjection; path: GeoPath } {
  const projection = geoEquirectangular().fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    featureCollection
  );
  const path = geoPath(projection);
  return { projection, path };
}
