import { describe, it, expect } from 'vitest';
import { generateSVG } from '../svgExporter';
import { emptyOverrides } from '../types';
import type { MapConfig, DepartmentsGeoJSON, DepartmentFeature, MapStyle, MapOverrides, ExtraZone } from '../types';

// ── path-parsing helpers ──────────────────────────────────────────────────────

function extractPathDs(svg: string): string[] {
  return [...svg.matchAll(/<path[^>]+\bd="([^"]+)"/g)].map(m => m[1]);
}

function pointCount(d: string): number {
  return [...d.matchAll(/[ML]/g)].length;
}

function parsePathPoints(d: string): Array<[number, number]> {
  return [...d.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map(m => [parseFloat(m[1]), parseFloat(m[2])]);
}

/** Returns the path with the most M/L points (the ZI circle has 65, rect depts have 5). */
function findLongestPath(svg: string): string {
  const paths = extractPathDs(svg);
  if (paths.length === 0) return '';
  return paths.reduce((best, d) => (pointCount(d) > pointCount(best) ? d : best), paths[0]);
}

// ── helpers ───────────────────────────────────────────────────────────────────

function makeDept(code: string, minLng: number, minLat: number, maxLng: number, maxLat: number): DepartmentFeature {
  return {
    type: 'Feature',
    properties: { code, nom: `Dept ${code}` },
    geometry: {
      type: 'Polygon',
      coordinates: [[[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]],
    },
  };
}

const GEO: DepartmentsGeoJSON = {
  type: 'FeatureCollection',
  features: [
    makeDept('75', 2.0, 48.5, 2.7, 49.0),
    makeDept('92', 1.8, 48.4, 2.5, 48.8),
    makeDept('06', 6.5, 43.5, 7.5, 44.0),
  ],
};

const BASE_STYLE: MapStyle = {
  backgroundColor: '#f5f5f0',
  mainDepartmentColor: '#e8e6df',
  mainDepartmentOpacity: 1,
  neighborDepartmentColor: '#ededea',
  neighborDepartmentOpacity: 0.8,
  borderColor: '#3b6fa0',
  borderWidth: 1.5,
  borderOpacity: 1,
  borderLineJoin: 'round',
  borderDash: 'solid',
  circleColor: '#f97316',
  circleOpacity: 0.15,
  circleBorderColor: '#f97316',
  circleDash: 'dashed',
  markerColor: '#f97316',
  markerSize: 12,
  markerType: 'dot',
  secondaryMarkerColor: '#64748b',
  mainTextColor: '#c2410c',
  secondaryTextColor: '#475569',
  fontFamily: 'Arial',
  labelOutlineWidth: 0,
  labelOutlineColor: '#ffffff',
  showDeptNumber: true,
  showDeptName: false,
  deptLabelSize: 28,
  deptLabelColor: '#c8c4bb',
  deptLabelWeight: 800,
  deptLabelFilled: true,
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
    style: BASE_STYLE,
    secondaryCities: [],
    ...overrides,
  };
}

const NEIGHBORS = new Set(['92']);

// ── SVG structure ─────────────────────────────────────────────────────────────

describe('generateSVG – structure', () => {
  it('starts with XML declaration', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS);
    expect(svg.startsWith('<?xml')).toBe(true);
  });

  it('contains an <svg> root element', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('default size is 800×800', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS);
    expect(svg).toContain('viewBox="0 0 800 800"');
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="800"');
  });

  it('respects custom size', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS, 2000);
    expect(svg).toContain('viewBox="0 0 2000 2000"');
  });

  it('contains a background rect', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS);
    expect(svg).toContain(`fill="${BASE_STYLE.backgroundColor}"`);
  });

  it('contains department fill paths', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS);
    expect(svg).toContain(`fill="${BASE_STYLE.mainDepartmentColor}"`);
    expect(svg).toContain(`fill="${BASE_STYLE.neighborDepartmentColor}"`);
  });

  it('outline mode adds a clipPath', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, undefined, true);
    expect(svg).toContain('<clipPath');
    expect(svg).toContain('clip-path="url(#deptOutlineClip)"');
  });

  it('non-outline mode has no clipPath', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, undefined, false);
    expect(svg).not.toContain('<clipPath');
  });
});

// ── City label ────────────────────────────────────────────────────────────────

