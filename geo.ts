import { geoMercator, geoPath, type GeoPath, type GeoProjection } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";

/**
 * Bygger en Mercator-projektion anpassad till given viewport, centrerad på Sverige.
 * Används för att rendera vår GeoJSON (public/data/kartan/sweden-*.geojson) som SVG-paths.
 */
export function buildSwedenProjection(
  featureCollection: FeatureCollection,
  width: number,
  height: number,
  padding = 12
): { projection: GeoProjection; path: GeoPath } {
  const projection = geoMercator().fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    featureCollection
  );
  const path = geoPath(projection);
  return { projection, path };
}

/**
 * Haversine-formeln — avstånd i kilometer mellan två lat/lon-punkter.
 * Används för poängsättning i nålgissnings-läget (spelmoment 2).
 */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // jordens radie i km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Poängmodell för nålgissning: 1000p vid 0 km, avtagande exponentiellt.
 * Justera `decayKm` för att styra hur snabbt poängen sjunker.
 */
export function scoreFromDistance(distanceKm: number, decayKm = 120): number {
  const score = 1000 * Math.exp(-distanceKm / decayKm);
  return Math.round(Math.max(0, Math.min(1000, score)));
}
