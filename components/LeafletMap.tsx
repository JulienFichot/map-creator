'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import type * as LeafletNS from 'leaflet';
import type { MapConfig, DepartmentsGeoJSON, MapOverrides, ElementSelection } from '@/lib/types';
import { computeNeighborCodes, buildEffectiveNeighborCodes } from '@/lib/mapRenderer';
import { loadGoogleFont, getFontByStack } from '@/lib/fonts';
import { buildDivIconData } from '@/lib/markers';

type L = typeof LeafletNS;

export interface LeafletMapHandle {
  getContainer: () => HTMLDivElement | null;
}

interface LeafletMapProps {
  config: MapConfig | null;
  geojson: DepartmentsGeoJSON | null;
  overrides?: MapOverrides;
  onNeighborCodesChange?: (codes: Set<string>) => void;
  onElementSelect?: (sel: ElementSelection | null) => void;
  onDeptLabelMove?: (code: string, lat: number, lng: number) => void;
  onCityLabelMove?: (lat: number, lng: number) => void;
  onZiCenterMove?: (lat: number, lng: number) => void;
  onExtraZoneCenterMove?: (id: string, lat: number, lng: number) => void;
  onExtraZoneLabelMove?: (id: string, lat: number, lng: number) => void;
  onSecondaryCityLabelMove?: (id: string, lat: number, lng: number) => void;
  onSecondaryCityLabelUpdate?: (id: string, patch: Partial<import('@/lib/types').LabelOverride>) => void;
  deptToggleMode?: boolean;
  onDeptToggleVisibility?: (code: string) => void;
}

interface TrackedLayers {
  deptLayer: import('leaflet').GeoJSON | null;
  deptBorderLayer: import('leaflet').GeoJSON | null;
  deptLabelMarkers: Map<string, import('leaflet').Marker>;
  cityLblMarker: import('leaflet').Marker | null;
  circleLayer: import('leaflet').Circle | null;
  ziCenterMarker: import('leaflet').Marker | null;
  neighborCodes: Set<string>;
  allNeighborCodes: Set<string>;
  extraZoneLabelMarkers: Map<string, import('leaflet').Marker>;
  secondaryCityLabelMarkers: Map<string, import('leaflet').Marker>;
}

const DASH_MAP: Record<string, string> = { solid: '', dashed: '8 5', dotted: '2 5' };

function computeCentroidFromGeom(geom: GeoJSON.Geometry): [number, number] {
  let sumLat = 0, sumLng = 0, count = 0;
  function collect(coords: unknown): void {
    if (Array.isArray(coords) && typeof coords[0] === 'number') {
      sumLng += coords[0] as number; sumLat += coords[1] as number; count++;
    } else if (Array.isArray(coords)) { (coords as unknown[]).forEach(collect); }
  }
  collect(geom.type === 'Polygon' ? geom.coordinates : geom.type === 'MultiPolygon' ? geom.coordinates : []);
  return count > 0 ? [sumLat / count, sumLng / count] : [0, 0];
}

function deptLabelHtml(code: string, name: string, style: { showDeptNumber: boolean; showDeptName: boolean; deptLabelSize: number; deptLabelColor: string; deptLabelWeight: number; deptLabelFilled: boolean; fontFamily: string }, overrideSize?: number, overrideColor?: string, overrideFont?: string): { html: string; w: number; h: number } {
  const sz = overrideSize ?? style.deptLabelSize;
  const color = overrideColor ?? style.deptLabelColor;
  const font = overrideFont ?? style.fontFamily;
  const weight = style.deptLabelWeight ?? 800;
  const filled = style.deptLabelFilled !== false;
  const textStyle = filled
    ? `color:${color};`
    : `-webkit-text-stroke:1.5px ${color};color:transparent;`;

  const nameSz = Math.round(sz * 0.42);
  let html = '';
  if (style.showDeptNumber && style.showDeptName) {
    const w = Math.max(sz * code.length * 0.65 + 8, nameSz * name.length * 0.55 + 8);
    html = `<div style="font-family:${font};text-align:center;line-height:1;cursor:pointer;width:${w}px;"><div style="font-size:${sz}px;font-weight:${weight};${textStyle}">${escapeHtml(code)}</div><div style="font-size:${nameSz}px;font-weight:600;${textStyle}">${escapeHtml(name)}</div></div>`;
    return { html, w, h: sz + nameSz + 4 };
  }
  if (style.showDeptName) {
    const w = nameSz * name.length * 0.6 + 12;
    html = `<div style="font-family:${font};font-size:${nameSz}px;font-weight:${weight};${textStyle}white-space:nowrap;text-align:center;width:${w}px;line-height:1;cursor:pointer;">${escapeHtml(name)}</div>`;
    return { html, w, h: nameSz };
  }
  const w = sz * code.length * 0.65 + 8;
  html = `<div style="font-family:${font};font-size:${sz}px;font-weight:${weight};${textStyle}white-space:nowrap;text-align:center;width:${w}px;line-height:1;cursor:pointer;">${escapeHtml(code)}</div>`;
  return { html, w, h: sz };
}