describe('generateSVG – city label', () => {
  it('renders the city name in uppercase', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS);
    expect(svg).toContain('PARIS');
  });

  it('uses mainTextColor for city label by default', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS);
    expect(svg).toContain(BASE_STYLE.mainTextColor);
  });

  it('applies cityLabel color override', () => {
    const ovr: MapOverrides = { ...emptyOverrides(), cityLabel: { color: '#123456' } };
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('#123456');
  });

  it('applies cityLabel fontSize override', () => {
    const ovr: MapOverrides = { ...emptyOverrides(), cityLabel: { fontSize: 36 } };
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('font-size="36"');
  });

  it('applies cityLabel fontFamily override', () => {
    const ovr: MapOverrides = { ...emptyOverrides(), cityLabel: { fontFamily: 'Georgia' } };
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('Georgia');
  });

  it('uses custom lat/lng when cityLabel position is overridden', () => {
    const ovrA: MapOverrides = { ...emptyOverrides(), cityLabel: {} };
    const ovrB: MapOverrides = { ...emptyOverrides(), cityLabel: { lat: 49.0, lng: 3.0 } };
    const svgA = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, ovrA);
    const svgB = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, ovrB);
    // Different label position → SVGs differ
    expect(svgA).not.toBe(svgB);
    // x attribute of the text element containing PARIS differs
    const getX = (s: string) => s.match(/<text[^>]+>PARIS<\/text>/)?.[0]?.match(/x="([^"]+)"/)?.[1];
    expect(getX(svgA)).not.toEqual(getX(svgB));
  });

  it('renders label outline stroke when labelOutlineWidth > 0', () => {
    const cfg = baseConfig({ style: { ...BASE_STYLE, labelOutlineWidth: 3, labelOutlineColor: '#ffffff' } });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    expect(svg).toContain('paint-order="stroke fill"');
  });

  it('no stroke attribute when labelOutlineWidth is 0', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS);
    expect(svg).not.toContain('paint-order="stroke fill"');
  });
});

// ── Extra zones – city name label (bug fix) ───────────────────────────────────

describe('generateSVG – extra zone cityName label', () => {
  const zone: ExtraZone = { id: 'z1', cityName: 'Nice', lat: 43.7, lng: 7.2, radius: 30 };
  const cfg = baseConfig({ extraZones: [zone] });

  it('renders the extra zone city name in uppercase', () => {
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    expect(svg).toContain('NICE');
  });

  it('zone city name uses mainTextColor by default', () => {
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    // Check the NICE text element has the main text color
    expect(svg).toContain(BASE_STYLE.mainTextColor);
  });

  it('zone city name applies color override from extraZoneLabels', () => {
    const ovr: MapOverrides = { ...emptyOverrides(), extraZoneLabels: { z1: { color: '#abcdef' } } };
    const svg = generateSVG(cfg, GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('#abcdef');
  });

  it('zone city name applies fontSize override from extraZoneLabels', () => {
    const ovr: MapOverrides = { ...emptyOverrides(), extraZoneLabels: { z1: { fontSize: 30 } } };
    const svg = generateSVG(cfg, GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('font-size="30"');
  });

  it('zone city name applies fontFamily override from extraZoneLabels', () => {
    const ovr: MapOverrides = { ...emptyOverrides(), extraZoneLabels: { z1: { fontFamily: 'Georgia' } } };
    const svg = generateSVG(cfg, GEO, NEIGHBORS, 800, ovr);
    // Georgia appears in the extra zone text element
    expect(svg).toContain('Georgia');
  });

  it('zone city name uses overridden lat/lng when set', () => {
    const ovrA: MapOverrides = { ...emptyOverrides() };
    const ovrB: MapOverrides = { ...emptyOverrides(), extraZoneLabels: { z1: { lat: 44.0, lng: 7.5 } } };
    const svgA = generateSVG(cfg, GEO, NEIGHBORS, 800, ovrA);
    const svgB = generateSVG(cfg, GEO, NEIGHBORS, 800, ovrB);
    // Different positions → SVGs differ
    expect(svgA).not.toBe(svgB);
    // Extract x from text element containing NICE
    const getX = (s: string) => s.match(/<text[^>]+>NICE<\/text>/)?.[0]?.match(/x="([^"]+)"/)?.[1];
    expect(getX(svgA)).not.toEqual(getX(svgB));
  });

  it('multiple extra zones all have their city names', () => {
    const cfg2 = baseConfig({
      extraZones: [
        { id: 'z1', cityName: 'Nice', lat: 43.7, lng: 7.2, radius: 30 },
        { id: 'z2', cityName: 'Lyon', lat: 45.75, lng: 4.85, radius: 20 },
      ],
    });
    const svg = generateSVG(cfg2, GEO, NEIGHBORS);
    expect(svg).toContain('NICE');
    expect(svg).toContain('LYON');
  });

  it('extra zone with no extraZones produces no extra city name', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS);
    // Only PARIS should appear as a city label
    expect(svg).toContain('PARIS');
    expect(svg).not.toContain('NICE');
  });
});

