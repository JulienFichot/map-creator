import type { MapConfig, DepartmentsGeoJSON, DepartmentFeature, MapOverrides } from './types';
import { getFontSVGEmbed } from './fonts';
import { markerSVGElements } from './markers';

function mercatorY(lat: number): number {
  const latRad = (lat * Math.PI) / 180;
  return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
}

function mercatorYToLat(my: number): number {
  return (2 * Math.atan(Math.exp(my)) - Math.PI / 2) * (180 / Math.PI);
}

interface Viewport {
  minLng: number; maxLng: number; minLat: number; maxLat: number;
  minMY: number; maxMY: number; width: number; height: number; pad: number;
}

function buildViewport(lat: number, lng: number, radiusKm: number, size: number): Viewport {
  const degLat = (radiusKm / 111) * 1.4;
  const degLng = degLat / Math.cos((lat * Math.PI) / 180);
  const pad = 20;
  const innerSize = size - pad * 2;
  const minLat = lat - degLat, maxLat = lat + degLat;
  const minLng = lng - degLng, maxLng = lng + degLng;
  return { minLng, maxLng, minLat, maxLat, minMY: mercatorY(minLat), maxMY: mercatorY(maxLat), width: innerSize, height: innerSize, pad };
}

function buildViewportFromFeatures(features: DepartmentFeature[], size: number): Viewport {
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const feat of features) {
    const scan = (ring: number[][]) => {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    };
    const geom = feat.geometry;
    if (geom.type === 'Polygon') (geom.coordinates as number[][][]).forEach(scan);
    else if (geom.type === 'MultiPolygon') (geom.coordinates as number[][][][]).forEach(p => p.forEach(scan));
  }
  if (!isFinite(minLng)) { minLng = -5; maxLng = 10; minLat = 42; maxLat = 52; }

  const latPad = (maxLat - minLat) * 0.06;
  const lngPad = (maxLng - minLng) * 0.06;
  minLat -= latPad; maxLat += latPad;
  minLng -= lngPad; maxLng += lngPad;

  const pad = 30;
  const innerSize = size - pad * 2;

  let minMY = mercatorY(minLat), maxMY = mercatorY(maxLat);
  const lngRange = maxLng - minLng;
  const myRange = maxMY - minMY;
  // For isotropic projection (circles stay circular): lngRange_deg = myRange_mercator × (180/π)
  const equivalentLngRange = myRange * (180 / Math.PI);
  const centerLng = (minLng + maxLng) / 2;
  const centerMY = (minMY + maxMY) / 2;
  if (lngRange < equivalentLngRange) {
    minLng = centerLng - equivalentLngRange / 2;
    maxLng = centerLng + equivalentLngRange / 2;
  } else {
    const equivalentMyRange = lngRange * (Math.PI / 180);
    minMY = centerMY - equivalentMyRange / 2;
    maxMY = centerMY + equivalentMyRange / 2;
    minLat = mercatorYToLat(minMY);
    maxLat = mercatorYToLat(maxMY);
  }

  return { minLng, maxLng, minLat, maxLat, minMY, maxMY, width: innerSize, height: innerSize, pad };
}

function project(lat: number, lng: number, vp: Viewport): [number, number] {
  const x = ((lng - vp.minLng) / (vp.maxLng - vp.minLng)) * vp.width + vp.pad;
  const my = mercatorY(lat);
  const y = (1 - (my - vp.minMY) / (vp.maxMY - vp.minMY)) * vp.height + vp.pad;
  return [x, y];
}

