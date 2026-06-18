export type BorderLineJoin = 'round' | 'miter' | 'bevel';
export type CircleDash = 'solid' | 'dashed' | 'dotted';
export type MarkerType = 'dot' | 'pin' | 'ring' | 'custom';

export interface MapStyle {
  backgroundColor: string;

  // Departments
  mainDepartmentColor: string;
  mainDepartmentOpacity: number;
  neighborDepartmentColor: string;
  neighborDepartmentOpacity: number;

  // Borders
  borderColor: string;
  borderWidth: number;
  borderOpacity: number;
  borderLineJoin: BorderLineJoin;
  borderDash: CircleDash;

  // Zone circle
  circleColor: string;
  circleOpacity: number;
  circleBorderColor: string;
  circleDash: CircleDash;

  // Markers
  markerColor: string;
  markerSize: number;
  markerType: MarkerType;
  markerSvg?: string;
  secondaryMarkerColor: string;

  // Text
  mainTextColor: string;
  secondaryTextColor: string;
  fontFamily: string;
  labelOutlineWidth: number;
  labelOutlineColor: string;

  // Dept labels
  showDeptNumber: boolean;
  showDeptName: boolean;
  deptLabelSize: number;
  deptLabelColor: string;
  deptLabelWeight: number;
  deptLabelFilled: boolean;
}

export interface SecondaryCity {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type?: 'secondary' | 'main';
}

export interface ExtraZoneStyle {
  fillColor?: string;
  fillOpacity?: number;
  borderColor?: string;
  borderDash?: CircleDash;
}

export interface ExtraZone {
  id: string;
  cityName: string;
  lat: number;
  lng: number;
  radius: number;
  zoneStyle?: ExtraZoneStyle;
}

export interface MapConfig {
  cityName: string;
  lat: number;
  lng: number;
  radius: number;
  departmentCode: string;
  departmentName: string;
  region: string;
  style: MapStyle;
  secondaryCities: SecondaryCity[];
  extraDeptCodes?: string[];
  hiddenDeptCodes?: string[];
  hiddenLabelCodes?: string[];
  extraZones?: ExtraZone[];
  ziCenterLat?: number;
  ziCenterLng?: number;
}

export interface GeocodedCity {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  departmentCode: string;
  departmentName: string;
  region: string;
}

export interface Commune {
  name: string;
  postalCode: string;
  lat: number;
  lng: number;
  distance: number;
  inseeCode?: string;
}

export type TemplateId = 'seo' | 'blue' | 'orange' | 'minimal' | 'artisan';

export interface Template {
  id: TemplateId;
  label: string;
  description: string;
  style: MapStyle;
}

export interface BatchItem {
  city: string;
  radius: number;
}

export interface BatchResult {
  city: string;
  radius: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
  svgUrl?: string;
  pngUrl?: string;
}

export type ExportSize = '1200' | '2000' | '3000';

export interface DeptOverride {
  fillColor?: string;
  borderColor?: string;
  labelColor?: string;
  labelSize?: number;
  labelFont?: string;
  labelLat?: number;
  labelLng?: number;
}

export interface LabelOverride {
  text?: string;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  lat?: number;
  lng?: number;
}

export interface MapOverrides {
  depts: Record<string, DeptOverride>;
  cityLabel: LabelOverride;
  extraZoneLabels?: Record<string, LabelOverride>;
  secondaryCityLabels?: Record<string, LabelOverride>;
}

export function emptyOverrides(): MapOverrides {
  return { depts: {}, cityLabel: {}, extraZoneLabels: {}, secondaryCityLabels: {} };
}

export type ElementSelectionType = 'dept' | 'cityLabel' | 'zi' | 'marker' | 'extraZone' | 'secondaryCity';

export interface ElementSelection {
  type: 'dept' | 'cityLabel' | 'zi' | 'marker' | 'extraZone' | 'secondaryCity';
  id: string;
  label: string;
  screenX: number;
  screenY: number;
  defaultFill?: string;
}

export interface DepartmentFeature {
  type: 'Feature';
  properties: {
    code: string;
    nom: string;
  };
  geometry: GeoJSON.Geometry;
}

export interface DepartmentsGeoJSON {
  type: 'FeatureCollection';
  features: DepartmentFeature[];
}
