import type { MarkerType } from './types';

export interface DivIconData {
  html: string;
  iconSize: [number, number];
  iconAnchor: [number, number];
}

export const MARKER_PRESETS: Array<{ id: MarkerType; label: string; svgPreview: string }> = [
  {
    id: 'dot',
    label: 'Cercle',
    svgPreview: `<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="10" fill="currentColor" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="white"/></svg>`,
  },
  {
    id: 'pin',
    label: 'Épingle',
    svgPreview: `<svg viewBox="0 0 20 30" width="16" height="24"><path d="M10,28 Q2,18 2,10 A8,8 0 0,1 18,10 Q18,18 10,28 Z" fill="currentColor" stroke="white" stroke-width="1.5"/><circle cx="10" cy="10" r="3" fill="white" opacity=".85"/></svg>`,
  },
  {
    id: 'ring',
    label: 'Anneau',
    svgPreview: `<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>`,
  },
  {
    id: 'custom',
    label: 'SVG',
    svgPreview: `<svg viewBox="0 0 24 24" width="22" height="22"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 2"/><text x="12" y="15.5" text-anchor="middle" font-size="8" font-weight="700" fill="currentColor">SVG</text></svg>`,
  },
];

// ── Div icon for Leaflet markers ─────────────────────────────────────────────

export function buildDivIconData(type: MarkerType, color: string, size: number, customSvg?: string): DivIconData {
  switch (type) {
    case 'pin': return pinDivIcon(color, size);
    case 'ring': return ringDivIcon(color, size);
    case 'custom': return customDivIcon(color, size, customSvg);
    default: return dotDivIcon(color, size);
  }
}

// ── SVG elements for static SVG export ──────────────────────────────────────

export function markerSVGElements(
  type: MarkerType,
  cx: number,
  cy: number,
  color: string,
  size: number,
  customSvg?: string
): string {
  switch (type) {
    case 'pin': return pinSVGElements(cx, cy, color, size);
    case 'ring': return ringSVGElements(cx, cy, color, size);
    case 'custom': return customSVGElements(cx, cy, color, size, customSvg);
    default: return dotSVGElements(cx, cy, color, size);
  }
}

// ─── Dot ────────────────────────────────────────────────────────────────────

function dotDivIcon(color: string, size: number): DivIconData {
  const d = size * 2 + 6;
  const c = d / 2;
  const inner = Math.max(2, Math.round(size * 0.35));
  return {
    html: `<svg width="${d}" height="${d}" overflow="visible" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,.3))"><circle cx="${c}" cy="${c}" r="${size}" fill="${color}" stroke="white" stroke-width="2.5"/><circle cx="${c}" cy="${c}" r="${inner}" fill="white"/></svg>`,
    iconSize: [d, d],
    iconAnchor: [c, c],
  };
}

function dotSVGElements(cx: number, cy: number, color: string, size: number): string {
  const inner = Math.max(2, Math.round(size * 0.35));
  const x = cx.toFixed(1), y = cy.toFixed(1);
  return `<circle cx="${x}" cy="${y}" r="${size}" fill="${color}" stroke="white" stroke-width="2.5" filter="url(#shadow)"/>
<circle cx="${x}" cy="${y}" r="${inner}" fill="white"/>`;
}

// ─── Pin ────────────────────────────────────────────────────────────────────

function pinDivIcon(color: string, size: number): DivIconData {
  const r = size;
  const totalW = Math.ceil(r * 2.4);
  const cx = totalW / 2;
  const headCy = r + 1;
  const tipY = Math.ceil(r * 3.5 + 1);
  const totalH = tipY + 3;
  const lx = cx - r, rx = cx + r;
  const midY = (headCy + tipY) / 2;
  const inner = Math.max(1.5, r * 0.38);

  const d = `M${f(cx)},${tipY} Q${f(lx)},${f(midY)} ${f(lx)},${headCy} A${r},${r} 0 0,1 ${f(rx)},${headCy} Q${f(rx)},${f(midY)} ${f(cx)},${tipY} Z`;
  return {
    html: `<svg width="${totalW}" height="${totalH}" overflow="visible" style="filter:drop-shadow(0 3px 7px rgba(0,0,0,.35))"><path d="${d}" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round"/><circle cx="${f(cx)}" cy="${headCy}" r="${f(inner)}" fill="white" opacity=".85"/></svg>`,
    iconSize: [totalW, totalH],
    iconAnchor: [Math.round(cx), Math.round(tipY)],
  };
}

