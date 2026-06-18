'use client';

import { useRef, useState, useEffect } from 'react';
import type { MapConfig, MapStyle, TemplateId, SecondaryCity, BorderLineJoin, CircleDash, MarkerType, ExtraZone } from '@/lib/types';
import { ColorPicker } from './ColorPicker';
import { TemplateSelector } from './TemplateSelector';
import { FontPicker } from './FontPicker';
import { MARKER_PRESETS } from '@/lib/markers';
import { getTemplate } from '@/lib/templates';
import { loadLocalFont } from '@/lib/fonts';

const RADIUS_OPTIONS = [10, 20, 30, 40, 50, 75, 100];
type StyleTab = 'template' | 'carte' | 'texte' | 'marqueurs';

interface ControlPanelProps {
  onGenerate: (city: string, radius: number, style: MapStyle, secondaryCities: SecondaryCity[], extraDeptCodes: string[], hiddenDeptCodes: string[], extraZones: ExtraZone[]) => void;
  onDeptOverrideChange?: (extra: string[], hidden: string[], hiddenLabels: string[]) => void;
  onExtraZonesChange?: (zones: ExtraZone[]) => void;
  onReset?: () => void;
  config: MapConfig | null;
  loading: boolean;
  error: string | null;
  visibleDeptCodes?: string[];
}