export const LeafletMap = forwardRef<LeafletMapHandle, LeafletMapProps>(
  ({ config, geojson, overrides, onNeighborCodesChange, onElementSelect, onDeptLabelMove, onCityLabelMove, onZiCenterMove, onExtraZoneCenterMove, onExtraZoneLabelMove, onSecondaryCityLabelMove, deptToggleMode, onDeptToggleVisibility }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<import('leaflet').Map | null>(null);
    const layersRef = useRef<import('leaflet').Layer[]>([]);
    const LRef = useRef<L | null>(null);
    const tracked = useRef<TrackedLayers>({
      deptLayer: null,
      deptBorderLayer: null,
      deptLabelMarkers: new Map(),
      cityLblMarker: null,
      circleLayer: null,
      ziCenterMarker: null,
      neighborCodes: new Set(),
      allNeighborCodes: new Set(),
      extraZoneLabelMarkers: new Map(),
      secondaryCityLabelMarkers: new Map(),
    });
    const prevConfigRef = useRef<MapConfig | null>(null);
    const prevGeojsonRef = useRef<DepartmentsGeoJSON | null>(null);
    // Stable refs so Leaflet click handlers always call the latest callbacks
    const onDeptToggleVisibilityRef = useRef(onDeptToggleVisibility);
    const deptToggleModeRef = useRef(deptToggleMode);
    useEffect(() => { onDeptToggleVisibilityRef.current = onDeptToggleVisibility; }, [onDeptToggleVisibility]);
    useEffect(() => { deptToggleModeRef.current = deptToggleMode; }, [deptToggleMode]);

    useImperativeHandle(ref, () => ({ getContainer: () => containerRef.current }));

    const clearLayers = useCallback(() => {
      const map = mapRef.current;
      if (!map) return;
      layersRef.current.forEach((l) => { try { map.removeLayer(l); } catch {} });
      layersRef.current = [];
      tracked.current.deptLayer = null;
      tracked.current.deptBorderLayer = null;
      tracked.current.deptLabelMarkers.clear();
      tracked.current.cityLblMarker = null;
      tracked.current.circleLayer = null;
      tracked.current.ziCenterMarker = null;
      tracked.current.extraZoneLabelMarkers.clear();
      tracked.current.secondaryCityLabelMarkers.clear();
    }, []);

    const softUpdate = useCallback(() => {
      const L = LRef.current;
      if (!L || !config || !mapRef.current) return;
      const { style, lat, lng, cityName, departmentCode } = config;

      tracked.current.deptLayer?.setStyle((feature) => {
        const code = feature?.properties?.code as string;
        const isMain = code === departmentCode;
        const isNeighbor = tracked.current.neighborCodes.has(code);
        const isHiddenNeighbor = tracked.current.allNeighborCodes.has(code) && !isNeighbor && !isMain;
        if (!isMain && !isNeighbor) {
          if (isHiddenNeighbor && deptToggleMode) {
            return { fillColor: style.neighborDepartmentColor, fillOpacity: 0.12, weight: 0 };
          }
          return { fillOpacity: 0, weight: 0 };
        }
        const deptOvr = overrides?.depts[code];
        return {
          fillColor: deptOvr?.fillColor ?? (isMain ? style.mainDepartmentColor : style.neighborDepartmentColor),
          fillOpacity: isMain ? (style.mainDepartmentOpacity ?? 1) : (style.neighborDepartmentOpacity ?? 0.8),
          weight: 0,
        };
      });
      tracked.current.deptBorderLayer?.setStyle((feature) => {
        const code = feature?.properties?.code as string;
        const isMain = code === departmentCode;
        const isNeighbor = tracked.current.neighborCodes.has(code);
        const isHiddenNeighbor = tracked.current.allNeighborCodes.has(code) && !isNeighbor && !isMain;
        if (!isMain && !isNeighbor) {
          if (isHiddenNeighbor && deptToggleMode) {
            return { fill: false, color: style.borderColor, opacity: 0.35, weight: style.borderWidth, dashArray: '5 4' };
          }
          return { fill: false, weight: 0, opacity: 0 };
        }
        const deptOvr = overrides?.depts[code];
        return {
          fill: false,
          color: deptOvr?.borderColor ?? style.borderColor,
          opacity: style.borderOpacity,
          weight: style.borderWidth,
          dashArray: DASH_MAP[style.borderDash ?? 'solid'] || undefined,
        };
      });

      tracked.current.deptLabelMarkers.forEach((marker, code) => {
        const deptOvr = overrides?.depts[code];
        const feat = geojson?.features.find((f) => f.properties.code === code);
        const name = feat?.properties.nom ?? code;
        const { html, w, h } = deptLabelHtml(code, name, style, deptOvr?.labelSize, deptOvr?.labelColor, deptOvr?.labelFont);
        marker.setIcon(L.divIcon({ className: 'lbl-no-bg', html, iconSize: [w, h], iconAnchor: [w / 2, h / 2] }));
        if (deptOvr?.labelLat !== undefined && deptOvr?.labelLng !== undefined) {
          marker.setLatLng([deptOvr.labelLat, deptOvr.labelLng]);
        }
      });

      // Update circle style
      const newCircleDash = DASH_MAP[style.circleDash ?? 'dashed'] ?? '8 5';
      (tracked.current.circleLayer as any)?.setStyle?.({
        fillColor: style.circleColor,
        fillOpacity: style.circleOpacity,
        color: style.circleBorderColor,
        weight: 2,
        dashArray: newCircleDash || undefined,
      });

      if (tracked.current.cityLblMarker) {
        const cityOvr = overrides?.cityLabel;
        const cityColor = cityOvr?.color ?? style.mainTextColor;
        const cityFont = cityOvr?.fontFamily ?? style.fontFamily;
        const cityFontSize = cityOvr?.fontSize ?? 16;
        const mainText = (cityOvr?.text ?? cityName).toUpperCase();
        const mainW = mainText.length * Math.max(cityFontSize * 0.7, 10) + 24;
        const outlineSoft = style.labelOutlineWidth > 0
          ? `-webkit-text-stroke:${style.labelOutlineWidth}px ${style.labelOutlineColor};paint-order:stroke fill;`
          : '';
        tracked.current.cityLblMarker.setIcon(L.divIcon({
          className: 'lbl-no-bg',
          html: `<div style="font-family:${cityFont};font-size:${cityFontSize}px;font-weight:800;letter-spacing:2px;color:${cityColor};white-space:nowrap;text-align:center;${outlineSoft}width:${mainW}px;">${escapeHtml(mainText)}</div>`,
          iconSize: [mainW, cityFontSize + 8],
          iconAnchor: [mainW / 2, -20],
        }));
        if (cityOvr?.lat !== undefined && cityOvr?.lng !== undefined) {
          tracked.current.cityLblMarker.setLatLng([cityOvr.lat, cityOvr.lng]);
        } else {
          tracked.current.cityLblMarker.setLatLng([lat, lng]);
        }
      }

      // Update extra zone label markers when overrides change
      tracked.current.extraZoneLabelMarkers.forEach((marker, id) => {
        const zone = config.extraZones?.find((z) => z.id === id);
        if (!zone) return;
        const lblOvr = overrides?.extraZoneLabels?.[id];
        const zLabelColor = lblOvr?.color ?? style.mainTextColor;
        const zLabelFont = lblOvr?.fontFamily ?? style.fontFamily;
        const zLabelFontSize = lblOvr?.fontSize ?? 14;
        const zName = (lblOvr?.text ?? zone.cityName).toUpperCase();
        const zNameW = zName.length * Math.max(zLabelFontSize * 0.65, 9) + 16;
        const outlineZ = style.labelOutlineWidth > 0
          ? `-webkit-text-stroke:${style.labelOutlineWidth}px ${style.labelOutlineColor};paint-order:stroke fill;`
          : 'text-shadow:0 1px 4px #fff,0 -1px 4px #fff,1px 0 4px #fff,-1px 0 4px #fff;';
        marker.setIcon(L.divIcon({
          className: 'lbl-no-bg',
          html: `<div style="font-family:${zLabelFont};font-size:${zLabelFontSize}px;font-weight:800;letter-spacing:1.5px;color:${zLabelColor};white-space:nowrap;text-align:center;${outlineZ}width:${zNameW}px;cursor:pointer;">${escapeHtml(zName)}</div>`,
          iconSize: [zNameW, zLabelFontSize + 8],
          iconAnchor: [zNameW / 2, -8],
        }));
        if (lblOvr?.lat !== undefined && lblOvr?.lng !== undefined) {
          marker.setLatLng([lblOvr.lat, lblOvr.lng]);
        }
      });
      // Update secondary city label markers
      tracked.current.secondaryCityLabelMarkers.forEach((marker, id) => {
        const city = config.secondaryCities?.find((c) => c.id === id);
        if (!city) return;
        const ovr = overrides?.secondaryCityLabels?.[id];
        const isMain = city.type === 'main';
        const labelText = (ovr?.text ?? city.name);
        const displayText = isMain ? labelText.toUpperCase() : labelText;
        const fontSize = ovr?.fontSize ?? (isMain ? 13 : 11);
        const color = ovr?.color ?? (isMain ? style.mainTextColor : style.secondaryTextColor);
        const font = ovr?.fontFamily ?? style.fontFamily;
        const w = displayText.length * Math.max(fontSize * 0.7, 8) + 20;
        marker.setIcon(L.divIcon({
          className: 'lbl-no-bg',
          html: `<div style="font-family:${font};font-size:${fontSize}px;font-weight:${isMain ? 800 : 600};letter-spacing:${isMain ? '1px' : '0'};color:${color};white-space:nowrap;text-align:center;text-shadow:0 1px 4px #fff,0 -1px 4px #fff,1px 0 4px #fff,-1px 0 4px #fff;width:${w}px;cursor:pointer;">${escapeHtml(displayText)}</div>`,
          iconSize: [w, fontSize + 8],
          iconAnchor: [w / 2, isMain ? -10 : 26],
        }));
        if (ovr?.lat !== undefined && ovr?.lng !== undefined) {
          marker.setLatLng([ovr.lat, ovr.lng]);
        } else {
          marker.setLatLng([city.lat, city.lng]);
        }
      });
    }, [config, overrides, geojson, deptToggleMode]);

    const renderFullMap = useCallback(async () => {
      if (!containerRef.current || !config || !geojson) return;

      const L = (await import('leaflet')) as unknown as L;
      LRef.current = L;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, {
          zoomControl: false,
          attributionControl: false,
          dragging: true,
        });
      }
      if (!mapRef.current) return;
      const map = mapRef.current;
      clearLayers();

      const { lat, lng, radius, style, cityName, secondaryCities, departmentCode } = config;

      const fontDef = getFontByStack(style.fontFamily);
      if ('preview' in fontDef) loadGoogleFont(fontDef);

      map.setView([lat, lng], 10);
      map.invalidateSize();

      const neighborCodes = buildEffectiveNeighborCodes(config, geojson);
      tracked.current.neighborCodes = neighborCodes;
      // All potential neighbors (ignoring hiddenDeptCodes) — needed for toggle mode display
      const allNeighborCodes = buildEffectiveNeighborCodes({ ...config, hiddenDeptCodes: [] }, geojson);
      tracked.current.allNeighborCodes = allNeighborCodes;
      if (onNeighborCodesChange) onNeighborCodesChange(neighborCodes);

      containerRef.current.style.setProperty('background', style.backgroundColor, 'important');

      map.off('click');
      map.on('click', () => onElementSelect?.(null));

      const borderDash = DASH_MAP[style.borderDash ?? 'solid'] || undefined;

      // ── Dept layer ────────────────────────────────────────────────────
      const deptLayer = L.geoJSON(geojson as GeoJSON.FeatureCollection, {
        style: (feature: any) => {
          const code = feature?.properties?.code as string;
          const isMain = code === departmentCode;
          const isNeighbor = neighborCodes.has(code);
          const isHiddenNeighbor = allNeighborCodes.has(code) && !isNeighbor && !isMain;
          if (!isMain && !isNeighbor) {
            if (isHiddenNeighbor && deptToggleModeRef.current) {
              return { fillColor: style.neighborDepartmentColor, fillOpacity: 0.12, weight: 0 };
            }
            return { fillOpacity: 0, weight: 0 };
          }
          const deptOvr = overrides?.depts[code];
          return {
            fillColor: deptOvr?.fillColor ?? (isMain ? style.mainDepartmentColor : style.neighborDepartmentColor),
            fillOpacity: isMain ? (style.mainDepartmentOpacity ?? 1) : (style.neighborDepartmentOpacity ?? 0.8),
            weight: 0,
          };
        },
        onEachFeature: (feature: any, layer: any) => {
          const code = feature.properties?.code as string;
          const isMain = code === departmentCode;
          const isNeighbor = neighborCodes.has(code);
          const isHiddenNeighbor = allNeighborCodes.has(code) && !isNeighbor && !isMain;
          if (!isMain && !isNeighbor && !isHiddenNeighbor) return;
          layer.on('click', (e: import('leaflet').LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(e);
            if (deptToggleModeRef.current && !isMain) {
              onDeptToggleVisibilityRef.current?.(code);
              return;
            }
            if (!isMain && !isNeighbor) return;
            const deptOvr = overrides?.depts[code];
            onElementSelect?.({
              type: 'dept', id: code, label: `Département ${code}`,
              screenX: e.containerPoint.x, screenY: e.containerPoint.y,
              defaultFill: deptOvr?.fillColor ?? (isMain ? style.mainDepartmentColor : style.neighborDepartmentColor),
            });
          });
        },
      });
      tracked.current.deptLayer = deptLayer;
      deptLayer.addTo(map);
      layersRef.current.push(deptLayer);

      const deptBorderLayer = L.geoJSON(geojson as GeoJSON.FeatureCollection, {
        interactive: false,
        style: (feature: any) => {
          const code = feature?.properties?.code as string;
          const isMain = code === departmentCode;
          const isNeighbor = neighborCodes.has(code);
          const isHiddenNeighbor = allNeighborCodes.has(code) && !isNeighbor && !isMain;
          if (!isMain && !isNeighbor) {
            if (isHiddenNeighbor && deptToggleModeRef.current) {
              return { fill: false, color: style.borderColor, opacity: 0.35, weight: style.borderWidth, dashArray: '5 4' };
            }
            return { fill: false, weight: 0, opacity: 0 };
          }
          const deptOvr = overrides?.depts[code];
          return {
            fill: false,
            color: deptOvr?.borderColor ?? style.borderColor,
            opacity: style.borderOpacity,
            weight: style.borderWidth,
            lineJoin: style.borderLineJoin,
            dashArray: borderDash,
          };
        },
      });
      tracked.current.deptBorderLayer = deptBorderLayer;
      deptBorderLayer.addTo(map);
      layersRef.current.push(deptBorderLayer);

      // ── Circle (L.circle = native, supports setLatLng for ZI drag) ───────
      const ziLat = config.ziCenterLat ?? lat;
      const ziLng = config.ziCenterLng ?? lng;
      const circleDashArray = DASH_MAP[style.circleDash ?? 'dashed'] ?? '8 5';
      const circleLayer = L.circle([ziLat, ziLng], {
        radius: radius * 1000,
        fillColor: style.circleColor,
        fillOpacity: style.circleOpacity,
        color: style.circleBorderColor,
        weight: 2,
        dashArray: circleDashArray || undefined,
        interactive: true,
      });
      tracked.current.circleLayer = circleLayer;
      circleLayer.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        onElementSelect?.({ type: 'zi', id: 'zi', label: `ZI · ${radius} km`, screenX: e.containerPoint.x, screenY: e.containerPoint.y });
      });
      circleLayer.addTo(map);
      layersRef.current.push(circleLayer);

      // ── ZI center crosshair (draggable) ───────────────────────────────
      const ziCenterMarker = L.marker([ziLat, ziLng], {
        icon: L.divIcon({
          className: 'lbl-no-bg',
          html: `<div style="width:24px;height:24px;cursor:move;opacity:0.8" title="Déplacer la zone d'intervention">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="4.5" stroke="${escapeHtml(style.circleBorderColor)}" stroke-width="1.5"/>
              <line x1="12" y1="1" x2="12" y2="7" stroke="${escapeHtml(style.circleBorderColor)}" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="12" y1="17" x2="12" y2="23" stroke="${escapeHtml(style.circleBorderColor)}" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="1" y1="12" x2="7" y2="12" stroke="${escapeHtml(style.circleBorderColor)}" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="17" y1="12" x2="23" y2="12" stroke="${escapeHtml(style.circleBorderColor)}" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
        draggable: true,
        interactive: true,
        zIndexOffset: 600,
      });
      tracked.current.ziCenterMarker = ziCenterMarker;
      ziCenterMarker.on('drag', () => {
        const pos = ziCenterMarker.getLatLng();
        (tracked.current.circleLayer as any)?.setLatLng?.([pos.lat, pos.lng]);
      });
      ziCenterMarker.on('dragend', () => {
        const pos = ziCenterMarker.getLatLng();
        onZiCenterMove?.(pos.lat, pos.lng);
      });
      ziCenterMarker.addTo(map);
      layersRef.current.push(ziCenterMarker);

      // ── Extra zones ───────────────────────────────────────────────────
      (config.extraZones ?? []).forEach((zone) => {
        const zs = zone.zoneStyle;
        const zFillColor = zs?.fillColor ?? style.circleColor;
        const zFillOpacity = zs?.fillOpacity ?? Math.max(0, style.circleOpacity * 0.7);
        const zBorderColor = zs?.borderColor ?? style.circleBorderColor;
        const zDashArray = DASH_MAP[zs?.borderDash ?? style.circleDash ?? 'dashed'] ?? '8 5';

        const zCircle = L.circle([zone.lat, zone.lng], {
          radius: zone.radius * 1000,
          fillColor: zFillColor,
          fillOpacity: zFillOpacity,
          color: zBorderColor,
          weight: 1.5,
          dashArray: zDashArray || undefined,
          interactive: true,
        });
        zCircle.on('click', (e: import('leaflet').LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          onElementSelect?.({ type: 'extraZone', id: zone.id, label: zone.cityName, screenX: e.containerPoint.x, screenY: e.containerPoint.y });
        });
        zCircle.addTo(map);
        layersRef.current.push(zCircle);

        // Radius badge for extra zone
        const zBadgeLat = zone.lat + (zone.radius / 111) * 0.72;
        const zBadgeLng = zone.lng + (zone.radius / (111 * Math.cos((zone.lat * Math.PI) / 180))) * 0.72;
        const zRadiusText = `${zone.radius} km`;
        const zRW = zRadiusText.length * 9 + 16;
        const zRadiusBadge = L.marker([zBadgeLat, zBadgeLng], {
          icon: L.divIcon({ className: 'lbl-no-bg', html: `<div style="font-family:${style.fontFamily};font-size:11px;font-weight:700;color:#fff;background:${style.circleColor};padding:2px 8px;border-radius:4px;white-space:nowrap;text-align:center;width:${zRW}px;opacity:0.85;">${zRadiusText}</div>`, iconSize: [zRW, 18], iconAnchor: [zRW / 2, 9] }),
          interactive: false, zIndexOffset: 700,
        });
        zRadiusBadge.addTo(map);
        layersRef.current.push(zRadiusBadge);

        // City name label for extra zone — draggable and clickable like ZI 1 city label
        const lblOvrInit = overrides?.extraZoneLabels?.[zone.id];
        const zLabelLat = lblOvrInit?.lat ?? zone.lat;
        const zLabelLng = lblOvrInit?.lng ?? zone.lng;
        const zLabelColor = lblOvrInit?.color ?? style.mainTextColor;
        const zLabelFont = lblOvrInit?.fontFamily ?? style.fontFamily;
        const zLabelFontSize = lblOvrInit?.fontSize ?? 14;
        const zName = (lblOvrInit?.text ?? zone.cityName).toUpperCase();
        const zNameW = zName.length * Math.max(zLabelFontSize * 0.65, 9) + 16;
        const outlineStyleZ = style.labelOutlineWidth > 0
          ? `-webkit-text-stroke:${style.labelOutlineWidth}px ${style.labelOutlineColor};paint-order:stroke fill;`
          : 'text-shadow:0 1px 4px #fff,0 -1px 4px #fff,1px 0 4px #fff,-1px 0 4px #fff;';
        const zNameLabel = L.marker([zLabelLat, zLabelLng], {
          icon: L.divIcon({
            className: 'lbl-no-bg',
            html: `<div style="font-family:${zLabelFont};font-size:${zLabelFontSize}px;font-weight:800;letter-spacing:1.5px;color:${zLabelColor};white-space:nowrap;text-align:center;${outlineStyleZ}width:${zNameW}px;cursor:pointer;">${escapeHtml(zName)}</div>`,
            iconSize: [zNameW, zLabelFontSize + 8],
            iconAnchor: [zNameW / 2, -8],
          }),
          draggable: true,
          interactive: true,
          zIndexOffset: 750,
        });
        zNameLabel.on('click', (e: import('leaflet').LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          onElementSelect?.({ type: 'extraZone', id: zone.id, label: zone.cityName, screenX: e.containerPoint.x, screenY: e.containerPoint.y });
        });
        zNameLabel.on('dragend', () => {
          const pos = zNameLabel.getLatLng();
          onExtraZoneLabelMove?.(zone.id, pos.lat, pos.lng);
        });
        tracked.current.extraZoneLabelMarkers.set(zone.id, zNameLabel);
        zNameLabel.addTo(map);
        layersRef.current.push(zNameLabel);

        // Draggable ZI center marker for extra zone
        const zMarker = L.marker([zone.lat, zone.lng], {
          icon: L.divIcon({
            className: 'lbl-no-bg',
            html: `<div style="width:20px;height:20px;cursor:move;opacity:0.75" title="Déplacer cette zone">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="3.5" stroke="${escapeHtml(style.circleBorderColor)}" stroke-width="1.5"/>
                <line x1="10" y1="1" x2="10" y2="6" stroke="${escapeHtml(style.circleBorderColor)}" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="10" y1="14" x2="10" y2="19" stroke="${escapeHtml(style.circleBorderColor)}" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="1" y1="10" x2="6" y2="10" stroke="${escapeHtml(style.circleBorderColor)}" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="14" y1="10" x2="19" y2="10" stroke="${escapeHtml(style.circleBorderColor)}" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
          draggable: true,
          interactive: true,
          zIndexOffset: 600,
        });
        zMarker.on('drag', () => {
          const pos = zMarker.getLatLng();
          (zCircle as any).setLatLng([pos.lat, pos.lng]);
        });
        zMarker.on('dragend', () => {
          const pos = zMarker.getLatLng();
          onExtraZoneCenterMove?.(zone.id, pos.lat, pos.lng);
        });
        zMarker.addTo(map);
        layersRef.current.push(zMarker);
      });


      // ── Secondary cities ──────────────────────────────────────────────
      secondaryCities.forEach((city) => {
        const isMain = city.type === 'main';
        const ovrInit = overrides?.secondaryCityLabels?.[city.id];
        const labelLat = ovrInit?.lat ?? city.lat;
        const labelLng = ovrInit?.lng ?? city.lng;
        const labelText = ovrInit?.text ?? city.name;
        const displayText = isMain ? labelText.toUpperCase() : labelText;
        const fontSize = ovrInit?.fontSize ?? (isMain ? 13 : 11);
        const color = ovrInit?.color ?? (isMain ? style.mainTextColor : style.secondaryTextColor);
        const font = ovrInit?.fontFamily ?? style.fontFamily;

        if (isMain) {
          const mData = buildDivIconData(style.markerType ?? 'dot', style.markerColor, Math.round(style.markerSize * 0.8), style.markerSvg);
          const mkr = L.marker([city.lat, city.lng], {
            icon: L.divIcon({ className: 'lbl-no-bg', html: mData.html, iconSize: mData.iconSize, iconAnchor: mData.iconAnchor }),
            interactive: false, zIndexOffset: 850,
          });
          mkr.addTo(map); layersRef.current.push(mkr);
        } else {
          const dot = L.circleMarker([city.lat, city.lng], { radius: 6, fillColor: style.secondaryMarkerColor, color: '#fff', weight: 1.5, fillOpacity: 1 });
          (dot as any).options.interactive = false;
          dot.addTo(map); layersRef.current.push(dot);
        }

        const w = displayText.length * Math.max(fontSize * 0.7, 8) + 20;
        const lbl = L.marker([labelLat, labelLng], {
          icon: L.divIcon({
            className: 'lbl-no-bg',
            html: `<div style="font-family:${font};font-size:${fontSize}px;font-weight:${isMain ? 800 : 600};letter-spacing:${isMain ? '1px' : '0'};color:${color};white-space:nowrap;text-align:center;text-shadow:0 1px 4px #fff,0 -1px 4px #fff,1px 0 4px #fff,-1px 0 4px #fff;width:${w}px;cursor:pointer;">${escapeHtml(displayText)}</div>`,
            iconSize: [w, fontSize + 8],
            iconAnchor: [w / 2, isMain ? -10 : 26],
          }),
          draggable: true, interactive: true, zIndexOffset: isMain ? 851 : 600,
        });
        lbl.on('dragend', () => {
          const pos = lbl.getLatLng();
          onSecondaryCityLabelMove?.(city.id, pos.lat, pos.lng);
        });
        lbl.on('click', (e: import('leaflet').LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          onElementSelect?.({ type: 'secondaryCity', id: city.id, label: city.name, screenX: e.containerPoint.x, screenY: e.containerPoint.y, defaultFill: color });
        });
        tracked.current.secondaryCityLabelMarkers.set(city.id, lbl);
        lbl.addTo(map); layersRef.current.push(lbl);
      });

      // ── Main marker ───────────────────────────────────────────────────
      const mData = buildDivIconData(style.markerType ?? 'dot', style.markerColor, style.markerSize ?? 12, style.markerSvg);
      const mainMarker = L.marker([lat, lng], {
        icon: L.divIcon({ className: 'lbl-no-bg', html: mData.html, iconSize: mData.iconSize, iconAnchor: mData.iconAnchor }),
        interactive: true, zIndexOffset: 900,
      });
      mainMarker.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        onElementSelect?.({ type: 'marker', id: 'marker', label: `Marqueur · ${cityName}`, screenX: e.containerPoint.x, screenY: e.containerPoint.y });
      });
      mainMarker.addTo(map);
      layersRef.current.push(mainMarker);

      // ── City label (draggable) ─────────────────────────────────────────
      const cityOvr = overrides?.cityLabel;
      const cityLabelLat = cityOvr?.lat ?? lat;
      const cityLabelLng = cityOvr?.lng ?? lng;
      const cityColor = cityOvr?.color ?? style.mainTextColor;
      const cityFont = cityOvr?.fontFamily ?? style.fontFamily;
      const cityFontSize = cityOvr?.fontSize ?? 16;
      const mainText = cityName.toUpperCase();
      const mainW = mainText.length * Math.max(cityFontSize * 0.7, 10) + 24;
      const outlineStyle = style.labelOutlineWidth > 0
        ? `-webkit-text-stroke:${style.labelOutlineWidth}px ${style.labelOutlineColor};paint-order:stroke fill;`
        : '';

      const cityLblMarker = L.marker([cityLabelLat, cityLabelLng], {
        icon: L.divIcon({ className: 'lbl-no-bg', html: `<div style="font-family:${cityFont};font-size:${cityFontSize}px;font-weight:800;letter-spacing:2px;color:${cityColor};white-space:nowrap;text-align:center;${outlineStyle}width:${mainW}px;">${escapeHtml(mainText)}</div>`, iconSize: [mainW, cityFontSize + 8], iconAnchor: [mainW / 2, -20] }),
        draggable: true, interactive: true, zIndexOffset: 800,
      });
      cityLblMarker.on('dragend', () => { const pos = cityLblMarker.getLatLng(); onCityLabelMove?.(pos.lat, pos.lng); });
      cityLblMarker.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        onElementSelect?.({ type: 'cityLabel', id: 'cityLabel', label: `"${cityName}"`, screenX: e.containerPoint.x, screenY: e.containerPoint.y, defaultFill: cityColor });
      });
      tracked.current.cityLblMarker = cityLblMarker;
      cityLblMarker.addTo(map);
      layersRef.current.push(cityLblMarker);

      // ── Radius badge ──────────────────────────────────────────────────
      const labelLat = lat + (radius / 111) * 0.72;
      const labelLng = lng + (radius / (111 * Math.cos((lat * Math.PI) / 180))) * 0.72;
      const radiusText = `${radius} km`;
      const rW = radiusText.length * 9 + 16;
      const radiusLblMarker = L.marker([labelLat, labelLng], {
        icon: L.divIcon({ className: 'lbl-no-bg', html: `<div style="font-family:${style.fontFamily};font-size:12px;font-weight:700;color:#fff;background:${style.circleColor};padding:2px 8px;border-radius:4px;white-space:nowrap;text-align:center;width:${rW}px;">${radiusText}</div>`, iconSize: [rW, 20], iconAnchor: [rW / 2, 10] }),
        interactive: false, zIndexOffset: 700,
      });
      radiusLblMarker.addTo(map);
      layersRef.current.push(radiusLblMarker);

      // ── Dept labels (draggable) ────────────────────────────────────────
      const showAny = style.showDeptNumber || style.showDeptName;
      if (showAny) {
        tracked.current.deptLabelMarkers.clear();
        geojson.features.forEach((feat) => {
          const code = feat.properties.code;
          const name = feat.properties.nom ?? code;
          const isMain = code === departmentCode;
          const isNeighbor = neighborCodes.has(code);
          if (!isMain && !isNeighbor) return;
          if ((config.hiddenLabelCodes ?? []).includes(code)) return;

          const [defaultLat, defaultLng] = computeCentroidFromGeom(feat.geometry);
          if (defaultLat === 0 && defaultLng === 0) return;

          const deptOvr = overrides?.depts[code];
          const clat = deptOvr?.labelLat ?? defaultLat;
          const clng = deptOvr?.labelLng ?? defaultLng;

          const { html, w, h } = deptLabelHtml(code, name, style, deptOvr?.labelSize, deptOvr?.labelColor, deptOvr?.labelFont);

          const deptNumMarker = L.marker([clat, clng], {
            icon: L.divIcon({ className: 'lbl-no-bg', html, iconSize: [w, h], iconAnchor: [w / 2, h / 2] }),
            draggable: true, interactive: true, zIndexOffset: 100,
          });
          deptNumMarker.on('dragend', () => { const pos = deptNumMarker.getLatLng(); onDeptLabelMove?.(code, pos.lat, pos.lng); });
          deptNumMarker.on('click', (e: import('leaflet').LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(e);
            const deptOvr2 = overrides?.depts[code];
            onElementSelect?.({ type: 'dept', id: code, label: `Département ${code}`, screenX: e.containerPoint.x, screenY: e.containerPoint.y, defaultFill: deptOvr2?.fillColor ?? (isMain ? style.mainDepartmentColor : style.neighborDepartmentColor) });
          });
          tracked.current.deptLabelMarkers.set(code, deptNumMarker);
          deptNumMarker.addTo(map);
          layersRef.current.push(deptNumMarker);
        });
      }

      // Compute bounding box covering main zone + all extra zones
      let minLat = lat - radius / 111;
      let maxLat = lat + radius / 111;
      let minLng = lng - radius / (111 * Math.cos((lat * Math.PI) / 180));
      let maxLng = lng + radius / (111 * Math.cos((lat * Math.PI) / 180));
      for (const zone of config.extraZones ?? []) {
        const dLat = zone.radius / 111;
        const dLng = zone.radius / (111 * Math.cos((zone.lat * Math.PI) / 180));
        minLat = Math.min(minLat, zone.lat - dLat);
        maxLat = Math.max(maxLat, zone.lat + dLat);
        minLng = Math.min(minLng, zone.lng - dLng);
        maxLng = Math.max(maxLng, zone.lng + dLng);
      }
      const padLat = (maxLat - minLat) * 0.15;
      const padLng = (maxLng - minLng) * 0.15;
      map.fitBounds(L.latLngBounds([minLat - padLat, minLng - padLng], [maxLat + padLat, maxLng + padLng]));
    }, [config, geojson, clearLayers, onNeighborCodesChange, onElementSelect, onDeptLabelMove, onCityLabelMove, onZiCenterMove, onExtraZoneCenterMove, onExtraZoneLabelMove, overrides]);

    useEffect(() => {
      if (config !== prevConfigRef.current || geojson !== prevGeojsonRef.current || !mapRef.current) {
        prevConfigRef.current = config;
        prevGeojsonRef.current = geojson;
        renderFullMap();
      } else {
        softUpdate();
      }
    }, [config, geojson, overrides, renderFullMap, softUpdate]);

    useEffect(() => {
      return () => {
        clearLayers();
        if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      };
    }, [clearLayers]);

    return (
      <div ref={containerRef} className="w-full h-full rounded-xl" style={{ minHeight: '500px', background: '#f5f5f0' }} />
    );
  }
);

LeafletMap.displayName = 'LeafletMap';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
