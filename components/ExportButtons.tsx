'use client';

import { useState } from 'react';
import type { MapConfig, DepartmentsGeoJSON, ExportSize, MapOverrides } from '@/lib/types';
import { generateSVG, downloadSVG } from '@/lib/svgExporter';
import { exportPNG, exportWEBP } from '@/lib/pngExporter';
import { emptyOverrides } from '@/lib/types';

interface ExportButtonsProps {
  config: MapConfig | null;
  geojson: DepartmentsGeoJSON | null;
  neighborCodes: Set<string>;
  overrides?: MapOverrides;
}

export function ExportButtons({ config, geojson, neighborCodes, overrides }: ExportButtonsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [exportSize, setExportSize] = useState<ExportSize>('2000');
  const [outline, setOutline] = useState(false);

  const disabled = !config || !geojson;

  async function handleSVG() {
    if (!config || !geojson) return;
    setBusy('svg');
    try {
      const svg = generateSVG(config, geojson, neighborCodes, 800, overrides ?? emptyOverrides(), outline);
      const suffix = outline ? '-detoure' : '';
      downloadSVG(svg, `carte-${config.cityName.toLowerCase()}-${config.radius}km${suffix}.svg`);
    } finally {
      setBusy(null);
    }
  }

  async function handlePNG() {
    if (!config || !geojson) return;
    setBusy('png');
    try {
      await exportPNG(config, geojson, neighborCodes, exportSize, outline);
    } catch (e) {
      alert('Erreur export PNG: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function handleWEBP() {
    if (!config || !geojson) return;
    setBusy('webp');
    try {
      await exportWEBP(config, geojson, neighborCodes, exportSize);
    } catch (e) {
      alert('Erreur export WEBP: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <label className="text-xs text-slate-400 flex-shrink-0">Résolution PNG/WEBP :</label>
        <select
          value={exportSize}
          onChange={(e) => setExportSize(e.target.value as ExportSize)}
          disabled={disabled}
          className="flex-1 bg-slate-700 border border-slate-600 text-slate-200 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-orange-500 disabled:opacity-40"
        >
          <option value="1200">1 200 × 1 200 px</option>
          <option value="2000">2 000 × 2 000 px</option>
          <option value="3000">3 000 × 3 000 px (HD)</option>
        </select>
      </div>

      {/* Outline toggle */}
      <button
        type="button"
        onClick={() => setOutline((v) => !v)}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all disabled:opacity-30 ${
          outline
            ? 'bg-orange-500/20 border-orange-500 text-orange-300'
            : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200'
        }`}
      >
        <span className="text-base leading-none">{outline ? '⬡' : '⬢'}</span>
        <span>Détouré</span>
        <span className="text-[10px] opacity-60 ml-auto">{outline ? 'fond transparent' : 'fond carré'}</span>
      </button>

      <div className="grid grid-cols-3 gap-2">
        <ExportBtn
          label="SVG"
          sublabel="vectoriel"
          icon="◈"
          onClick={handleSVG}
          loading={busy === 'svg'}
          disabled={disabled}
          color="blue"
        />
        <ExportBtn
          label="PNG"
          sublabel={`${exportSize}px`}
          icon="▣"
          onClick={handlePNG}
          loading={busy === 'png'}
          disabled={disabled}
          color="green"
        />
        <ExportBtn
          label="WEBP"
          sublabel={`${exportSize}px`}
          icon="▤"
          onClick={handleWEBP}
          loading={busy === 'webp'}
          disabled={disabled}
          color="purple"
        />
      </div>

      {config && (
        <p className="text-[10px] text-slate-500 text-center">
          {config.cityName} · {config.radius} km{outline ? ' · détouré' : ''}
        </p>
      )}
    </div>
  );
}

interface ExportBtnProps {
  label: string;
  sublabel: string;
  icon: string;
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  color: 'blue' | 'green' | 'purple';
}

const colorMap = {
  blue: 'border-blue-600 bg-blue-900/30 text-blue-300 hover:bg-blue-800/40',
  green: 'border-emerald-600 bg-emerald-900/30 text-emerald-300 hover:bg-emerald-800/40',
  purple: 'border-violet-600 bg-violet-900/30 text-violet-300 hover:bg-violet-800/40',
};

function ExportBtn({ label, sublabel, icon, onClick, loading, disabled, color }: ExportBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex flex-col items-center gap-0.5 py-3 rounded-xl border text-xs font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed ${colorMap[color]}`}
    >
      {loading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <span className="text-base leading-none">{icon}</span>
      )}
      <span className="font-bold">{label}</span>
      <span className="text-[9px] opacity-70">{sublabel}</span>
    </button>
  );
}