function Slider({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  const isPct = unit === '%';
  const toDisplay = (v: number) => isPct ? String(Math.round(v * 100)) : String(v);
  const [raw, setRaw] = useState(toDisplay(value));

  useEffect(() => { setRaw(toDisplay(value)); }, [value]);

  function commit(str: string) {
    const n = parseFloat(str);
    if (isNaN(n)) { setRaw(toDisplay(value)); return; }
    const internal = isPct ? n / 100 : n;
    const clamped = Math.min(max, Math.max(min, internal));
    onChange(clamped);
    setRaw(toDisplay(clamped));
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <label className="text-xs text-slate-300 flex-shrink-0">{label}</label>
      <div className="flex items-center gap-2 flex-1 justify-end">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-20 accent-orange-500" />
        <div className="flex items-center gap-0.5">
          <input
            type="number"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commit(raw)}
            className="w-10 bg-slate-700 border border-slate-600 text-slate-200 text-xs text-right px-1 py-0.5 rounded focus:outline-none focus:border-orange-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          {unit && <span className="text-xs text-slate-500">{unit}</span>}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mt-0.5">{children}</p>;
}

export function ControlPanel({ onGenerate, onDeptOverrideChange, onExtraZonesChange, onReset, config, loading, error, visibleDeptCodes }: ControlPanelProps) {
  const [city, setCity] = useState('');
  const [radius, setRadius] = useState(30);
  const [style, setStyle] = useState<MapStyle>(getTemplate('seo').style);
  const [template, setTemplate] = useState<TemplateId>('seo');
  const [secondaryInput, setSecondaryInput] = useState('');
  const [secondaryCities, setSecondaryCities] = useState<SecondaryCity[]>([]);
  const [styleOpen, setStyleOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<StyleTab>('template');
  const [extraDeptCodes, setExtraDeptCodes] = useState<string[]>([]);
  const [hiddenDeptCodes, setHiddenDeptCodes] = useState<string[]>([]);
  const [extraInput, setExtraInput] = useState('');
  const [hiddenInput, setHiddenInput] = useState('');
  const [hiddenLabelCodes, setHiddenLabelCodes] = useState<string[]>([]);
  const [extraZones, setExtraZones] = useState<ExtraZone[]>([]);
  const [extraZoneInput, setExtraZoneInput] = useState('');
  const [extraZoneRadius, setExtraZoneRadius] = useState(30);
  const [extraZoneOpen, setExtraZoneOpen] = useState(false);
  const markerSvgRef = useRef<HTMLInputElement>(null);

  function handleTemplateChange(id: TemplateId) {
    setTemplate(id);
    setStyle(getTemplate(id).style);
  }

  function updateStyle<K extends keyof MapStyle>(key: K, value: MapStyle[K]) {
    setStyle((prev) => ({ ...prev, [key]: value }));
  }

  async function addSecondaryCity() {
    const name = secondaryInput.trim();
    if (!name) return;
    try {
      const resp = await fetch(`/api/geocode?city=${encodeURIComponent(name)}`);
      if (!resp.ok) throw new Error('Ville introuvable');
      const geo = await resp.json();
      setSecondaryCities((prev) => [...prev, { id: crypto.randomUUID(), name: geo.name, lat: geo.lat, lng: geo.lng, type: 'secondary' }]);
      setSecondaryInput('');
    } catch { alert(`Impossible de géocoder "${name}"`); }
  }

  function removeSecondaryCity(id: string) {
    setSecondaryCities((prev) => prev.filter((c) => c.id !== id));
  }

  function toggleCityType(id: string) {
    setSecondaryCities((prev) =>
      prev.map((c) => c.id === id ? { ...c, type: c.type === 'main' ? 'secondary' : 'main' } : c)
    );
  }

  function addExtraDept() {
    const code = extraInput.trim().toUpperCase();
    if (!code || extraDeptCodes.includes(code) || code === config?.departmentCode) return;
    const next = [...extraDeptCodes, code];
    setExtraDeptCodes(next);
    setExtraInput('');
    onDeptOverrideChange?.(next, hiddenDeptCodes, hiddenLabelCodes);
  }

  function removeExtraDept(code: string) {
    const next = extraDeptCodes.filter((c) => c !== code);
    setExtraDeptCodes(next);
    onDeptOverrideChange?.(next, hiddenDeptCodes, hiddenLabelCodes);
  }

  function addHiddenDept() {
    const code = hiddenInput.trim().toUpperCase();
    if (!code || hiddenDeptCodes.includes(code) || code === config?.departmentCode) return;
    const next = [...hiddenDeptCodes, code];
    setHiddenDeptCodes(next);
    setHiddenInput('');
    onDeptOverrideChange?.(extraDeptCodes, next, hiddenLabelCodes);
  }

  function removeHiddenDept(code: string) {
    const next = hiddenDeptCodes.filter((c) => c !== code);
    setHiddenDeptCodes(next);
    onDeptOverrideChange?.(extraDeptCodes, next, hiddenLabelCodes);
  }

  function toggleLabelCode(code: string) {
    const next = hiddenLabelCodes.includes(code)
      ? hiddenLabelCodes.filter((c) => c !== code)
      : [...hiddenLabelCodes, code];
    setHiddenLabelCodes(next);
    onDeptOverrideChange?.(extraDeptCodes, hiddenDeptCodes, next);
  }

  async function addExtraZone() {
    const name = extraZoneInput.trim();
    if (!name) return;
    try {
      const resp = await fetch(`/api/geocode?city=${encodeURIComponent(name)}`);
      if (!resp.ok) throw new Error('Ville introuvable');
      const geo = await resp.json();
      const newZone: ExtraZone = { id: crypto.randomUUID(), cityName: geo.name, lat: geo.lat, lng: geo.lng, radius: extraZoneRadius };
      const next = [...extraZones, newZone];
      setExtraZones(next);
      setExtraZoneInput('');
      onExtraZonesChange?.(next);
    } catch { alert(`Impossible de géocoder "${extraZoneInput.trim()}"`); }
  }

  function removeExtraZone(id: string) {
    const next = extraZones.filter((z) => z.id !== id);
    setExtraZones(next);
    onExtraZonesChange?.(next);
  }

  async function handleMarkerSvgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    updateStyle('markerSvg', text);
    if (markerSvgRef.current) markerSvgRef.current.value = '';
  }

  async function handleLocalFontUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const font = await loadLocalFont(file);
      updateStyle('fontFamily', font.stack);
    } catch { alert('Impossible de charger ce fichier de police'); }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!city.trim()) return;
    setHiddenLabelCodes([]);
    onGenerate(city.trim(), radius, style, secondaryCities, extraDeptCodes, hiddenDeptCodes, extraZones);
  }

  const TABS: { id: StyleTab; label: string }[] = [
    { id: 'template', label: 'Templates' },
    { id: 'carte', label: 'Carte' },
    { id: 'texte', label: 'Texte' },
    { id: 'marqueurs', label: 'Marqueurs' },
  ];

  return (
    <aside className="w-full lg:w-80 xl:w-96 bg-slate-800 border-r border-slate-700 flex flex-col overflow-y-auto">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              Carte <span className="text-orange-400">Zone d'Intervention</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Générateur de cartes professionnelles</p>
          </div>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              title="Réinitialiser tout"
              className="flex-shrink-0 mt-0.5 px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-red-900/40 border border-slate-600 hover:border-red-700/60 text-slate-400 hover:text-red-400 text-xs font-semibold transition-all"
            >
              ↺ Reset
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
        {/* City */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Ville principale</label>
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex : Sens, Melun, Provins..."
            className="w-full bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30" />
        </div>

        {/* Radius */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Zone d'intervention</label>
          <div className="flex items-center gap-3 mb-2">
            <input
              type="number"
              min="1"
              max="500"
              value={radius}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val >= 1 && val <= 500) setRadius(val);
              }}
              className="w-24 bg-slate-700 border-2 border-orange-500/60 text-orange-400 font-bold text-xl text-center rounded-xl px-2 py-2 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30"
            />
            <span className="text-slate-400 font-semibold text-sm">km</span>
            <span className="text-[10px] text-slate-500 flex-1">ou sélectionner :</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {RADIUS_OPTIONS.map((r) => (
              <button key={r} type="button" onClick={() => setRadius(r)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${radius === r ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30' : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Extra zones */}
        <div>
          <button type="button" onClick={() => setExtraZoneOpen((o) => !o)}
            className="w-full flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            <span>Zones supplémentaires{extraZones.length > 0 ? ` · ${extraZones.length}` : ''}</span>
            <span className={`text-slate-400 text-base font-bold transition-transform duration-200 ${extraZoneOpen ? 'rotate-45' : ''}`}>+</span>
          </button>

          {extraZones.length > 0 && (
            <div className="flex flex-col gap-1 mb-2">
              {extraZones.map((zone) => (
                <div key={zone.id} className="flex items-center justify-between bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5">
                  <div className="flex items-center gap-2 text-xs min-w-0">
                    <span className="text-slate-300 font-semibold truncate">{zone.cityName}</span>
                    <span className="text-slate-500 flex-shrink-0">{zone.radius} km</span>
                  </div>
                  <button type="button" onClick={() => removeExtraZone(zone.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors ml-2 flex-shrink-0">×</button>
                </div>
              ))}
            </div>
          )}

          {extraZoneOpen && (
            <div className="border border-slate-700 rounded-xl p-3 flex flex-col gap-2 bg-slate-800/40">
              <div className="flex gap-1.5">
                <input type="text" value={extraZoneInput} onChange={(e) => setExtraZoneInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExtraZone())}
                  placeholder="Ville (ex: Chartres, Orléans...)"
                  className="flex-1 bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-500 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-500" />
                <button type="button" onClick={addExtraZone}
                  className="px-3 bg-orange-600/30 border border-orange-600/50 text-orange-400 rounded-lg font-bold hover:bg-orange-600/50 transition-colors">+</button>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 mb-1">Rayon · <span className="text-slate-300 font-semibold">{extraZoneRadius} km</span></p>
                <div className="flex flex-wrap gap-1">
                  {RADIUS_OPTIONS.map((r) => (
                    <button key={r} type="button" onClick={() => setExtraZoneRadius(r)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${extraZoneRadius === r ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Style accordion */}
        <div className="border border-slate-700 rounded-xl overflow-hidden">
          <button type="button" onClick={() => setStyleOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-750 hover:bg-slate-700 transition-colors text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Personnalisation</span>
            <span className={`transition-transform ${styleOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>

          {styleOpen && (
            <div className="bg-slate-800/50">
              {/* Tab bar */}
              <div className="flex border-b border-slate-700 px-2 pt-2 gap-0.5">
                {TABS.map((t) => (
                  <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
                    className={`flex-1 py-1.5 text-[11px] font-semibold rounded-t-lg transition-colors ${activeTab === t.id ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="p-3.5 flex flex-col gap-3">

                {/* ── TEMPLATES ── */}
                {activeTab === 'template' && (
                  <TemplateSelector selected={template} onChange={handleTemplateChange} />
                )}

                {/* ── CARTE ── */}
                {activeTab === 'carte' && (
                  <div className="flex flex-col gap-3">
                    <SectionTitle>Couleurs</SectionTitle>
                    <ColorPicker label="Fond de carte" value={style.backgroundColor} onChange={(v) => updateStyle('backgroundColor', v)} />
                    <ColorPicker label="Département principal" value={style.mainDepartmentColor} onChange={(v) => updateStyle('mainDepartmentColor', v)} />
                    <ColorPicker label="Départements voisins" value={style.neighborDepartmentColor} onChange={(v) => updateStyle('neighborDepartmentColor', v)} />

                    <SectionTitle>Opacité des zones</SectionTitle>
                    <Slider label="Dép. principal" value={style.mainDepartmentOpacity} min={0.1} max={1} step={0.05} unit="%" onChange={(v) => updateStyle('mainDepartmentOpacity', v)} />
                    <Slider label="Dép. voisins" value={style.neighborDepartmentOpacity} min={0.1} max={1} step={0.05} unit="%" onChange={(v) => updateStyle('neighborDepartmentOpacity', v)} />

                    <SectionTitle>Contours des départements</SectionTitle>
                    <ColorPicker label="Couleur contour" value={style.borderColor} onChange={(v) => updateStyle('borderColor', v)} />
                    <Slider label="Épaisseur" value={style.borderWidth} min={0.5} max={5} step={0.5} unit="px" onChange={(v) => updateStyle('borderWidth', v)} />
                    <Slider label="Opacité" value={style.borderOpacity} min={0} max={1} step={0.1} unit="%" onChange={(v) => updateStyle('borderOpacity', v)} />
                    <div>
                      <label className="text-xs text-slate-300 block mb-1.5">Style du trait</label>
                      <div className="grid grid-cols-3 gap-1">
                        {(['solid', 'dashed', 'dotted'] as CircleDash[]).map((v) => (
                          <button key={v} type="button" onClick={() => updateStyle('borderDash', v)}
                            className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${style.borderDash === v ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}>
                            {v === 'solid' ? 'Plein' : v === 'dashed' ? 'Tirets' : 'Pointillés'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-300 block mb-1.5">Jointure</label>
                      <div className="grid grid-cols-3 gap-1">
                        {(['round', 'miter', 'bevel'] as BorderLineJoin[]).map((v) => (
                          <button key={v} type="button" onClick={() => updateStyle('borderLineJoin', v)}
                            className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${style.borderLineJoin === v ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}>
                            {v === 'round' ? 'Arrondi' : v === 'miter' ? 'Anguleux' : 'Biseauté'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <SectionTitle>Zone d'intervention</SectionTitle>
                    <ColorPicker label="Couleur remplissage" value={style.circleColor} onChange={(v) => updateStyle('circleColor', v)} />
                    <Slider label="Opacité remplissage" value={style.circleOpacity} min={0} max={0.6} step={0.05} unit="%" onChange={(v) => updateStyle('circleOpacity', v)} />
                    <ColorPicker label="Couleur bordure" value={style.circleBorderColor} onChange={(v) => updateStyle('circleBorderColor', v)} />
                    <div>
                      <label className="text-xs text-slate-300 block mb-1.5">Style du cercle</label>
                      <div className="grid grid-cols-3 gap-1">
                        {(['solid', 'dashed', 'dotted'] as CircleDash[]).map((v) => (
                          <button key={v} type="button" onClick={() => updateStyle('circleDash', v)}
                            className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${style.circleDash === v ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}>
                            {v === 'solid' ? 'Plein' : v === 'dashed' ? 'Tirets' : 'Pointillés'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TEXTE ── */}
                {activeTab === 'texte' && (
                  <div className="flex flex-col gap-3">
                    <FontPicker value={style.fontFamily} onChange={(v) => updateStyle('fontFamily', v)} />

                    <SectionTitle>Étiquettes des départements</SectionTitle>
                    <div className="flex gap-2">
                      {/* Toggle Numéro */}
                      <button type="button" onClick={() => updateStyle('showDeptNumber', !style.showDeptNumber)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${style.showDeptNumber ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
                        N° (77, 75...)
                      </button>
                      {/* Toggle Nom */}
                      <button type="button" onClick={() => updateStyle('showDeptName', !style.showDeptName)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${style.showDeptName ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
                        Nom complet
                      </button>
                    </div>

                    {(style.showDeptNumber || style.showDeptName) && (
                      <>
                        <ColorPicker label="Couleur texte" value={style.deptLabelColor} onChange={(v) => updateStyle('deptLabelColor', v)} />
                        <Slider label="Taille" value={style.deptLabelSize} min={10} max={72} step={2} unit="px" onChange={(v) => updateStyle('deptLabelSize', v)} />

                        <div>
                          <label className="text-xs text-slate-300 block mb-1.5">Graisse</label>
                          <div className="grid grid-cols-4 gap-1">
                            {[400, 500, 700, 900].map((w) => (
                              <button key={w} type="button" onClick={() => updateStyle('deptLabelWeight', w)}
                                className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${style.deptLabelWeight === w ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}>
                                {w}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-slate-300 block mb-1.5">Style</label>
                          <div className="grid grid-cols-2 gap-1">
                            <button type="button" onClick={() => updateStyle('deptLabelFilled', true)}
                              className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${style.deptLabelFilled ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}>
                              Rempli
                            </button>
                            <button type="button" onClick={() => updateStyle('deptLabelFilled', false)}
                              className={`py-1.5 rounded-lg text-xs font-semibold border transition-all ${!style.deptLabelFilled ? 'bg-orange-500/20 border-orange-500 text-orange-300' : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600'}`}>
                              Contour seul
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {(visibleDeptCodes?.length ?? 0) > 0 && (
                      <div>
                        <SectionTitle>Étiquettes visibles</SectionTitle>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(visibleDeptCodes ?? []).slice().sort().map((code) => {
                            const isHidden = hiddenLabelCodes.includes(code);
                            return (
                              <button key={code} type="button" onClick={() => toggleLabelCode(code)}
                                title={isHidden ? 'Afficher' : 'Masquer'}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${isHidden ? 'bg-slate-800/50 border-slate-700 text-slate-600 line-through' : 'bg-slate-700 border-slate-600 text-slate-300 hover:border-orange-500/50 hover:text-slate-100'}`}>
                                {code}
                              </button>
                            );
                          })}
                        </div>
                        {hiddenLabelCodes.length > 0 && (
                          <button type="button" onClick={() => { setHiddenLabelCodes([]); onDeptOverrideChange?.(extraDeptCodes, hiddenDeptCodes, []); }}
                            className="text-[10px] text-orange-400/70 hover:text-orange-400 transition-colors mt-1.5">
                            Tout afficher
                          </button>
                        )}
                      </div>
                    )}

                    <SectionTitle>Contour du texte (halo)</SectionTitle>
                    <Slider label="Épaisseur halo" value={style.labelOutlineWidth} min={0} max={6} step={0.5} unit="px" onChange={(v) => updateStyle('labelOutlineWidth', v)} />
                    {style.labelOutlineWidth > 0 && (
                      <ColorPicker label="Couleur halo" value={style.labelOutlineColor} onChange={(v) => updateStyle('labelOutlineColor', v)} />
                    )}

                    <SectionTitle>Couleurs du texte</SectionTitle>
                    <ColorPicker label="Ville principale" value={style.mainTextColor} onChange={(v) => updateStyle('mainTextColor', v)} />
                    <ColorPicker label="Villes secondaires" value={style.secondaryTextColor} onChange={(v) => updateStyle('secondaryTextColor', v)} />
                  </div>
                )}

                {/* ── MARQUEURS ── */}
                {activeTab === 'marqueurs' && (
                  <div className="flex flex-col gap-3">
                    <SectionTitle>Marqueur principal</SectionTitle>

                    {/* Type selector */}
                    <div className="grid grid-cols-4 gap-1">
                      {MARKER_PRESETS.map((p) => (
                        <button key={p.id} type="button" onClick={() => updateStyle('markerType', p.id as MarkerType)}
                          className={`flex flex-col items-center gap-1 py-2 rounded-lg border transition-all ${style.markerType === p.id ? 'bg-orange-500/20 border-orange-500' : 'bg-slate-700 border-slate-600 hover:bg-slate-600'}`}>
                          <span
                            className={style.markerType === p.id ? 'text-orange-400' : 'text-slate-300'}
                            dangerouslySetInnerHTML={{ __html: p.svgPreview.replace(/currentColor/g, style.markerType === p.id ? '#fb923c' : '#94a3b8') }}
                          />
                          <span className={`text-[10px] font-semibold ${style.markerType === p.id ? 'text-orange-300' : 'text-slate-500'}`}>{p.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* SVG upload for custom type */}
                    {style.markerType === 'custom' && (
                      <div className="flex flex-col gap-1.5">
                        <button type="button" onClick={() => markerSvgRef.current?.click()}
                          className="w-full py-2 border border-dashed border-slate-600 rounded-lg text-xs text-slate-400 hover:border-orange-500/50 hover:text-slate-300 transition-colors">
                          {style.markerSvg ? '✓ SVG chargé — Remplacer' : '+ Importer un fichier SVG'}
                        </button>
                        <input ref={markerSvgRef} type="file" accept=".svg" onChange={handleMarkerSvgUpload} className="hidden" />
                      </div>
                    )}

                    <ColorPicker label="Couleur marqueur" value={style.markerColor} onChange={(v) => updateStyle('markerColor', v)} />
                    <Slider label="Taille marqueur" value={style.markerSize} min={4} max={28} step={1} unit="px" onChange={(v) => updateStyle('markerSize', v)} />

                    <SectionTitle>Marqueurs secondaires</SectionTitle>
                    <ColorPicker label="Couleur" value={style.secondaryMarkerColor} onChange={(v) => updateStyle('secondaryMarkerColor', v)} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Departments accordion */}
        <div className="border border-slate-700 rounded-xl overflow-hidden">
          <button type="button" onClick={() => setDeptOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-750 hover:bg-slate-700 transition-colors text-xs font-semibold text-slate-400 uppercase tracking-wider">
            <span>Départements {(extraDeptCodes.length + hiddenDeptCodes.length) > 0 ? `· ${extraDeptCodes.length} ajouté${extraDeptCodes.length > 1 ? 's' : ''}, ${hiddenDeptCodes.length} exclu${hiddenDeptCodes.length > 1 ? 's' : ''}` : ''}</span>
            <span className={`transition-transform ${deptOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>

          {deptOpen && (
            <div className="p-3.5 bg-slate-800/50 flex flex-col gap-3">
              {/* Extra depts */}
              <div>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-1.5">Ajouter un département</p>
                <div className="flex gap-1.5">
                  <input type="text" value={extraInput} onChange={(e) => setExtraInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addExtraDept())}
                    placeholder="Code (ex: 78, 2A...)"
                    className="flex-1 bg-slate-700 border border-slate-600 text-slate-200 placeholder-slate-500 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-orange-500" />
                  <button type="button" onClick={addExtraDept}
                    className="px-3 bg-emerald-700/30 border border-emerald-700/50 text-emerald-400 rounded-lg text-sm font-bold hover:bg-emerald-700/50 transition-colors">+</button>
                </div>
                {extraDeptCodes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {extraDeptCodes.map((c) => (
                      <span key={c} className="flex items-center gap-1 bg-emerald-900/30 border border-emerald-700/40 text-emerald-300 text-xs px-2 py-0.5 rounded-full">
                        {c}
                        <button type="button" onClick={() => removeExtraDept(c)} className="text-emerald-600 hover:text-red-400 transition-colors">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Hidden depts */}
              <div>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide mb-1.5">Exclure un département</p>
                <div className="flex gap-1.5">
                  <input type="text" value={hiddenInput} onChange={(e) => setHiddenInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addHiddenDept())}
                    placeholder="Code (ex: 75, 69...)"
                    className="flex-1 bg-slate-700 border border-slate-600 text-slate-200 placeholder-slate-500 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-orange-500" />
                  <button type="button" onClick={addHiddenDept}
                    className="px-3 bg-red-900/30 border border-red-700/50 text-red-400 rounded-lg text-sm font-bold hover:bg-red-700/50 transition-colors">−</button>
                </div>
                {hiddenDeptCodes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {hiddenDeptCodes.map((c) => (
                      <span key={c} className="flex items-center gap-1 bg-red-900/30 border border-red-700/40 text-red-300 text-xs px-2 py-0.5 rounded-full">
                        {c}
                        <button type="button" onClick={() => removeHiddenDept(c)} className="text-red-600 hover:text-red-300 transition-colors">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Secondary cities */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Villes secondaires</label>
          <div className="flex gap-2">
            <input type="text" value={secondaryInput} onChange={(e) => setSecondaryInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSecondaryCity())}
              placeholder="Ajouter une ville..."
              className="flex-1 bg-slate-700 border border-slate-600 text-slate-100 placeholder-slate-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-500" />
            <button type="button" onClick={addSecondaryCity}
              className="px-3 bg-slate-600 hover:bg-slate-500 text-slate-200 rounded-xl text-sm font-bold transition-colors">+</button>
          </div>
          {secondaryCities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {secondaryCities.map((c) => (
                <span key={c.id} className="flex items-center gap-1 bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded-full border border-slate-600">
                  {c.name}
                  <button type="button" onClick={() => toggleCityType(c.id)}
                    title={c.type === 'main' ? 'Ville principale (cliquer pour secondaire)' : 'Ville secondaire (cliquer pour principale)'}
                    className={`text-sm transition-colors ml-0.5 ${c.type === 'main' ? 'text-orange-400' : 'text-slate-500 hover:text-slate-300'}`}>
                    {c.type === 'main' ? '★' : '☆'}
                  </button>
                  <button type="button" onClick={() => removeSecondaryCity(c.id)}
                    className="text-slate-500 hover:text-red-400 transition-colors">×</button>
                </span>
              ))}
            </div>
          )}
          {secondaryCities.some((c) => c.type === 'main') && (
            <p className="text-[10px] text-orange-400/70 mt-1.5">★ = marqueur principal · ☆ = marqueur secondaire</p>
          )}
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        <button type="submit" disabled={loading || !city.trim()}
          className="w-full py-3 bg-orange-500 hover:bg-orange-400 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-orange-500/20 hover:shadow-orange-400/30">
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Génération...
            </span>
          ) : 'Générer la carte'}
        </button>

        {config && (
          <div className="text-xs text-slate-500 text-center space-y-0.5">
            <p className="text-slate-300 font-medium">{config.cityName}</p>
            <p>{config.departmentName} ({config.departmentCode}) · {config.region}</p>
            <p>{config.lat.toFixed(4)}, {config.lng.toFixed(4)} · {config.radius} km</p>
          </div>
        )}
      </form>
    </aside>
  );
}
