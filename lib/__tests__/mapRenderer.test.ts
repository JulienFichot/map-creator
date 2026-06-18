import { describe, it, expect } from 'vitest';
import { computeNeighborCodes, buildEffectiveNeighborCodes } from '../mapRenderer';
import type { DepartmentsGeoJSON, DepartmentFeature, MapConfig } from '../types';

// Coordinates are GeoJSON [lng, lat] format
function makeDept(code: string, minLng: number, minLat: number, maxLng: number, maxLat: number): DepartmentFeature {
  return {
    type: 'Feature',
    properties: { code, nom: code },
    geometry: {
      type: 'Polygon',
      coordinates: [[[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]],
    },
  };
}

// Main circle: Paris area, lat=48.7, lng=2.3
// Extra zone: Nice area, lat=43.7, lng=7.2
const GEO: DepartmentsGeoJSON = {
  type: 'FeatureCollection',
  features: [
    makeDept('75', 2.0, 48.5, 2.7, 49.0),   // Paris – main dept
    makeDept('92', 1.8, 48.4, 2.5, 48.8),   // Hauts-de-Seine – near Paris
    makeDept('94', 2.3, 48.6, 2.6, 48.9),   // Val-de-Marne – near Paris
    makeDept('13', 4.5, 43.0, 5.5, 43.8),   // Bouches-du-Rhône – near Nice
    makeDept('06', 6.5, 43.5, 7.5, 44.0),   // Alpes-Maritimes – near Nice
    makeDept('83', 5.5, 43.1, 6.8, 43.7),   // Var – near Nice
    makeDept('01', 4.8, 46.0, 5.8, 46.8),   // Ain – far from both
  ],
};

function baseConfig(overrides: Partial<MapConfig> = {}): MapConfig {
  return {
    cityName: 'Paris',
    lat: 48.7,
    lng: 2.3,
    radius: 50,
    departmentCode: '75',
    departmentName: 'Paris',
    region: 'Île-de-France',
    style: {} as MapConfig['style'],
    secondaryCities: [],
    ...overrides,
  };
}

// ── computeNeighborCodes ──────────────────────────────────────────────────────

describe('computeNeighborCodes', () => {
  it('includes departments whose bbox overlaps the circle', () => {
    const result = computeNeighborCodes(GEO, '75', 48.7, 2.3, 50);
    expect(result.has('92')).toBe(true);
    expect(result.has('94')).toBe(true);
  });

  it('excludes the main department code', () => {
    const result = computeNeighborCodes(GEO, '75', 48.7, 2.3, 50);
    expect(result.has('75')).toBe(false);
  });

  it('excludes departments far outside the circle', () => {
    const result = computeNeighborCodes(GEO, '75', 48.7, 2.3, 50);
    expect(result.has('01')).toBe(false);
  });

  it('bbox check is conservative: dept whose bbox extends to center is included even at tiny radius', () => {
    // '92' bbox extends east to lng=2.5, which overlaps Paris center (lng=2.3) at any radius
    const tiny = computeNeighborCodes(GEO, '75', 48.7, 2.3, 0.1);
    expect(tiny.has('92')).toBe(true);
    // '01' bbox starts at lng=4.8, far outside the tiny circle – excluded
    expect(tiny.has('01')).toBe(false);
  });

  it('finds southern depts from a Nice-area center', () => {
    // Nice center at (43.7, 7.2), 50 km
    // '83' (Var) bbox [5.5-6.8, 43.1-43.7] is close enough — maxX 6.8 >= circle west edge ~6.57
    // '06' (Alpes-Maritimes) bbox [6.5-7.5, 43.5-44.0] is centred near Nice
    // '13' (Bouches-du-Rhône) bbox [4.5-5.5, 43.0-43.8] is too far west — minX 4.5 > circle east edge ~7.83? No wait, minX 4.5 <= 7.826 but maxX 5.5 < circle west 6.57
    const result = computeNeighborCodes(GEO, '06', 43.7, 7.2, 50);
    expect(result.has('83')).toBe(true);
    expect(result.has('06')).toBe(false); // excluded as main
    expect(result.has('13')).toBe(false); // Bouches-du-Rhône bbox is too far west of Nice
  });

  it('returns a Set (not an array)', () => {
    const result = computeNeighborCodes(GEO, '75', 48.7, 2.3, 50);
    expect(result).toBeInstanceOf(Set);
  });
});

// ── buildEffectiveNeighborCodes ───────────────────────────────────────────────

describe('buildEffectiveNeighborCodes', () => {
  it('returns same result as computeNeighborCodes with no overrides', () => {
    const cfg = baseConfig();
    const direct = computeNeighborCodes(GEO, '75', 48.7, 2.3, 50);
    const built = buildEffectiveNeighborCodes(cfg, GEO);
    expect([...built].sort()).toEqual([...direct].sort());
  });

  it('adds departments covered by extra zones', () => {
    const cfg = baseConfig({
      extraZones: [{ id: 'z1', cityName: 'Nice', lat: 43.7, lng: 7.2, radius: 50 }],
    });
    const result = buildEffectiveNeighborCodes(cfg, GEO);
    // Main Paris circle covers 92, 94; Nice zone covers 06, 83 (13 is too far west)
    expect(result.has('92')).toBe(true);
    expect(result.has('06')).toBe(true);
    expect(result.has('83')).toBe(true);
  });

  it('extra zone does not re-add the main departmentCode', () => {
    const cfg = baseConfig({
      extraZones: [{ id: 'z1', cityName: 'Paris2', lat: 48.7, lng: 2.3, radius: 200 }],
    });
    const result = buildEffectiveNeighborCodes(cfg, GEO);
    expect(result.has('75')).toBe(false);
  });

  it('extraDeptCodes force-includes a dept', () => {
    const cfg = baseConfig({ extraDeptCodes: ['01'] });
    const result = buildEffectiveNeighborCodes(cfg, GEO);
    expect(result.has('01')).toBe(true);
  });

  it('extraDeptCodes does not add the main dept code', () => {
    const cfg = baseConfig({ extraDeptCodes: ['75'] });
    const result = buildEffectiveNeighborCodes(cfg, GEO);
    expect(result.has('75')).toBe(false);
  });

  it('hiddenDeptCodes removes a dept from neighbors', () => {
    const cfg = baseConfig({ hiddenDeptCodes: ['92'] });
    const result = buildEffectiveNeighborCodes(cfg, GEO);
    expect(result.has('92')).toBe(false);
  });

  it('hiddenDeptCodes has no effect on depts not in neighbors', () => {
    const cfg = baseConfig({ hiddenDeptCodes: ['99'] });
    const result = buildEffectiveNeighborCodes(cfg, GEO);
    expect(result.has('92')).toBe(true);
  });

  it('hiddenDeptCodes applied after extraDeptCodes', () => {
    const cfg = baseConfig({ extraDeptCodes: ['01'], hiddenDeptCodes: ['01'] });
    const result = buildEffectiveNeighborCodes(cfg, GEO);
    // hidden wins over extra
    expect(result.has('01')).toBe(false);
  });

  it('multiple extra zones union their depts', () => {
    const cfg = baseConfig({
      extraZones: [
        { id: 'z1', cityName: 'Nice', lat: 43.7, lng: 7.2, radius: 50 },
        { id: 'z2', cityName: 'BdR', lat: 43.4, lng: 5.0, radius: 50 },
      ],
    });
    const result = buildEffectiveNeighborCodes(cfg, GEO);
    expect(result.has('06')).toBe(true);
    expect(result.has('13')).toBe(true);
    expect(result.has('83')).toBe(true);
  });
});
