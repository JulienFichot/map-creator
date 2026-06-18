'use client';

import { useEffect, useState } from 'react';
import type { MapConfig, DepartmentsGeoJSON, MapStyle } from '@/lib/types';
import { emptyOverrides } from '@/lib/types';
import { VARIANT_PRESETS, applyVariantPreset } from '@/lib/variants';
import { generateSVG, downloadSVG } from '@/lib/svgExporter';
import { exportPNG } from '@/lib/pngExporter';
import { computeNeighborCodes } from '@/lib/mapRenderer';

const RADIUS_OPTIONS = [10, 20, 30, 40, 50, 75, 100];

interface VariantItem {
  presetId: string;
  label: string;
  description: string;
  radius: number;
  style: MapStyle;
  svgUrl: string;
  svgStr: string;
  neighborCodes: Set<string>;
}

interface Props {
  config: MapConfig | null;
  geojson: DepartmentsGeoJSON | null;
  onApply: (style: MapStyle, radius: number) => void;
}

export function VariantsTab({ config, geojson, onApply }: Props) {
  const [radii, setRadii] = useState<Record<string, number>>({});
  const [variants, setVariants] = useState<VariantItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!config || !geojson) { setVariants([]); return; }

    const items: VariantItem[] = VARIANT_PRESETS.map((preset) => {
      const defaultRadius = Math.max(10, Math.round(config.radius * preset.radiusMultiplier));
      const radius = radii[preset.id] ?? defaultRadius;
      const style = applyVariantPreset(config.style, preset);
      const varCfg: MapConfig = { ...config, radius, style };
      const neighborCodes = computeNeighborCodes(geojson, varCfg.departmentCode, varCfg.lat, varCfg.lng, radius);
      const svgStr = generateSVG(varCfg, geojson, neighborCodes, 400, emptyOverrides());
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const svgUrl = URL.createObjectURL(blob);
      return { presetId: preset.id, label: preset.label, description: preset.description, radius, style, svgUrl, svgStr, neighborCodes };
    });

    setVariants((prev) => {
      prev.forEach((v) => URL.revokeObjectURL(v.svgUrl));
      return items;
    });

    return () => { items.forEach((v) => URL.revokeObjectURL(v.svgUrl)); };
  }, [config, geojson, radii]);

  if (!config) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <div className="w-12 h-12 rounded-full bg-slate-700/50 flex items-center justify-center text-slate-500 text-xl">◎</div>
        <div>
          <p className="text-xs font-semibold text-slate-400">Aucune carte générée</p>
          <p className="text-[11px] text-slate-600 mt-0.5">Saisissez une ville et cliquez sur Générer</p>
        </div>
      </div>
    );
  }

  function setRadius(pid: string, r: number) {
    setRadii((prev) => ({ ...prev, [pid]: r }));
  }

  async function handleDownloadPNG(v: VariantItem) {
    if (!geojson) return;
    setBusy(`png-${v.presetId}`);
    try {
      const varCfg: MapConfig = { ...config!, radius: v.radius, style: v.style };
      await exportPNG(varCfg, geojson, v.neighborCodes, '2000');
    } catch (e) {
      alert('Erreur PNG: ' + String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {variants.map((v) => (
        <div key={v.presetId} className="border border-slate-700 rounded-xl overflow-hidden bg-slate-900/40 flex flex-col">
          {/* Preview */}
          <div className="relative bg-white overflow-hidden" style={{ height: '130px' }}>
            <img src={v.svgUrl} alt={v.label} className="w-full h-full object-cover object-center" />
          </div>

          <div className="p-2.5 flex flex-col gap-2">
            {/* Header row */}
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-200 leading-tight">{v.label}</p>
                <p className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">{v.description}</p>
              </div>
              <button
                onClick={() => onApply(v.style, v.radius)}
                className="flex-shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-400 transition-colors shadow-sm"
              >
                Appliquer
              </button>
            </div>

            {/* Radius selector */}
            <div>
              <p className="text-[10px] text-slate-500 mb-1.5">Rayon · <span className="text-slate-300 font-semibold">{v.radius} km</span></p>
              <div className="flex flex-wrap gap-1">
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadius(v.presetId, r)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                      v.radius === r ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Download buttons */}
            <div className="flex gap-1.5">
              <button
                onClick={() => downloadSVG(v.svgStr, `carte-${config.cityName.toLowerCase()}-${v.presetId}-${v.radius}km.svg`)}
                className="flex-1 py-1.5 text-[10px] font-semibold rounded-lg bg-blue-900/30 text-blue-300 border border-blue-700/50 hover:bg-blue-800/40 transition-colors"
              >
                SVG
              </button>
              <button
                onClick={() => handleDownloadPNG(v)}
                disabled={busy === `png-${v.presetId}`}
                className="flex-1 py-1.5 text-[10px] font-semibold rounded-lg bg-emerald-900/30 text-emerald-300 border border-emerald-700/50 hover:bg-emerald-800/40 transition-colors disabled:opacity-40"
              >
                {busy === `png-${v.presetId}` ? '...' : 'PNG 2k'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