// ── Extra zones – zoneStyle applied in SVG (bug fix) ─────────────────────────

describe('generateSVG – extra zone zoneStyle', () => {
  it('uses zoneStyle.fillColor when set', () => {
    const cfg = baseConfig({
      extraZones: [{ id: 'z1', cityName: 'Nice', lat: 43.7, lng: 7.2, radius: 30, zoneStyle: { fillColor: '#ff00ff' } }],
    });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    expect(svg).toContain('#ff00ff');
  });

  it('uses zoneStyle.fillOpacity when set', () => {
    const cfg = baseConfig({
      extraZones: [{ id: 'z1', cityName: 'Nice', lat: 43.7, lng: 7.2, radius: 30, zoneStyle: { fillOpacity: 0.42 } }],
    });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    expect(svg).toContain('fill-opacity="0.42"');
  });

  it('uses zoneStyle.borderColor when set', () => {
    const cfg = baseConfig({
      extraZones: [{ id: 'z1', cityName: 'Nice', lat: 43.7, lng: 7.2, radius: 30, zoneStyle: { borderColor: '#001122' } }],
    });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    expect(svg).toContain('#001122');
  });

  it('falls back to circleColor when no zoneStyle', () => {
    const cfg = baseConfig({
      extraZones: [{ id: 'z1', cityName: 'Nice', lat: 43.7, lng: 7.2, radius: 30 }],
    });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    // circleColor from BASE_STYLE
    expect(svg).toContain(BASE_STYLE.circleColor);
  });
});

// ── Text scaling with export size ─────────────────────────────────────────────

describe('generateSVG – text scaling (ts = size / 800)', () => {
  it('dept label font-size doubles at 1600px', () => {
    const svgAt800 = generateSVG(baseConfig(), GEO, NEIGHBORS, 800);
    const svgAt1600 = generateSVG(baseConfig(), GEO, NEIGHBORS, 1600);
    // Default deptLabelSize=28 → at 800: 28, at 1600: 56
    expect(svgAt800).toContain('font-size="28"');
    expect(svgAt1600).toContain('font-size="56"');
  });

  it('city label font-size scales proportionally', () => {
    // default cityFontSize = 22
    const svgAt800 = generateSVG(baseConfig(), GEO, NEIGHBORS, 800);
    const svgAt1600 = generateSVG(baseConfig(), GEO, NEIGHBORS, 1600);
    expect(svgAt800).toContain('font-size="22"');
    expect(svgAt1600).toContain('font-size="44"');
  });

  it('radius badge font-size scales (11px base)', () => {
    const svgAt800 = generateSVG(baseConfig(), GEO, NEIGHBORS, 800);
    const svgAt1600 = generateSVG(baseConfig(), GEO, NEIGHBORS, 1600);
    expect(svgAt800).toContain('font-size="11"');
    expect(svgAt1600).toContain('font-size="22"');
  });

  it('extra zone city name font-size scales (14px base)', () => {
    const cfg = baseConfig({ extraZones: [{ id: 'z1', cityName: 'Nice', lat: 43.7, lng: 7.2, radius: 30 }] });
    const svgAt800 = generateSVG(cfg, GEO, NEIGHBORS, 800);
    const svgAt1600 = generateSVG(cfg, GEO, NEIGHBORS, 1600);
    expect(svgAt800).toContain('font-size="14"');
    expect(svgAt1600).toContain('font-size="28"');
  });

  it('badge width scales (44px base)', () => {
    const svgAt800 = generateSVG(baseConfig(), GEO, NEIGHBORS, 800);
    const svgAt1600 = generateSVG(baseConfig(), GEO, NEIGHBORS, 1600);
    expect(svgAt800).toContain('width="44"');
    expect(svgAt1600).toContain('width="88"');
  });

  it('override fontSize also scales', () => {
    const ovr: MapOverrides = { ...emptyOverrides(), cityLabel: { fontSize: 20 } };
    const svgAt800 = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, ovr);
    const svgAt1600 = generateSVG(baseConfig(), GEO, NEIGHBORS, 1600, ovr);
    expect(svgAt800).toContain('font-size="20"');
    expect(svgAt1600).toContain('font-size="40"');
  });
});