function pinSVGElements(cx: number, cy: number, color: string, size: number): string {
  const r = size;
  const headCy = cy - r * 2.5;
  const lx = cx - r, rx = cx + r;
  const midY = (headCy + cy) / 2;
  const inner = Math.max(1.5, r * 0.38);

  const d = `M${f(cx)},${f(cy)} Q${f(lx)},${f(midY)} ${f(lx)},${f(headCy)} A${r},${r} 0 0,1 ${f(rx)},${f(headCy)} Q${f(rx)},${f(midY)} ${f(cx)},${f(cy)} Z`;
  return `<path d="${d}" fill="${color}" stroke="white" stroke-width="1.5" stroke-linejoin="round" filter="url(#shadow)"/>
<circle cx="${f(cx)}" cy="${f(headCy)}" r="${f(inner)}" fill="white" opacity=".85"/>`;
}

// ─── Ring ───────────────────────────────────────────────────────────────────

function ringDivIcon(color: string, size: number): DivIconData {
  const sw = Math.max(3, Math.round(size * 0.45));
  const d = (size + sw) * 2;
  const c = d / 2;
  const dotR = Math.max(2, Math.round(sw * 0.55));
  return {
    html: `<svg width="${d}" height="${d}" overflow="visible" style="filter:drop-shadow(0 2px 5px rgba(0,0,0,.3))"><circle cx="${c}" cy="${c}" r="${size}" fill="none" stroke="${color}" stroke-width="${sw}"/><circle cx="${c}" cy="${c}" r="${dotR}" fill="${color}"/></svg>`,
    iconSize: [d, d],
    iconAnchor: [c, c],
  };
}

function ringSVGElements(cx: number, cy: number, color: string, size: number): string {
  const sw = Math.max(3, Math.round(size * 0.45));
  const dotR = Math.max(2, Math.round(sw * 0.55));
  const x = f(cx), y = f(cy);
  return `<circle cx="${x}" cy="${y}" r="${size}" fill="none" stroke="${color}" stroke-width="${sw}" filter="url(#shadow)"/>
<circle cx="${x}" cy="${y}" r="${dotR}" fill="${color}"/>`;
}

// ─── Custom SVG ─────────────────────────────────────────────────────────────

function customDivIcon(color: string, size: number, customSvg?: string): DivIconData {
  if (!customSvg) return dotDivIcon(color, size);
  const d = size * 2 + 8;
  const c = d / 2;
  const inner = customSvg.trim();
  const html = inner.startsWith('<svg')
    ? inner.replace(/<svg[^>]*>/, `<svg width="${d}" height="${d}" overflow="visible">`)
    : `<svg width="${d}" height="${d}" overflow="visible">${inner}</svg>`;
  return {
    html: `<div style="filter:drop-shadow(0 2px 5px rgba(0,0,0,.3))">${html}</div>`,
    iconSize: [d, d],
    iconAnchor: [c, c],
  };
}

function customSVGElements(cx: number, cy: number, color: string, size: number, customSvg?: string): string {
  if (!customSvg) return dotSVGElements(cx, cy, color, size);
  const d = size * 2;
  return `<image x="${f(cx - size)}" y="${f(cy - size)}" width="${d}" height="${d}" href="data:image/svg+xml,${encodeURIComponent(customSvg)}" filter="url(#shadow)"/>`;
}

function f(n: number): string {
  return n.toFixed(1);
}
