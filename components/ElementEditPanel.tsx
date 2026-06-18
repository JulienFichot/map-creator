'use client';

import { ColorPicker } from './ColorPicker';
import { FONTS } from '@/lib/fonts';
import { MARKER_PRESETS } from '@/lib/markers';
import type { ElementSelection, MapOverrides, MapStyle, CircleDash, MarkerType, ExtraZone, ExtraZoneStyle, LabelOverride } from '@/lib/types';

interface Props {
  selection: ElementSelection;
  overrides: MapOverrides;
  style: MapStyle;
  containerRect: { width: number; height: number };
  extraZones?: ExtraZone[];
  onUpdate: (patch: Partial<MapOverrides>) => void;
  onStyleUpdate?: (patch: Partial<MapStyle>) => void;
  onExtraZoneStyleUpdate?: (id: string, patch: Partial<ExtraZoneStyle>) => void;
  onExtraZoneLabelUpdate?: (id: string, patch: Partial<LabelOverride>) => void;
  onExtraZoneLabelReset?: (id: string) => void;
  onSecondaryCityLabelUpdate?: (id: string, patch: Partial<LabelOverride>) => void;
  onSecondaryCityLabelReset?: (id: string) => void;
  onClose: () => void;
}

type OverridePanel = {
  selection: ElementSelection;
  overrides: MapOverrides;
  style: MapStyle;
  panelStyle: React.CSSProperties;
  onUpdate: (patch: Partial<MapOverrides>) => void;
  onClose: () => void;
}

const PANEL_W = 268;

export function ElementEditPanel({ selection, overrides, style, containerRect, extraZones, onUpdate, onStyleUpdate, onExtraZoneStyleUpdate, onExtraZoneLabelUpdate, onExtraZoneLabelReset, onSecondaryCityLabelUpdate, onSecondaryCityLabelReset, onClose }: Props) {
  // Position panel: to the right of click, flip left if too close to right edge
  const flipX = selection.screenX + PANEL_W + 24 > containerRect.width;
  const left = flipX
    ? Math.max(4, selection.screenX - PANEL_W - 8)
    : Math.min(selection.screenX + 12, containerRect.width - PANEL_W - 4);
  const top = Math.max(4, Math.min(selection.screenY - 16, containerRect.height - 420));

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    left,
    top,
    width: PANEL_W,
    zIndex: 1002,
    maxHeight: containerRect.height - top - 8,
    overflowY: 'auto',
  };

  if (selection.type === 'dept') {
    return <DeptPanel selection={selection} overrides={overrides} style={style} panelStyle={panelStyle} onUpdate={onUpdate} onClose={onClose} />;
  }
  if (selection.type === 'cityLabel') {
    return <CityLabelPanel selection={selection} overrides={overrides} style={style} panelStyle={panelStyle} onUpdate={onUpdate} onClose={onClose} />;
  }
  if (selection.type === 'zi') {
    return <ZiPanel style={style} panelStyle={panelStyle} onStyleUpdate={onStyleUpdate ?? (() => {})} onClose={onClose} />;
  }
  if (selection.type === 'marker') {
    return <MarkerPanel style={style} panelStyle={panelStyle} onStyleUpdate={onStyleUpdate ?? (() => {})} onClose={onClose} />;
  }
  if (selection.type === 'secondaryCity') {
    return (
      <SecondaryCityPanel
        cityId={selection.id}
        cityName={selection.label}
        isMain={false}
        labelOverride={overrides.secondaryCityLabels?.[selection.id] ?? {}}
        style={style}
        panelStyle={panelStyle}
        onLabelUpdate={(patch) => onSecondaryCityLabelUpdate?.(selection.id, patch)}
        onLabelReset={() => onSecondaryCityLabelReset?.(selection.id)}
        onClose={onClose}
      />
    );
  }
  if (selection.type === 'extraZone') {
    const zone = extraZones?.find((z) => z.id === selection.id);
    return (
      <ExtraZonePanel
        zoneId={selection.id}
        zoneName={selection.label}
        zoneStyle={zone?.zoneStyle ?? {}}
        labelOverride={overrides.extraZoneLabels?.[selection.id] ?? {}}
        style={style}
        panelStyle={panelStyle}
        onUpdate={(patch) => onExtraZoneStyleUpdate?.(selection.id, patch)}
        onLabelUpdate={(patch) => onExtraZoneLabelUpdate?.(selection.id, patch)}
        onLabelReset={() => onExtraZoneLabelReset?.(selection.id)}
        onClose={onClose}
      />
    );
  }
  return null;
}