// ── Dept labels ───────────────────────────────────────────────────────────────

describe('generateSVG – dept labels', () => {
  it('renders dept number when showDeptNumber=true', () => {
    const cfg = baseConfig({ style: { ...BASE_STYLE, showDeptNumber: true, showDeptName: false } });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    expect(svg).toContain('>75<');
  });

  it('renders dept name when showDeptName=true showDeptNumber=false', () => {
    const cfg = baseConfig({ style: { ...BASE_STYLE, showDeptNumber: false, showDeptName: true } });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    expect(svg).toContain('Dept 75');
  });

  it('renders both number and name when both enabled', () => {
    const cfg = baseConfig({ style: { ...BASE_STYLE, showDeptNumber: true, showDeptName: true } });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    expect(svg).toContain('>75<');
    expect(svg).toContain('Dept 75');
  });

  it('no dept labels when both showDeptNumber and showDeptName are false', () => {
    const cfg = baseConfig({ style: { ...BASE_STYLE, showDeptNumber: false, showDeptName: false } });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    expect(svg).not.toContain('>75<');
    expect(svg).not.toContain('Dept 75');
  });

  it('applies dept label color override', () => {
    const ovr: MapOverrides = {
      ...emptyOverrides(),
      depts: { '75': { labelColor: '#deadbe' } },
    };
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('#deadbe');
  });

  it('applies dept label size override and scales it', () => {
    const ovr: MapOverrides = {
      ...emptyOverrides(),
      depts: { '75': { labelSize: 40 } },
    };
    const svgAt800 = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, ovr);
    const svgAt1600 = generateSVG(baseConfig(), GEO, NEIGHBORS, 1600, ovr);
    expect(svgAt800).toContain('font-size="40"');
    expect(svgAt1600).toContain('font-size="80"');
  });

  it('hiddenLabelCodes suppresses that dept label', () => {
    const cfg = baseConfig({ hiddenLabelCodes: ['75'] });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    // '75' label should not appear
    expect(svg).not.toContain('>75<');
  });
});

// ── Secondary cities ──────────────────────────────────────────────────────────

describe('generateSVG – secondary cities', () => {
  it('renders secondary city name', () => {
    const cfg = baseConfig({ secondaryCities: [{ id: 's1', name: 'Versailles', lat: 48.8, lng: 2.1, type: 'secondary' }] });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    expect(svg).toContain('Versailles');
  });

  it('renders main-type secondary city name in uppercase', () => {
    const cfg = baseConfig({ secondaryCities: [{ id: 's1', name: 'Vincennes', lat: 48.85, lng: 2.44, type: 'main' }] });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    expect(svg).toContain('VINCENNES');
  });

  it('secondary city font-size scales', () => {
    const cfg = baseConfig({ secondaryCities: [{ id: 's1', name: 'Boulogne', lat: 48.83, lng: 2.24, type: 'secondary' }] });
    const svgAt800 = generateSVG(cfg, GEO, NEIGHBORS, 800);
    const svgAt1600 = generateSVG(cfg, GEO, NEIGHBORS, 1600);
    expect(svgAt800).toContain('font-size="11"');
    expect(svgAt1600).toContain('font-size="22"');
  });
});

// ── XML escaping ──────────────────────────────────────────────────────────────

describe('generateSVG – XML escaping', () => {
  it('escapes ampersand in city name', () => {
    const cfg = baseConfig({ cityName: 'A&B' });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    expect(svg).toContain('A&amp;B');
    expect(svg).not.toContain('"A&B"');
  });

  it('escapes angle brackets in extra zone city name', () => {
    const cfg = baseConfig({ extraZones: [{ id: 'z1', cityName: '<Test>', lat: 43.7, lng: 7.2, radius: 20 }] });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    expect(svg).toContain('&lt;TEST&gt;');
  });
});

// ── emptyOverrides ────────────────────────────────────────────────────────────

