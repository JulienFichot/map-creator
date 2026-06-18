import { describe, it, expect } from 'vitest';
import { buildDivIconData, markerSVGElements, MARKER_PRESETS } from '../markers';
import type { MarkerType } from '../types';

const COLOR = '#e63946';
const SIZE = 12;

// ── MARKER_PRESETS ────────────────────────────────────────────────────────────

describe('MARKER_PRESETS', () => {
  const TYPES: MarkerType[] = ['dot', 'pin', 'ring', 'custom'];

  it('has an entry for each MarkerType', () => {
    const ids = MARKER_PRESETS.map((p) => p.id);
    for (const t of TYPES) expect(ids).toContain(t);
  });

  it('each preset has a non-empty svgPreview', () => {
    for (const p of MARKER_PRESETS) expect(p.svgPreview.startsWith('<svg')).toBe(true);
  });
});

// ── buildDivIconData ──────────────────────────────────────────────────────────

describe('buildDivIconData', () => {
  it('returns object with html, iconSize, iconAnchor', () => {
    const { html, iconSize, iconAnchor } = buildDivIconData('dot', COLOR, SIZE);
    expect(typeof html).toBe('string');
    expect(iconSize).toHaveLength(2);
    expect(iconAnchor).toHaveLength(2);
  });

  describe('dot', () => {
    it('html contains circle elements', () => {
      const { html } = buildDivIconData('dot', COLOR, SIZE);
      expect(html).toContain('<circle');
    });

    it('iconSize is square', () => {
      const { iconSize } = buildDivIconData('dot', COLOR, SIZE);
      expect(iconSize[0]).toBe(iconSize[1]);
    });

    it('iconAnchor is at center of iconSize', () => {
      const { iconSize, iconAnchor } = buildDivIconData('dot', COLOR, SIZE);
      expect(iconAnchor[0]).toBe(iconSize[0] / 2);
      expect(iconAnchor[1]).toBe(iconSize[1] / 2);
    });

    it('includes the color', () => {
      const { html } = buildDivIconData('dot', COLOR, SIZE);
      expect(html).toContain(COLOR);
    });
  });

  describe('pin', () => {
    it('html contains a path element', () => {
      const { html } = buildDivIconData('pin', COLOR, SIZE);
      expect(html).toContain('<path');
    });

    it('iconAnchor y is near the tip (bottom)', () => {
      const { iconSize, iconAnchor } = buildDivIconData('pin', COLOR, SIZE);
      // tip should be near the bottom of the bounding box
      expect(iconAnchor[1]).toBeGreaterThan(iconSize[1] * 0.6);
    });

    it('height is greater than width (taller than wide)', () => {
      const { iconSize } = buildDivIconData('pin', COLOR, SIZE);
      expect(iconSize[1]).toBeGreaterThan(iconSize[0]);
    });
  });

  describe('ring', () => {
    it('html contains two circle elements (ring + dot)', () => {
      const { html } = buildDivIconData('ring', COLOR, SIZE);
      const matches = html.match(/<circle/g) ?? [];
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it('iconSize is square', () => {
      const { iconSize } = buildDivIconData('ring', COLOR, SIZE);
      expect(iconSize[0]).toBe(iconSize[1]);
    });
  });

  describe('custom without svg', () => {
    it('falls back to dot behaviour', () => {
      const dot = buildDivIconData('dot', COLOR, SIZE);
      const custom = buildDivIconData('custom', COLOR, SIZE, undefined);
      expect(custom.iconSize).toEqual(dot.iconSize);
    });
  });

  describe('custom with svg', () => {
    const SVG = '<svg viewBox="0 0 24 24"><rect x="0" y="0" width="24" height="24"/></svg>';

    it('wraps provided svg markup in the html', () => {
      const { html } = buildDivIconData('custom', COLOR, SIZE, SVG);
      expect(html).toContain('<rect');
    });

    it('returns valid iconSize', () => {
      const { iconSize } = buildDivIconData('custom', COLOR, SIZE, SVG);
      expect(iconSize[0]).toBeGreaterThan(0);
      expect(iconSize[1]).toBeGreaterThan(0);
    });
  });

  it('larger SIZE produces larger iconSize for dot', () => {
    const small = buildDivIconData('dot', COLOR, 8);
    const large = buildDivIconData('dot', COLOR, 20);
    expect(large.iconSize[0]).toBeGreaterThan(small.iconSize[0]);
  });
});

// ── markerSVGElements ─────────────────────────────────────────────────────────

describe('markerSVGElements', () => {
  it('returns a non-empty string', () => {
    expect(markerSVGElements('dot', 100, 200, COLOR, SIZE).length).toBeGreaterThan(0);
  });

  it('dot includes circle elements', () => {
    const svg = markerSVGElements('dot', 100, 200, COLOR, SIZE);
    expect(svg).toContain('<circle');
  });

  it('dot embeds color', () => {
    const svg = markerSVGElements('dot', 100, 200, COLOR, SIZE);
    expect(svg).toContain(COLOR);
  });

  it('pin includes path element', () => {
    const svg = markerSVGElements('pin', 100, 200, COLOR, SIZE);
    expect(svg).toContain('<path');
  });

  it('ring includes circle elements', () => {
    const svg = markerSVGElements('ring', 100, 200, COLOR, SIZE);
    expect(svg).toContain('<circle');
  });

  it('custom without svg falls back to dot output', () => {
    const customResult = markerSVGElements('custom', 100, 200, COLOR, SIZE, undefined);
    expect(customResult).toContain('<circle');
  });

  it('custom with svg produces image element with encoded href', () => {
    const customSvg = '<svg><rect/></svg>';
    const result = markerSVGElements('custom', 100, 200, COLOR, SIZE, customSvg);
    expect(result).toContain('<image');
    expect(result).toContain('data:image/svg+xml,');
  });

  it('cx and cy coordinates appear in the output', () => {
    const result = markerSVGElements('dot', 123, 456, COLOR, SIZE);
    expect(result).toContain('123.0');
    expect(result).toContain('456.0');
  });
});
