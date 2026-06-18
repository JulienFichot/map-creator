import { describe, it, expect } from 'vitest';
import { VARIANT_PRESETS, applyVariantPreset } from '../variants';
import type { MapStyle } from '../types';

const BASE_STYLE: MapStyle = {
  backgroundColor: '#ffffff',
  mainDepartmentColor: '#eeeeee',
  mainDepartmentOpacity: 1,
  neighborDepartmentColor: '#dddddd',
  neighborDepartmentOpacity: 0.8,
  borderColor: '#000000',
  borderWidth: 1.5,
  borderOpacity: 1,
  borderLineJoin: 'round',
  borderDash: 'solid',
  circleColor: '#ff0000',
  circleOpacity: 0.15,
  circleBorderColor: '#ff0000',
  circleDash: 'dashed',
  markerColor: '#ff0000',
  markerSize: 12,
  markerType: 'dot',
  secondaryMarkerColor: '#999999',
  mainTextColor: '#333333',
  secondaryTextColor: '#666666',
  fontFamily: 'Arial',
  labelOutlineWidth: 0,
  labelOutlineColor: '#ffffff',
  showDeptNumber: true,
  showDeptName: false,
  deptLabelSize: 28,
  deptLabelColor: '#cccccc',
  deptLabelWeight: 800,
  deptLabelFilled: true,
};

describe('VARIANT_PRESETS', () => {
  it('has exactly 4 presets', () => {
    expect(VARIANT_PRESETS).toHaveLength(4);
  });

  it('has unique ids', () => {
    const ids = VARIANT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(4);
  });

  it('has unique radiusMultipliers', () => {
    const mults = VARIANT_PRESETS.map((p) => p.radiusMultiplier);
    expect(new Set(mults).size).toBe(4);
  });

  it('local preset has radiusMultiplier < 1', () => {
    const local = VARIANT_PRESETS.find((p) => p.id === 'local')!;
    expect(local.radiusMultiplier).toBeLessThan(1);
  });

  it('standard preset has radiusMultiplier === 1', () => {
    const std = VARIANT_PRESETS.find((p) => p.id === 'standard')!;
    expect(std.radiusMultiplier).toBe(1.0);
  });

  it('regional preset has radiusMultiplier > 1', () => {
    const reg = VARIANT_PRESETS.find((p) => p.id === 'regional')!;
    expect(reg.radiusMultiplier).toBeGreaterThan(1);
  });

  it('territory preset has the largest radiusMultiplier', () => {
    const maxMult = Math.max(...VARIANT_PRESETS.map((p) => p.radiusMultiplier));
    const territory = VARIANT_PRESETS.find((p) => p.id === 'territory')!;
    expect(territory.radiusMultiplier).toBe(maxMult);
  });

  it('standard preset has empty styleOverrides', () => {
    const std = VARIANT_PRESETS.find((p) => p.id === 'standard')!;
    expect(std.styleOverrides).toEqual({});
  });

  it('each preset has a non-empty label and description', () => {
    for (const p of VARIANT_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
    }
  });
});

describe('applyVariantPreset', () => {
  it('returns a new object (does not mutate input)', () => {
    const preset = VARIANT_PRESETS.find((p) => p.id === 'local')!;
    const result = applyVariantPreset(BASE_STYLE, preset);
    expect(result).not.toBe(BASE_STYLE);
  });

  it('standard preset returns style identical to base', () => {
    const std = VARIANT_PRESETS.find((p) => p.id === 'standard')!;
    expect(applyVariantPreset(BASE_STYLE, std)).toEqual(BASE_STYLE);
  });

  it('local preset overrides borderWidth', () => {
    const local = VARIANT_PRESETS.find((p) => p.id === 'local')!;
    const result = applyVariantPreset(BASE_STYLE, local);
    expect(result.borderWidth).toBe(2.5);
  });

  it('local preset overrides deptLabelSize', () => {
    const local = VARIANT_PRESETS.find((p) => p.id === 'local')!;
    const result = applyVariantPreset(BASE_STYLE, local);
    expect(result.deptLabelSize).toBe(42);
  });

  it('regional preset reduces deptLabelSize vs base', () => {
    const reg = VARIANT_PRESETS.find((p) => p.id === 'regional')!;
    const result = applyVariantPreset(BASE_STYLE, reg);
    expect(result.deptLabelSize).toBeLessThan(BASE_STYLE.deptLabelSize);
  });

  it('territory preset hides dept number and name', () => {
    const territory = VARIANT_PRESETS.find((p) => p.id === 'territory')!;
    const result = applyVariantPreset(BASE_STYLE, territory);
    expect(result.showDeptNumber).toBe(false);
    expect(result.showDeptName).toBe(false);
  });

  it('territory preset sets circleDash to dotted', () => {
    const territory = VARIANT_PRESETS.find((p) => p.id === 'territory')!;
    const result = applyVariantPreset(BASE_STYLE, territory);
    expect(result.circleDash).toBe('dotted');
  });

  it('preserves base fields not overridden by preset', () => {
    const local = VARIANT_PRESETS.find((p) => p.id === 'local')!;
    const result = applyVariantPreset(BASE_STYLE, local);
    expect(result.backgroundColor).toBe(BASE_STYLE.backgroundColor);
    expect(result.markerColor).toBe(BASE_STYLE.markerColor);
    expect(result.fontFamily).toBe(BASE_STYLE.fontFamily);
  });
});