describe('emptyOverrides', () => {
  it('returns depts as empty object', () => {
    expect(emptyOverrides().depts).toEqual({});
  });

  it('returns cityLabel as empty object', () => {
    expect(emptyOverrides().cityLabel).toEqual({});
  });

  it('returns extraZoneLabels as empty object', () => {
    expect(emptyOverrides().extraZoneLabels).toEqual({});
  });

  it('each call returns a fresh object (no shared reference)', () => {
    const a = emptyOverrides();
    const b = emptyOverrides();
    a.depts['75'] = { fillColor: '#red' };
    expect(b.depts['75']).toBeUndefined();
    a.extraZoneLabels!['z1'] = { color: '#blue' };
    expect(b.extraZoneLabels?.['z1']).toBeUndefined();
  });
});

// ── ZI center override ────────────────────────────────────────────────────────

describe('generateSVG – ZI center override', () => {
  it('uses ziCenterLat/Lng when set instead of main lat/lng', () => {
    const cfgDefault = baseConfig();
    const cfgShifted = baseConfig({ ziCenterLat: 49.0, ziCenterLng: 2.8 });
    const svgDefault = generateSVG(cfgDefault, GEO, NEIGHBORS);
    const svgShifted = generateSVG(cfgShifted, GEO, NEIGHBORS);
    // The circle paths will differ
    expect(svgDefault).not.toBe(svgShifted);
  });
});

// ── Dept fill / stroke overrides ──────────────────────────────────────────────

describe('generateSVG – dept color overrides', () => {
  it('applies fillColor override for main dept', () => {
    const ovr: MapOverrides = { ...emptyOverrides(), depts: { '75': { fillColor: '#facade' } } };
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('#facade');
  });

  it('applies borderColor override for neighbor dept', () => {
    const ovr: MapOverrides = { ...emptyOverrides(), depts: { '92': { borderColor: '#c0ffee' } } };
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('#c0ffee');
  });
});

// ── Isotropic projection — ZI circle roundness ────────────────────────────────

describe('generateSVG – isotropic projection (ZI circle roundness)', () => {
  it('ZI circle x-range and y-range are within 5% of each other', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS);
    const d = findLongestPath(svg);
    expect(d).not.toBe('');
    const pts = parsePathPoints(d);
    expect(pts.length).toBeGreaterThan(30);
    const xs = pts.map(p => p[0]);
    const ys = pts.map(p => p[1]);
    const xRange = Math.max(...xs) - Math.min(...xs);
    const yRange = Math.max(...ys) - Math.min(...ys);
    const ratio = xRange / yRange;
    expect(ratio).toBeGreaterThan(0.95);
    expect(ratio).toBeLessThan(1.05);
  });

  it('ZI circle path has 65 points (turfCircleCoords with 64 steps)', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS);
    const d = findLongestPath(svg);
    expect(pointCount(d)).toBe(65);
  });

  it('circle remains round at higher latitudes where Mercator distortion is larger', () => {
    const northGeo: DepartmentsGeoJSON = {
      type: 'FeatureCollection',
      features: [makeDept('59', 2.5, 50.5, 3.5, 51.5)],
    };
    const cfg = baseConfig({ lat: 51.0, lng: 3.0, radius: 40, departmentCode: '59' });
    const svg = generateSVG(cfg, northGeo, new Set());
    const d = findLongestPath(svg);
    const pts = parsePathPoints(d);
    const xs = pts.map(p => p[0]);
    const ys = pts.map(p => p[1]);
    const ratio = (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
    expect(ratio).toBeGreaterThan(0.92);
    expect(ratio).toBeLessThan(1.08);
  });

  it('extra zone circles are also round', () => {
    const cfg = baseConfig({
      extraZones: [{ id: 'z1', cityName: 'Nice', lat: 43.7, lng: 7.2, radius: 30 }],
    });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    // The SVG now has two circles; both should be among the longest paths
    const paths = extractPathDs(svg).filter(d => pointCount(d) > 30);
    expect(paths.length).toBeGreaterThanOrEqual(2);
    for (const d of paths) {
      const pts = parsePathPoints(d);
      const xs = pts.map(p => p[0]);
      const ys = pts.map(p => p[1]);
      const ratio = (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
      expect(ratio).toBeGreaterThan(0.92);
      expect(ratio).toBeLessThan(1.08);
    }
  });
});

