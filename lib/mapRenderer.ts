import type { MapConfig, DepartmentsGeoJSON, DepartmentFeature } from './types';

export interface RenderedMapData {
  config: MapConfig;
  geojson: DepartmentsGeoJSON;
  neighborCodes: Set<string>;
  mainDept: DepartmentFeature | undefined;
  circleGeoJSON: GeoJSON.Feature<GeoJSON.Polygon>;
}

function buildCircleGeoJSON(lat: number, lng: number, radiusKm: number, steps = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i * 360) / steps;
    const rad = (angle * Math.PI) / 180;
    const dLat = (radiusKm / 111) * Math.cos(rad);
    const dLng = (radiusKm / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(rad);
    coords.push([lng + dLng, lat + dLat]);
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [coords] },
  };
}

function bboxIntersectsCircle(
  geom: GeoJSON.Geometry,
  lat: number,
  lng: number,
  radiusKm: number
): boolean {
  function getCoords(g: GeoJSON.Geometry): [number, number][] {
    if (g.type === 'Polygon') return (g.coordinates as [number, number][][]).flat();
    if (g.type === 'MultiPolygon') return (g.coordinates as [number, number][][][]).flat(2);
    return [];
  }

  const degLat = radiusKm / 111;
  const degLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const coords = getCoords(geom);
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return (
    maxX >= lng - degLng &&
    minX <= lng + degLng &&
    maxY >= lat - degLat &&
    minY <= lat + degLat
  );
}

export function computeNeighborCodes(
  geojson: DepartmentsGeoJSON,
  mainCode: string,
  lat: number,
  lng: number,
  radiusKm: number
): Set<string> {
  const neighbors = new Set<string>();
  for (const feat of geojson.features) {
    if (feat.properties.code === mainCode) continue;
    if (bboxIntersectsCircle(feat.geometry, lat, lng, radiusKm)) {
      neighbors.add(feat.properties.code);
    }
  }
  return neighbors;
}

export function buildEffectiveNeighborCodes(config: MapConfig, geojson: DepartmentsGeoJSON): Set<string> {
  const codes = computeNeighborCodes(geojson, config.departmentCode, config.lat, config.lng, config.radius);

  // Extra zones contribute their own intersecting departments
  for (const zone of config.extraZones ?? []) {
    const zoneCodes = computeNeighborCodes(geojson, config.departmentCode, zone.lat, zone.lng, zone.radius);
    for (const c of zoneCodes) codes.add(c);
  }

  for (const c of config.extraDeptCodes ?? []) {
    if (c !== config.departmentCode) codes.add(c);
  }
  for (const c of config.hiddenDeptCodes ?? []) {
    codes.delete(c);
  }
  return codes;
}

export function buildRenderedMapData(
  config: MapConfig,
  geojson: DepartmentsGeoJSON
): RenderedMapData {
  const { lat, lng, radius, departmentCode } = config;
  const neighborCodes = computeNeighborCodes(geojson, departmentCode, lat, lng, radius);
  const mainDept = geojson.features.find((f) => f.properties.code === departmentCode);
  const circleGeoJSON = buildCircleGeoJSON(lat, lng, radius);

  return { config, geojson, neighborCodes, mainDept, circleGeoJSON };
}