// ── Dept editor ──────────────────────────────────────────────────────────────

function DeptPanel({ selection, overrides, style, panelStyle, onUpdate, onClose }: OverridePanel) {
  const code = selection.id;
  const deptOvr = overrides.depts[code] ?? {};

  function patch(p: Partial<MapOverrides['depts'][string]>) {
    onUpdate({ depts: { ...overrides.depts, [code]: { ...deptOvr, ...p } } });
  }

  function reset() {
    const { [code]: _, ...rest } = overrides.depts;
    onUpdate({ depts: rest });
  }

  const defaultFill = selection.defaultFill ?? style.mainDepartmentColor;
  const fillValue = deptOvr.fillColor ?? defaultFill;
  const borderValue = deptOvr.borderColor ?? style.borderColor;
  const labelColorValue = deptOvr.labelColor ?? style.deptLabelColor;
  const labelSizeValue = deptOvr.labelSize ?? style.deptLabelSize;
  const labelFontValue = deptOvr.labelFont ?? style.fontFamily;
  const hasOverrides = Object.keys(deptOvr).length > 0;

  return (
    <div style={panelStyle} className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-3 select-none">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Éditer</p>
          <h3 className="text-sm font-bold text-white">Département {code}</h3>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 transition-colors">×</button>
      </div>

      <div className="flex flex-col gap-2.5">
        <section>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Couleurs</p>
          <div className="flex flex-col gap-1.5">
            <ColorPicker label="Remplissage" value={fillValue} onChange={v => patch({ fillColor: v })} />
            <ColorPicker label="Contour" value={borderValue} onChange={v => patch({ borderColor: v })} />
          </div>
        </section>

        <div className="border-t border-slate-700" />

        <section>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Numéro de département</p>
          <div className="flex flex-col gap-1.5">
            <ColorPicker label="Couleur" value={labelColorValue} onChange={v => patch({ labelColor: v })} />
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-slate-300">Taille</label>
              <div className="flex items-center gap-2">
                <input type="range" min="10" max="72" step="2" value={labelSizeValue}
                  onChange={e => patch({ labelSize: parseInt(e.target.value) })}
                  className="w-20 accent-orange-500" />
                <span className="text-xs text-slate-400 w-8 text-right">{labelSizeValue}px</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-300 block mb-1">Police</label>
              <select value={labelFontValue} onChange={e => patch({ labelFont: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-500">
                {FONTS.map(f => <option key={f.id} value={f.stack} style={{ fontFamily: f.stack }}>{f.label}</option>)}
              </select>
            </div>
          </div>
        </section>

        <p className="text-[10px] text-slate-500">Glisser le numéro pour le repositionner</p>

        {hasOverrides && (
          <button onClick={reset}
            className="w-full py-1.5 text-xs text-orange-400 border border-orange-500/30 rounded-lg hover:bg-orange-500/10 transition-colors">
            ↺ Réinitialiser ce département
          </button>
        )}
      </div>
    </div>
  );
}

// ── City label editor ────────────────────────────────────────────────────────

function CityLabelPanel({ selection, overrides, style, panelStyle, onUpdate, onClose }: OverridePanel) {
  const lbl = overrides.cityLabel;

  function patch(p: Partial<MapOverrides['cityLabel']>) {
    onUpdate({ cityLabel: { ...lbl, ...p } });
  }

  function reset() {
    onUpdate({ cityLabel: {} });
  }

  const colorValue = lbl.color ?? style.mainTextColor;
  const fontValue = lbl.fontFamily ?? style.fontFamily;
  const sizeValue = lbl.fontSize ?? 16;
  const hasOverrides = Object.keys(lbl).length > 0;

  return (
    <div style={panelStyle} className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-3 select-none">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Éditer</p>
          <h3 className="text-sm font-bold text-white">Nom de la ville</h3>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 transition-colors">×</button>
      </div>

      <div className="flex flex-col gap-2.5">
        <ColorPicker label="Couleur du texte" value={colorValue} onChange={v => patch({ color: v })} />

        <div className="flex items-center justify-between gap-2">
          <label className="text-xs text-slate-300">Taille</label>
          <div className="flex items-center gap-2">
            <input type="range" min="10" max="48" step="1" value={sizeValue}
              onChange={e => patch({ fontSize: parseInt(e.target.value) })}
              className="w-20 accent-orange-500" />
            <span className="text-xs text-slate-400 w-8 text-right">{sizeValue}px</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-300 block mb-1">Police</label>
          <select value={fontValue} onChange={e => patch({ fontFamily: e.target.value })}
            className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-500">
            {FONTS.map(f => <option key={f.id} value={f.stack} style={{ fontFamily: f.stack }}>{f.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-300 block mb-1">Texte affiché</label>
          <input type="text" value={lbl.text ?? ''}
            onChange={e => patch({ text: e.target.value || undefined })}
            placeholder={selection.label.replace(/"/g, '').trim()}
            className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-500" />
        </div>

        <p className="text-[10px] text-slate-500">Glisser le texte sur la carte pour le repositionner</p>

        {hasOverrides && (
          <button onClick={reset}
            className="w-full py-1.5 text-xs text-orange-400 border border-orange-500/30 rounded-lg hover:bg-orange-500/10 transition-colors">
            ↺ Réinitialiser le nom
          </button>
        )}
      </div>
    </div>
  );
}

// ── ZI (Zone d'Intervention) editor ─────────────────────────────────────────

function ZiPanel({ style, panelStyle, onStyleUpdate, onClose }: { style: MapStyle; panelStyle: React.CSSProperties; onStyleUpdate: (p: Partial<MapStyle>) => void; onClose: () => void }) {
  const DASH_OPTIONS: { value: CircleDash; label: string }[] = [
    { value: 'solid', label: 'Plein' },
    { value: 'dashed', label: 'Tirets' },
    { value: 'dotted', label: 'Pointillés' },
  ];

  return (
    <div style={panelStyle} className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-3 select-none">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Éditer</p>
          <h3 className="text-sm font-bold text-white">Zone d'intervention</h3>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 transition-colors">×</button>
      </div>

      <div className="flex flex-col gap-2.5">
        <section>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Remplissage</p>
          <div className="flex flex-col gap-1.5">
            <ColorPicker label="Couleur" value={style.circleColor} onChange={v => onStyleUpdate({ circleColor: v })} />
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-slate-300">Opacité</label>
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={0.6} step={0.05} value={style.circleOpacity}
                  onChange={e => onStyleUpdate({ circleOpacity: parseFloat(e.target.value) })}
                  className="w-20 accent-orange-500" />
                <span className="text-xs text-slate-400 w-8 text-right">{Math.round(style.circleOpacity * 100)}%</span>
              </div>
            </div>
          </div>
        </section>

        <div className="border-t border-slate-700" />

        <section>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Contour</p>
          <div className="flex flex-col gap-1.5">
            <ColorPicker label="Couleur" value={style.circleBorderColor} onChange={v => onStyleUpdate({ circleBorderColor: v })} />
            <div>
              <label className="text-xs text-slate-300 block mb-1">Style du trait</label>
              <div className="grid grid-cols-3 gap-1">
                {DASH_OPTIONS.map(({ value, label }) => (
                  <button key={value} type="button" onClick={() => onStyleUpdate({ circleDash: value })}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${style.circleDash === value ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ── Extra zone editor ────────────────────────────────────────────────────────

function ExtraZonePanel({ zoneId, zoneName, zoneStyle, labelOverride, style, panelStyle, onUpdate, onLabelUpdate, onLabelReset, onClose }: {
  zoneId: string;
  zoneName: string;
  zoneStyle: ExtraZoneStyle;
  labelOverride: LabelOverride;
  style: MapStyle;
  panelStyle: React.CSSProperties;
  onUpdate: (patch: Partial<ExtraZoneStyle>) => void;
  onLabelUpdate: (patch: Partial<LabelOverride>) => void;
  onLabelReset: () => void;
  onClose: () => void;
}) {
  void zoneId;
  const DASH_OPTIONS: { value: CircleDash; label: string }[] = [
    { value: 'solid', label: 'Plein' },
    { value: 'dashed', label: 'Tirets' },
    { value: 'dotted', label: 'Pointillés' },
  ];

  const fillColor = zoneStyle.fillColor ?? style.circleColor;
  const fillOpacity = zoneStyle.fillOpacity ?? Math.max(0, style.circleOpacity * 0.7);
  const borderColor = zoneStyle.borderColor ?? style.circleBorderColor;
  const borderDash = zoneStyle.borderDash ?? style.circleDash ?? 'dashed';
  const hasZoneOverrides = Object.keys(zoneStyle).length > 0;

  const labelColor = labelOverride.color ?? style.mainTextColor;
  const labelFont = labelOverride.fontFamily ?? style.fontFamily;
  const labelFontSize = labelOverride.fontSize ?? 14;
  const hasLabelOverrides = Object.keys(labelOverride).length > 0;

  return (
    <div style={panelStyle} className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-3 select-none">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Zone supplémentaire</p>
          <h3 className="text-sm font-bold text-white">{zoneName}</h3>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 transition-colors">×</button>
      </div>

      <div className="flex flex-col gap-2.5">
        <section>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Remplissage</p>
          <div className="flex flex-col gap-1.5">
            <ColorPicker label="Couleur" value={fillColor} onChange={v => onUpdate({ fillColor: v })} />
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-slate-300">Opacité</label>
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={0.6} step={0.05} value={fillOpacity}
                  onChange={e => onUpdate({ fillOpacity: parseFloat(e.target.value) })}
                  className="w-20 accent-orange-500" />
                <span className="text-xs text-slate-400 w-8 text-right">{Math.round(fillOpacity * 100)}%</span>
              </div>
            </div>
          </div>
        </section>

        <div className="border-t border-slate-700" />

        <section>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Contour</p>
          <div className="flex flex-col gap-1.5">
            <ColorPicker label="Couleur" value={borderColor} onChange={v => onUpdate({ borderColor: v })} />
            <div>
              <label className="text-xs text-slate-300 block mb-1">Style du trait</label>
              <div className="grid grid-cols-3 gap-1">
                {DASH_OPTIONS.map(({ value, label }) => (
                  <button key={value} type="button" onClick={() => onUpdate({ borderDash: value })}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${borderDash === value ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="border-t border-slate-700" />

        <section>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Nom de la zone</p>
          <div className="flex flex-col gap-1.5">
            <ColorPicker label="Couleur" value={labelColor} onChange={v => onLabelUpdate({ color: v })} />
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-slate-300">Taille</label>
              <div className="flex items-center gap-2">
                <input type="range" min="10" max="48" step="1" value={labelFontSize}
                  onChange={e => onLabelUpdate({ fontSize: parseInt(e.target.value) })}
                  className="w-20 accent-orange-500" />
                <span className="text-xs text-slate-400 w-8 text-right">{labelFontSize}px</span>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-300 block mb-1">Police</label>
              <select value={labelFont} onChange={e => onLabelUpdate({ fontFamily: e.target.value })}
                className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-500">
                {FONTS.map(f => <option key={f.id} value={f.stack} style={{ fontFamily: f.stack }}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-300 block mb-1">Texte affiché</label>
              <input type="text" value={labelOverride.text ?? ''}
                onChange={e => onLabelUpdate({ text: e.target.value || undefined })}
                placeholder={zoneName}
                className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-500" />
            </div>
            <p className="text-[10px] text-slate-500">Glisser le texte pour le repositionner</p>
            {hasLabelOverrides && (
              <button onClick={onLabelReset}
                className="w-full py-1.5 text-xs text-orange-400 border border-orange-500/30 rounded-lg hover:bg-orange-500/10 transition-colors">
                ↺ Réinitialiser le nom
              </button>
            )}
          </div>
        </section>

        {hasZoneOverrides && (
          <button onClick={() => onUpdate({ fillColor: undefined, fillOpacity: undefined, borderColor: undefined, borderDash: undefined })}
            className="w-full py-1.5 text-xs text-orange-400 border border-orange-500/30 rounded-lg hover:bg-orange-500/10 transition-colors">
            ↺ Réinitialiser cette zone
          </button>
        )}
      </div>
    </div>
  );
}

// ── Secondary city label editor ───────────────────────────────────────────────

function SecondaryCityPanel({ cityId, cityName, isMain, labelOverride, style, panelStyle, onLabelUpdate, onLabelReset, onClose }: {
  cityId: string;
  cityName: string;
  isMain: boolean;
  labelOverride: LabelOverride;
  style: MapStyle;
  panelStyle: React.CSSProperties;
  onLabelUpdate: (patch: Partial<LabelOverride>) => void;
  onLabelReset: () => void;
  onClose: () => void;
}) {
  void cityId; void isMain;
  const colorValue = labelOverride.color ?? style.secondaryTextColor;
  const fontValue = labelOverride.fontFamily ?? style.fontFamily;
  const sizeValue = labelOverride.fontSize ?? 11;
  const hasOverrides = Object.keys(labelOverride).length > 0;

  return (
    <div style={panelStyle} className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-3 select-none">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Ville ajoutée</p>
          <h3 className="text-sm font-bold text-white">{cityName}</h3>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 transition-colors">×</button>
      </div>

      <div className="flex flex-col gap-2.5">
        <ColorPicker label="Couleur du texte" value={colorValue} onChange={v => onLabelUpdate({ color: v })} />

        <div className="flex items-center justify-between gap-2">
          <label className="text-xs text-slate-300">Taille</label>
          <div className="flex items-center gap-2">
            <input type="range" min="8" max="36" step="1" value={sizeValue}
              onChange={e => onLabelUpdate({ fontSize: parseInt(e.target.value) })}
              className="w-20 accent-orange-500" />
            <span className="text-xs text-slate-400 w-8 text-right">{sizeValue}px</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-slate-300 block mb-1">Police</label>
          <select value={fontValue} onChange={e => onLabelUpdate({ fontFamily: e.target.value })}
            className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-500">
            {FONTS.map(f => <option key={f.id} value={f.stack} style={{ fontFamily: f.stack }}>{f.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-300 block mb-1">Texte affiché</label>
          <input type="text" value={labelOverride.text ?? ''}
            onChange={e => onLabelUpdate({ text: e.target.value || undefined })}
            placeholder={cityName}
            className="w-full bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-500" />
        </div>

        <p className="text-[10px] text-slate-500">Glisser le texte pour le repositionner</p>

        {hasOverrides && (
          <button onClick={onLabelReset}
            className="w-full py-1.5 text-xs text-orange-400 border border-orange-500/30 rounded-lg hover:bg-orange-500/10 transition-colors">
            ↺ Réinitialiser
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main marker editor ────────────────────────────────────────────────────────

function MarkerPanel({ style, panelStyle, onStyleUpdate, onClose }: { style: MapStyle; panelStyle: React.CSSProperties; onStyleUpdate: (p: Partial<MapStyle>) => void; onClose: () => void }) {
  return (
    <div style={panelStyle} className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-3 select-none">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Éditer</p>
          <h3 className="text-sm font-bold text-white">Marqueur principal</h3>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-slate-700 transition-colors">×</button>
      </div>

      <div className="flex flex-col gap-2.5">
        <section>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Type</p>
          <div className="grid grid-cols-4 gap-1">
            {MARKER_PRESETS.map((p) => (
              <button key={p.id} type="button" onClick={() => onStyleUpdate({ markerType: p.id as MarkerType })}
                className={`flex flex-col items-center gap-1 py-2 rounded-lg border transition-all ${style.markerType === p.id ? 'bg-orange-500/20 border-orange-500' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'}`}>
                <span
                  className={style.markerType === p.id ? 'text-orange-400' : 'text-slate-300'}
                  dangerouslySetInnerHTML={{ __html: p.svgPreview }}
                />
                <span className={`text-[9px] font-semibold ${style.markerType === p.id ? 'text-orange-300' : 'text-slate-400'}`}>{p.label}</span>
              </button>
            ))}
          </div>
        </section>

        <div className="border-t border-slate-700" />

        <section>
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Apparence</p>
          <div className="flex flex-col gap-1.5">
            <ColorPicker label="Couleur" value={style.markerColor} onChange={v => onStyleUpdate({ markerColor: v })} />
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-slate-300">Taille</label>
              <div className="flex items-center gap-2">
                <input type="range" min={4} max={28} step={1} value={style.markerSize ?? 12}
                  onChange={e => onStyleUpdate({ markerSize: parseInt(e.target.value) })}
                  className="w-20 accent-orange-500" />
                <span className="text-xs text-slate-400 w-8 text-right">{style.markerSize ?? 12}px</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