// ── Two-pass dept rendering ───────────────────────────────────────────────────

describe('generateSVG – two-pass dept rendering', () => {
  it('dept fill paths carry stroke="none"', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS);
    expect(svg).toContain('stroke="none"');
  });

  it('dept stroke paths carry fill="none"', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS);
    expect(svg).toContain('fill="none"');
  });

  it('fill group precedes stroke group', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS);
    const fillIdx = svg.indexOf('stroke="none"');
    const strokeIdx = svg.indexOf('fill="none"');
    expect(fillIdx).toBeGreaterThan(-1);
    expect(strokeIdx).toBeGreaterThan(-1);
    expect(fillIdx).toBeLessThan(strokeIdx);
  });

  it('main dept fill path has the correct fill color and stroke="none"', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS);
    const fillPath = svg.match(/<path[^>]+fill="#e8e6df"[^>]*>/)?.[0];
    expect(fillPath).toBeDefined();
    expect(fillPath).toContain('stroke="none"');
  });

  it('dept stroke path uses border color from style', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS);
    expect(svg).toContain(`stroke="${BASE_STYLE.borderColor}"`);
  });

  it('dept stroke path has fill="none" and carries stroke-width', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS);
    const strokePath = svg.match(/<path[^>]+fill="none"[^>]+stroke="[^"]*"[^>]*>/)?.[0];
    expect(strokePath).toBeDefined();
    expect(strokePath).toContain('stroke-width=');
  });

  it('border override applies to stroke path, not fill path', () => {
    const ovr: MapOverrides = { ...emptyOverrides(), depts: { '75': { borderColor: '#abcabc' } } };
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, ovr);
    // Custom color should appear in a fill="none" path
    const strokePath = svg.match(/<path[^>]+fill="none"[^>]+stroke="#abcabc"[^>]*>/)?.[0];
    expect(strokePath).toBeDefined();
  });
});

// ── SVG outline mode — strokes outside clip ───────────────────────────────────

describe('generateSVG – outline mode strokes outside clip', () => {
  it('fill="none" dept paths appear only AFTER the clip group closes', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, undefined, true);
    // The template produces: </g>\n  <g>{deptStrokes}</g>
    const transition = '</g>\n  <g>';
    const transIdx = svg.lastIndexOf(transition);
    expect(transIdx).toBeGreaterThan(-1);
    const before = svg.slice(0, transIdx);
    const after = svg.slice(transIdx);
    expect(before).not.toContain('fill="none"');
    expect(after).toContain('fill="none"');
  });

  it('dept fills (stroke="none") appear inside the clip group', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, undefined, true);
    const clipStart = svg.indexOf('clip-path="url(#deptOutlineClip)"');
    const transition = '</g>\n  <g>';
    const transIdx = svg.lastIndexOf(transition);
    const insideClip = svg.slice(clipStart, transIdx);
    expect(insideClip).toContain('stroke="none"');
    expect(insideClip).not.toContain('fill="none"');
  });

  it('non-outline mode has fill="none" inside the single content block', () => {
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, undefined, false);
    expect(svg).toContain('fill="none"');
    expect(svg).not.toContain('clip-path="url(#deptOutlineClip)"');
  });

  it('outline mode and non-outline mode produce different SVGs', () => {
    const outline = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, undefined, true);
    const normal = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, undefined, false);
    expect(outline).not.toBe(normal);
  });

  it('dept border color override still appears in outline mode stroke group', () => {
    const ovr: MapOverrides = { ...emptyOverrides(), depts: { '75': { borderColor: '#fedcba' } } };
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, ovr, true);
    const transition = '</g>\n  <g>';
    const transIdx = svg.lastIndexOf(transition);
    const strokeGroup = svg.slice(transIdx);
    expect(strokeGroup).toContain('#fedcba');
  });
});

// ── Secondary city label overrides ────────────────────────────────────────────

