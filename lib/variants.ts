import type { MapStyle } from './types';

export interface VariantPreset {
  id: string;
  label: string;
  description: string;
  radiusMultiplier: number;
  styleOverrides: Partial<MapStyle>;
}

export const VARIANT_PRESETS: VariantPreset[] = [
  {
    id: 'local',
    label: 'Impact Local',
    description: 'Zone serrée · Visuel fort',
    radiusMultiplier: 0.5,
    styleOverrides: {
      borderWidth: 2.5,
      borderDash: 'solid',
      mainDepartmentOpacity: 0.9,
      neighborDepartmentOpacity: 0.7,
      deptLabelSize: 42,
      circleOpacity: 0.25,
      markerSize: 14,
      showDeptNumber: true,
      showDeptName: false,
    },
  },
  {
    id: 'standard',
    label: 'Standard',
    description: 'Équilibré · Rayon actuel',
    radiusMultiplier: 1.0,
    styleOverrides: {},
  },
  {
    id: 'regional',
    label: 'Zone Régionale',
    description: 'Large couverture · Style léger',
    radiusMultiplier: 2.0,
    styleOverrides: {
      borderWidth: 1,
      borderDash: 'solid',
      deptLabelSize: 20,
      circleOpacity: 0.08,
      mainDepartmentOpacity: 0.65,
      neighborDepartmentOpacity: 0.45,
    },
  },
  {
    id: 'territory',
    label: 'Territoire',
    description: 'Très large · Pointillés · Épuré',
    radiusMultiplier: 3.5,
    styleOverrides: {
      showDeptNumber: false,
      showDeptName: false,
      circleDash: 'dotted',
      borderDash: 'dashed',
      borderWidth: 0.8,
      circleOpacity: 0.06,
      mainDepartmentOpacity: 0.5,
      neighborDepartmentOpacity: 0.3,
    },
  },
];

export function applyVariantPreset(currentStyle: MapStyle, preset: VariantPreset): MapStyle {
  return { ...currentStyle, ...preset.styleOverrides };
}
