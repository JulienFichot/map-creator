import type { DepartmentsGeoJSON, DepartmentFeature } from './types';

export const DEPTS_GEOJSON_URL =
  'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson';

let cachedGeoJSON: DepartmentsGeoJSON | null = null;

export async function loadDepartements(): Promise<DepartmentsGeoJSON> {
  if (cachedGeoJSON) return cachedGeoJSON;
  const resp = await fetch('/api/geojson/departements');
  if (!resp.ok) throw new Error('Impossible de charger les départements');
  cachedGeoJSON = await resp.json();
  return cachedGeoJSON!;
}

export function findDepartmentByCode(
  geojson: DepartmentsGeoJSON,
  code: string
): DepartmentFeature | undefined {
  return geojson.features.find((f) => f.properties.code === code);
}

export function getDepartmentContaining(
  geojson: DepartmentsGeoJSON,
  lat: number,
  lng: number
): DepartmentFeature | undefined {
  return geojson.features.find((f) => {
    try {
      const bbox = computeBBox(f.geometry);
      if (
        lng < bbox[0] || lng > bbox[2] ||
        lat < bbox[1] || lat > bbox[3]
      ) return false;
      return true;
    } catch {
      return false;
    }
  });
}

function processCoords(
  coords: number[] | number[][] | number[][][] | number[][][][],
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
): void {
  if (coords.length === 0) return;
  if (typeof coords[0] === 'number') {
    const [x, y] = coords as number[];
    if (x < bounds.minX) bounds.minX = x;
    if (x > bounds.maxX) bounds.maxX = x;
    if (y < bounds.minY) bounds.minY = y;
    if (y > bounds.maxY) bounds.maxY = y;
  } else {
    for (const c of coords as (number[] | number[][] | number[][][])[]) {
      processCoords(c as number[], bounds);
    }
  }
}

function computeBBox(geom: GeoJSON.Geometry): [number, number, number, number] {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  if (geom.type === 'Polygon') processCoords(geom.coordinates as number[][][], bounds);
  else if (geom.type === 'MultiPolygon') processCoords(geom.coordinates as number[][][][], bounds);
  return [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY];
}