describe('generateSVG – secondary city label overrides', () => {
  const city1 = { id: 'sc1', name: 'Versailles', lat: 48.8, lng: 2.1, type: 'secondary' as const };
  const city2 = { id: 'sc2', name: 'Meudon', lat: 48.81, lng: 2.24, type: 'secondary' as const };
  const mainCity = { id: 'mc1', name: 'Vincennes', lat: 48.85, lng: 2.44, type: 'main' as const };

  it('text override replaces city name in output', () => {
    const cfg = baseConfig({ secondaryCities: [city1] });
    const ovr: MapOverrides = { ...emptyOverrides(), secondaryCityLabels: { sc1: { text: 'VRS' } } };
    const svg = generateSVG(cfg, GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('VRS');
    expect(svg).not.toContain('Versailles');
  });

  it('color override applies to secondary city label', () => {
    const cfg = baseConfig({ secondaryCities: [city1] });
    const ovr: MapOverrides = { ...emptyOverrides(), secondaryCityLabels: { sc1: { color: '#112233' } } };
    const svg = generateSVG(cfg, GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('#112233');
  });

  it('fontFamily override applies to secondary city label', () => {
    const cfg = baseConfig({ secondaryCities: [city1] });
    const ovr: MapOverrides = { ...emptyOverrides(), secondaryCityLabels: { sc1: { fontFamily: 'Verdana' } } };
    const svg = generateSVG(cfg, GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('Verdana');
  });

  it('fontSize override applies and scales with export size', () => {
    const cfg = baseConfig({ secondaryCities: [city1] });
    const ovr: MapOverrides = { ...emptyOverrides(), secondaryCityLabels: { sc1: { fontSize: 16 } } };
    const svgAt800 = generateSVG(cfg, GEO, NEIGHBORS, 800, ovr);
    const svgAt1600 = generateSVG(cfg, GEO, NEIGHBORS, 1600, ovr);
    expect(svgAt800).toContain('font-size="16"');
    expect(svgAt1600).toContain('font-size="32"');
  });

  it('position override (lat/lng) changes label location', () => {
    const cfg = baseConfig({ secondaryCities: [city1] });
    const ovrA: MapOverrides = { ...emptyOverrides() };
    const ovrB: MapOverrides = { ...emptyOverrides(), secondaryCityLabels: { sc1: { lat: 49.1, lng: 2.6 } } };
    const svgA = generateSVG(cfg, GEO, NEIGHBORS, 800, ovrA);
    const svgB = generateSVG(cfg, GEO, NEIGHBORS, 800, ovrB);
    expect(svgA).not.toBe(svgB);
  });

  it('individual overrides apply to each city independently', () => {
    const cfg = baseConfig({ secondaryCities: [city1, city2] });
    const ovr: MapOverrides = {
      ...emptyOverrides(),
      secondaryCityLabels: {
        sc1: { color: '#aabbcc', text: 'City1' },
        sc2: { color: '#ddeeff', text: 'City2' },
      },
    };
    const svg = generateSVG(cfg, GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('#aabbcc');
    expect(svg).toContain('#ddeeff');
    expect(svg).toContain('City1');
    expect(svg).toContain('City2');
    expect(svg).not.toContain('Versailles');
    expect(svg).not.toContain('Meudon');
  });

  it('override on one city does not affect the other', () => {
    const cfg = baseConfig({ secondaryCities: [city1, city2] });
    const ovr: MapOverrides = { ...emptyOverrides(), secondaryCityLabels: { sc1: { color: '#ff0000' } } };
    const svg = generateSVG(cfg, GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('Meudon');
  });

  it('main-type secondary city text override is uppercased', () => {
    const cfg = baseConfig({ secondaryCities: [mainCity] });
    const ovr: MapOverrides = { ...emptyOverrides(), secondaryCityLabels: { mc1: { text: 'custom' } } };
    const svg = generateSVG(cfg, GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('CUSTOM');
    expect(svg).not.toContain('Vincennes');
  });

  it('main-type secondary city color override applies', () => {
    const cfg = baseConfig({ secondaryCities: [mainCity] });
    const ovr: MapOverrides = { ...emptyOverrides(), secondaryCityLabels: { mc1: { color: '#ee1100' } } };
    const svg = generateSVG(cfg, GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('#ee1100');
  });

  it('no override — all secondary cities render with default style', () => {
    const cfg = baseConfig({ secondaryCities: [city1, city2] });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    expect(svg).toContain('Versailles');
    expect(svg).toContain('Meudon');
  });

  it('empty secondaryCityLabels override has no effect', () => {
    const cfg = baseConfig({ secondaryCities: [city1] });
    const withOvr = generateSVG(cfg, GEO, NEIGHBORS, 800, emptyOverrides());
    const withoutOvr = generateSVG(cfg, GEO, NEIGHBORS, 800);
    expect(withOvr).toBe(withoutOvr);
  });
});

// ── emptyOverrides – secondaryCityLabels ──────────────────────────────────────

describe('emptyOverrides – secondaryCityLabels', () => {
  it('returns secondaryCityLabels as empty object', () => {
    expect(emptyOverrides().secondaryCityLabels).toEqual({});
  });

  it('secondaryCityLabels is defined (not undefined)', () => {
    expect(emptyOverrides().secondaryCityLabels).toBeDefined();
  });

  it('each call returns fresh secondaryCityLabels (no shared reference)', () => {
    const a = emptyOverrides();
    const b = emptyOverrides();
    a.secondaryCityLabels!['sc1'] = { color: '#aaa' };
    expect(b.secondaryCityLabels?.['sc1']).toBeUndefined();
  });
});

// ── City label text override ──────────────────────────────────────────────────

describe('generateSVG – city label text override', () => {
  it('custom text replaces cityName in output', () => {
    const ovr: MapOverrides = { ...emptyOverrides(), cityLabel: { text: 'Ville de Paris' } };
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('VILLE DE PARIS');
    expect(svg).not.toContain('>PARIS<');
  });

  it('custom text is uppercased', () => {
    const ovr: MapOverrides = { ...emptyOverrides(), cityLabel: { text: 'test city' } };
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('TEST CITY');
    expect(svg).not.toContain('test city');
  });

  it('XML-special characters in custom text are escaped', () => {
    const ovr: MapOverrides = { ...emptyOverrides(), cityLabel: { text: 'A&B' } };
    const svg = generateSVG(baseConfig(), GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('A&amp;B');
    expect(svg).not.toContain('"A&B"');
  });
});

// ── Extra zone text override ──────────────────────────────────────────────────

describe('generateSVG – extra zone text override', () => {
  const zone: ExtraZone = { id: 'z1', cityName: 'Nice', lat: 43.7, lng: 7.2, radius: 30 };
  const cfg = baseConfig({ extraZones: [zone] });

  it('custom text replaces zone cityName', () => {
    const ovr: MapOverrides = { ...emptyOverrides(), extraZoneLabels: { z1: { text: 'Zone Sud' } } };
    const svg = generateSVG(cfg, GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('ZONE SUD');
    expect(svg).not.toContain('>NICE<');
  });

  it('custom text is uppercased', () => {
    const ovr: MapOverrides = { ...emptyOverrides(), extraZoneLabels: { z1: { text: 'azur' } } };
    const svg = generateSVG(cfg, GEO, NEIGHBORS, 800, ovr);
    expect(svg).toContain('AZUR');
  });
});

// ── Dept border style ─────────────────────────────────────────────────────────

describe('generateSVG – dept border style', () => {
  it('solid borderDash produces no dasharray attribute', () => {
    const cfg = baseConfig({ style: { ...BASE_STYLE, borderDash: 'solid' } });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    // stroke paths must not carry a dasharray
    const strokePath = svg.match(/<path[^>]+fill="none"[^>]*>/)?.[0];
    expect(strokePath).toBeDefined();
    expect(strokePath).not.toContain('stroke-dasharray');
  });

  it('dashed borderDash produces stroke-dasharray on dept stroke paths', () => {
    const cfg = baseConfig({ style: { ...BASE_STYLE, borderDash: 'dashed' } });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    const strokePath = svg.match(/<path[^>]+fill="none"[^>]*>/)?.[0];
    expect(strokePath).toBeDefined();
    expect(strokePath).toContain('stroke-dasharray="8 5"');
  });

  it('dotted borderDash produces the correct dasharray value', () => {
    const cfg = baseConfig({ style: { ...BASE_STYLE, borderDash: 'dotted' } });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    const strokePath = svg.match(/<path[^>]+fill="none"[^>]*>/)?.[0];
    expect(strokePath).toContain('stroke-dasharray="2 5"');
  });

  it('borderWidth applies to stroke paths', () => {
    const cfg = baseConfig({ style: { ...BASE_STYLE, borderWidth: 3 } });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    expect(svg).toContain('stroke-width="3"');
  });

  it('borderLineJoin applies to stroke paths', () => {
    const cfg = baseConfig({ style: { ...BASE_STYLE, borderLineJoin: 'miter' } });
    const svg = generateSVG(cfg, GEO, NEIGHBORS);
    expect(svg).toContain('stroke-linejoin="miter"');
  });
});