function coordsToPath(coords: number[][][], vp: Viewport): string {
  return coords.map((ring) =>
    ring.map(([lng, lat], i) => {
      const [x, y] = project(lat, lng, vp);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ') + ' Z'
  ).join(' ');
}

function geometryToPath(geom: GeoJSON.Geometry, vp: Viewport): string {
  if (geom.type === 'Polygon') return coordsToPath(geom.coordinates as number[][][], vp);
  if (geom.type === 'MultiPolygon') return (geom.coordinates as number[][][][]).map((poly) => coordsToPath(poly as number[][][], vp)).join(' ');
  return '';
}

function turfCircleCoords(lat: number, lng: number, radiusKm: number, steps = 64): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (i * 360) / steps;
    const rad = (angle * Math.PI) / 180;
    pts.push([lng + (radiusKm / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(rad), lat + (radiusKm / 111) * Math.cos(rad)]);
  }
  return pts;
}

function circleToPath(lat: number, lng: number, radiusKm: number, vp: Viewport): string {
  const pts = turfCircleCoords(lat, lng, radiusKm);
  return pts.map(([pLng, pLat], i) => {
    const [x, y] = project(pLat, pLng, vp);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ') + ' Z';
}

function computeCentroid(feat: DepartmentFeature): [number, number] {
  let sumLat = 0, sumLng = 0, count = 0;
  function collect(coords: unknown): void {
    if (Array.isArray(coords) && typeof coords[0] === 'number') { sumLng += coords[0] as number; sumLat += coords[1] as number; count++; }
    else if (Array.isArray(coords)) (coords as unknown[]).forEach(collect);
  }
  collect(feat.geometry.type === 'Polygon' ? feat.geometry.coordinates : feat.geometry.type === 'MultiPolygon' ? feat.geometry.coordinates : []);
  return count > 0 ? [sumLat / count, sumLng / count] : [0, 0];
}

function isFeatureVisible(feat: DepartmentFeature, vp: Viewport): boolean {
  const geom = feat.geometry;
  function check(coords: number[][]): boolean {
    return coords.some(([lng, lat]) => lat >= vp.minLat && lat <= vp.maxLat && lng >= vp.minLng && lng <= vp.maxLng);
  }
  if (geom.type === 'Polygon') return check((geom.coordinates as number[][][]).flat());
  if (geom.type === 'MultiPolygon') return (geom.coordinates as number[][][][]).some((p) => check(p.flat()));
  return false;
}

const DASH_MAP: Record<string, string> = { solid: 'none', dashed: '8 5', dotted: '2 5' };

export function generateSVG(
  config: MapConfig,
  geojson: DepartmentsGeoJSON,
  neighborCodes: Set<string>,
  size = 800,
  overrides?: MapOverrides,
  outline = false
): string {
  const { lat, lng, radius, style, cityName, secondaryCities } = config;
  const ziLat = config.ziCenterLat ?? lat;
  const ziLng = config.ziCenterLng ?? lng;

  // Build viewport from the actual bounds of all departments to render (main + neighbors)
  const deptFeaturesToRender = geojson.features.filter((f) => {
    const code = f.properties.code;
    return code === config.departmentCode || neighborCodes.has(code);
  });
  const vp = deptFeaturesToRender.length > 0
    ? buildViewportFromFeatures(deptFeaturesToRender, size)
    : buildViewport(lat, lng, radius, size);

  const visibleFeatures = geojson.features.filter((f) => isFeatureVisible(f, vp));

  // Text scale: keeps font sizes proportional to the export canvas so text looks
  // identical whether exporting SVG (800px) or PNG (1200/2000/3000px).
  const ts = size / 800;
  const t = (px: number) => Math.round(px * ts);

  // ── Dept paths — two passes: fills first, then strokes on top.
  // Separating fill/stroke ensures shared borders between depts don't accumulate
  // double strokes (which would make them appear thicker than outer borders).
  const strokeDash = DASH_MAP[style.borderDash ?? 'solid'] ?? 'none';
  const strokeDashAttr = strokeDash !== 'none' ? ` stroke-dasharray="${strokeDash}"` : '';

  const deptFills = geojson.features.map((f) => {
    const isMain = f.properties.code === config.departmentCode;
    const isNeighbor = neighborCodes.has(f.properties.code);
    if (!isMain && !isNeighbor) return '';
    const deptOvr = overrides?.depts[f.properties.code];
    const fill = deptOvr?.fillColor ?? (isMain ? style.mainDepartmentColor : style.neighborDepartmentColor);
    const fillOpacity = isMain ? (style.mainDepartmentOpacity ?? 1) : (style.neighborDepartmentOpacity ?? 0.8);
    const path = geometryToPath(f.geometry, vp);
    if (!path) return '';
    return `<path d="${path}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="none"/>`;
  }).filter(Boolean).join('\n    ');

  const deptStrokes = geojson.features.map((f) => {
    const isMain = f.properties.code === config.departmentCode;
    const isNeighbor = neighborCodes.has(f.properties.code);
    if (!isMain && !isNeighbor) return '';
    const deptOvr = overrides?.depts[f.properties.code];
    const stroke = deptOvr?.borderColor ?? style.borderColor;
    const path = geometryToPath(f.geometry, vp);
    if (!path) return '';
    return `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="${style.borderWidth}" stroke-opacity="${style.borderOpacity}" stroke-linejoin="${style.borderLineJoin}"${strokeDashAttr}/>`;
  }).filter(Boolean).join('\n    ');

  // ── Circle ───────────────────────────────────────────────────────────
  const circlePath = circleToPath(ziLat, ziLng, radius, vp);
  const zoneDash = DASH_MAP[style.circleDash ?? 'dashed'] ?? '8 5';
  const circleLabel = `${radius} km`;
  const labelAngleRad = (45 * Math.PI) / 180;

  const ff = escapeXml(style.fontFamily);

  // Badge dimensions (scaled so badges match text at every export size)
  const badgeW = t(44); const badgeH = t(18); const badgeRx = t(4);
  const badgeFontSize = t(11);

  // ── Extra zones ───────────────────────────────────────────────────────
  const extraZonesSvg = (config.extraZones ?? []).map((zone) => {
    const zs = zone.zoneStyle;
    const zFillColor = zs?.fillColor ?? style.circleColor;
    const zFillOpacity = (zs?.fillOpacity !== undefined ? zs.fillOpacity : style.circleOpacity * 0.7).toFixed(2);
    const zBorderColor = zs?.borderColor ?? style.circleBorderColor;
    const zBorderDash = DASH_MAP[zs?.borderDash ?? style.circleDash ?? 'dashed'] ?? '8 5';
    const zonePath2 = circleToPath(zone.lat, zone.lng, zone.radius, vp);

    // Radius badge position (top-right of the zone circle)
    const lLat2 = zone.lat + (zone.radius / 111) * 1.08 * Math.cos(labelAngleRad);
    const lLng2 = zone.lng + (zone.radius / (111 * Math.cos((zone.lat * Math.PI) / 180))) * 1.08 * Math.sin(labelAngleRad);
    const [lx2, ly2] = project(lLat2, lLng2, vp);
    const zLabel = `${zone.radius} km`;

    // City name label (with optional overrides for color / font / position)
    const lblOvr = overrides?.extraZoneLabels?.[zone.id];
    const nameLat = lblOvr?.lat ?? zone.lat;
    const nameLng = lblOvr?.lng ?? zone.lng;
    const [nx, ny] = project(nameLat, nameLng, vp);
    const nameColor = escapeXml(lblOvr?.color ?? style.mainTextColor);
    const nameFont = escapeXml(lblOvr?.fontFamily ?? ff);
    const nameFontSize = t(lblOvr?.fontSize ?? 14);
    const zName = escapeXml((lblOvr?.text ?? zone.cityName).toUpperCase());
    const nameOutlineAttr = (style.labelOutlineWidth ?? 0) > 0
      ? `stroke="${escapeXml(style.labelOutlineColor)}" stroke-width="${(style.labelOutlineWidth * ts).toFixed(1)}" paint-order="stroke fill"`
      : '';

    return `<path d="${zonePath2}" fill="${zFillColor}" fill-opacity="${zFillOpacity}" stroke="${zBorderColor}" stroke-width="1.5" stroke-dasharray="${zBorderDash}"/>
  <rect x="${(lx2 - badgeW / 2).toFixed(2)}" y="${(ly2 - badgeH / 2).toFixed(2)}" width="${badgeW}" height="${badgeH}" rx="${badgeRx}" fill="${style.circleColor}" fill-opacity="0.85"/>
  <text x="${lx2.toFixed(2)}" y="${(ly2 + badgeH * 0.2).toFixed(2)}" text-anchor="middle" font-family="${ff}" font-size="${badgeFontSize}" fill="#fff" font-weight="700">${escapeXml(zLabel)}</text>
  <text x="${nx.toFixed(2)}" y="${(ny + nameFontSize * 0.35).toFixed(2)}" text-anchor="middle" font-family="${nameFont}" font-size="${nameFontSize}" fill="${nameColor}" font-weight="800" letter-spacing="${(1.5 * ts).toFixed(1)}" ${nameOutlineAttr}>${zName}</text>`;
  }).join('\n  ');

  // ── Dept labels ──────────────────────────────────────────────────────
  const showAny = style.showDeptNumber || style.showDeptName;
  const deptLabels = showAny
    ? visibleFeatures
        .filter((f) => {
          const code = f.properties.code;
          if (code !== config.departmentCode && !neighborCodes.has(code)) return false;
          if ((config.hiddenLabelCodes ?? []).includes(code)) return false;
          return true;
        })
        .map((f) => {
          const code = f.properties.code;
          const name = f.properties.nom ?? code;
          const deptOvr = overrides?.depts[code];
          const [defaultLat, defaultLng] = computeCentroid(f);
          const clat = deptOvr?.labelLat ?? defaultLat;
          const clng = deptOvr?.labelLng ?? defaultLng;
          const [cx, cy] = project(clat, clng, vp);
          const sz = t(deptOvr?.labelSize ?? style.deptLabelSize);
          const labelColor = deptOvr?.labelColor ?? style.deptLabelColor;
          const labelFont = escapeXml(deptOvr?.labelFont ?? style.fontFamily);
          const weight = style.deptLabelWeight ?? 800;
          const filled = style.deptLabelFilled !== false;
          const fillAttr = filled ? `fill="${escapeXml(labelColor)}"` : `fill="none" stroke="${escapeXml(labelColor)}" stroke-width="1.5" paint-order="stroke fill"`;

          if (style.showDeptNumber && style.showDeptName) {
            const nameSz = Math.round(sz * 0.42);
            return `<text x="${cx.toFixed(2)}" y="${(cy).toFixed(2)}" text-anchor="middle" font-family="${labelFont}" font-size="${sz}" ${fillAttr} font-weight="${weight}" opacity="0.85">${escapeXml(code)}</text>
<text x="${cx.toFixed(2)}" y="${(cy + sz * 0.6).toFixed(2)}" text-anchor="middle" font-family="${labelFont}" font-size="${nameSz}" ${fillAttr} font-weight="600" opacity="0.8">${escapeXml(name)}</text>`;
          }
          if (style.showDeptName) {
            const nameSz = Math.round(sz * 0.48);
            return `<text x="${cx.toFixed(2)}" y="${(cy + nameSz * 0.35).toFixed(2)}" text-anchor="middle" font-family="${labelFont}" font-size="${nameSz}" ${fillAttr} font-weight="${weight}" opacity="0.85">${escapeXml(name)}</text>`;
          }
          return `<text x="${cx.toFixed(2)}" y="${(cy + sz * 0.35).toFixed(2)}" text-anchor="middle" font-family="${labelFont}" font-size="${sz}" ${fillAttr} font-weight="${weight}" opacity="0.85">${escapeXml(code)}</text>`;
        })
        .join('\n    ')
    : '';

  // ── Secondary markers ─────────────────────────────────────────────────
  const secondaryMarkers = secondaryCities.map((c) => {
    const ovr = overrides?.secondaryCityLabels?.[c.id];
    const labelLat = ovr?.lat ?? c.lat;
    const labelLng = ovr?.lng ?? c.lng;
    const [cx, cy] = project(c.lat, c.lng, vp);
    const [lx2, ly2] = project(labelLat, labelLng, vp);
    const labelText = escapeXml(ovr?.text ?? c.name);
    const labelColor = escapeXml(ovr?.color ?? (c.type === 'main' ? style.mainTextColor : style.secondaryTextColor));
    const labelFont = escapeXml(ovr?.fontFamily ?? style.fontFamily);
    if (c.type === 'main') {
      const fontSize = t(ovr?.fontSize ?? 13);
      const mSvg = markerSVGElements(style.markerType ?? 'dot', cx, cy, style.markerColor, Math.round(style.markerSize * 0.8), style.markerSvg);
      return `${mSvg}
    <text x="${lx2.toFixed(2)}" y="${(ly2 - (style.markerSize ?? 12) - t(6)).toFixed(2)}" text-anchor="middle" font-family="${labelFont}" font-size="${fontSize}" fill="${labelColor}" font-weight="800" letter-spacing="${(1 * ts).toFixed(1)}">${labelText.toUpperCase()}</text>`;
    }
    const fontSize = t(ovr?.fontSize ?? 11);
    return `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="5" fill="${style.secondaryMarkerColor}" stroke="#fff" stroke-width="1.5"/>
    <text x="${lx2.toFixed(2)}" y="${(ly2 - t(9)).toFixed(2)}" text-anchor="middle" font-family="${labelFont}" font-size="${fontSize}" fill="${labelColor}" font-weight="500">${labelText}</text>`;
  }).join('\n    ');

  // ── City label ────────────────────────────────────────────────────────
  const cityOvr = overrides?.cityLabel;
  const cityLabelLat = cityOvr?.lat ?? lat;
  const cityLabelLng = cityOvr?.lng ?? lng;
  const cityColor = escapeXml(cityOvr?.color ?? style.mainTextColor);
  const cityFont = escapeXml(cityOvr?.fontFamily ?? style.fontFamily);
  const scaledCityFontSize = t(cityOvr?.fontSize ?? 22);
  const cityStrokeAttr = (style.labelOutlineWidth ?? 0) > 0
    ? `stroke="${escapeXml(style.labelOutlineColor)}" stroke-width="${(style.labelOutlineWidth * ts).toFixed(1)}" paint-order="stroke fill"`
    : '';

  const [mx, my] = project(lat, lng, vp);
  const [clx, cly] = project(cityLabelLat, cityLabelLng, vp);

  // Radius label position — relative to ZI center
  const labelLat = ziLat + (radius / 111) * 1.08 * Math.cos(labelAngleRad);
  const labelLng = ziLng + (radius / (111 * Math.cos((ziLat * Math.PI) / 180))) * 1.08 * Math.sin(labelAngleRad);
  const [lx, ly] = project(labelLat, labelLng, vp);

  // Font embed
  const fontEmbed = getFontSVGEmbed(style.fontFamily);

  // Main marker SVG
  const mainMarkerSVG = markerSVGElements(style.markerType ?? 'dot', mx, my, style.markerColor, style.markerSize ?? 12, style.markerSvg);

  // Outline clip path — union of all dept geometries
  const deptOutlineClipPaths = outline
    ? deptFeaturesToRender.map((f) => geometryToPath(f.geometry, vp)).filter(Boolean).join('\n      ')
    : '';

  // In outline mode, dept strokes are rendered OUTSIDE the clip so their full width
  // is preserved (clip would halve the outer-edge strokes, making inner borders look doubled).
  const mapContent = `
  <rect width="${size}" height="${size}" fill="${style.backgroundColor}"/>

  <g>${deptFills}</g>
  ${outline ? '' : `<g>${deptStrokes}</g>`}

  <g>
    <path d="${circlePath}" fill="${style.circleColor}" fill-opacity="${style.circleOpacity}" stroke="${style.circleBorderColor}" stroke-width="2" stroke-dasharray="${zoneDash}"/>
    ${extraZonesSvg}
  </g>

  <g>
    ${deptLabels}
  </g>

  ${secondaryMarkers}

  ${mainMarkerSVG}

  <rect x="${(lx - badgeW / 2).toFixed(2)}" y="${(ly - badgeH / 2).toFixed(2)}" width="${badgeW}" height="${badgeH}" rx="${badgeRx}" fill="${style.circleColor}" fill-opacity="0.85"/>
  <text x="${lx.toFixed(2)}" y="${(ly + badgeH * 0.2).toFixed(2)}" text-anchor="middle" font-family="${ff}" font-size="${badgeFontSize}" fill="#fff" font-weight="700">${escapeXml(circleLabel)}</text>

  <text x="${clx.toFixed(2)}" y="${(cly + scaledCityFontSize + t(22)).toFixed(2)}" text-anchor="middle" font-family="${cityFont}" font-size="${scaledCityFontSize}" fill="${cityColor}" font-weight="800" letter-spacing="${(2 * ts).toFixed(1)}" ${cityStrokeAttr}>${escapeXml((cityOvr?.text ?? cityName).toUpperCase())}</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    ${fontEmbed ? `<style>${fontEmbed}</style>` : ''}
    ${outline ? `<clipPath id="deptOutlineClip"><path d="${deptOutlineClipPaths}" clip-rule="nonzero"/></clipPath>` : ''}
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#00000030"/>
    </filter>
  </defs>
${outline ? `  <g clip-path="url(#deptOutlineClip)">${mapContent}\n  </g>\n  <g>${deptStrokes}</g>` : mapContent}
</svg>`;
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function downloadSVG(svgString: string, filename = 'carte-zone.svg'): void {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
