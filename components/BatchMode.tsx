'use client';

import { useState, useRef } from 'react';
import type { BatchItem, BatchResult, DepartmentsGeoJSON } from '@/lib/types';
import { getTemplate } from '@/lib/templates';
import { buildRenderedMapData } from '@/lib/mapRenderer';
import { generateSVG, downloadSVG } from '@/lib/svgExporter';
import { exportPNG } from '@/lib/pngExporter';

interface BatchModeProps {
  geojson: DepartmentsGeoJSON | null;
}

const EXAMPLE_CSV = `ville,rayon
Sens,30
Melun,50
Provins,20
Nangis,30`;

export function BatchMode({ geojson }: BatchModeProps) {
  const [csvText, setCsvText] = useState('');
  const [items, setItems] = useState<BatchItem[]>([]);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [running, setRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function parseCSV(text: string): BatchItem[] {
    const lines = text.trim().split('\n').slice(1);
    return lines
      .map((line) => {
        const [city, radiusStr] = line.split(',').map((s) => s.trim());
        const radius = parseFloat(radiusStr);
        if (!city || isNaN(radius)) return null;
        return { city, radius };
      })
      .filter(Boolean) as BatchItem[];
  }

  function handleCSVChange(text: string) {
    setCsvText(text);
    setItems(parseCSV(text));
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      handleCSVChange(text);
    };
    reader.readAsText(file, 'UTF-8');
  }

  async function runBatch() {
    if (!geojson || !items.length) return;
    setRunning(true);
    const template = getTemplate('seo');
    const initial: BatchResult[] = items.map((item) => ({
      ...item,
      status: 'pending',
    }));
    setResults(initial);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setResults((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], status: 'processing' };
        return next;
      });

      try {
        const geoResp = await fetch(`/api/geocode?city=${encodeURIComponent(item.city)}`);
        if (!geoResp.ok) throw new Error('Géocodage échoué');
        const geo = await geoResp.json();

        const config = {
          cityName: geo.name,
          lat: geo.lat,
          lng: geo.lng,
          radius: item.radius,
          departmentCode: geo.departmentCode,
          departmentName: geo.departmentName,
          region: geo.region,
          style: template.style,
          secondaryCities: [],
        };

        const mapData = buildRenderedMapData(config, geojson);
        const svg = generateSVG(config, geojson, mapData.neighborCodes);
        const svgBlob = new Blob([svg], { type: 'image/svg+xml' });
        const svgUrl = URL.createObjectURL(svgBlob);

        setResults((prev) => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'done', svgUrl };
          return next;
        });

        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        setResults((prev) => {
          const next = [...prev];
          next[i] = {
            ...next[i],
            status: 'error',
            error: err instanceof Error ? err.message : 'Erreur',
          };
          return next;
        });
      }
    }

    setRunning(false);
  }

  function downloadAllSVG() {
    results.filter((r) => r.status === 'done' && r.svgUrl).forEach((r) => {
      const a = document.createElement('a');
      a.href = r.svgUrl!;
      a.download = `carte-${r.city.toLowerCase()}-${r.radius}km.svg`;
      a.click();
    });
  }

  const doneCount = results.filter((r) => r.status === 'done').length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-400">
        Importez un fichier CSV pour générer plusieurs cartes en une seule fois.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs rounded-lg border border-slate-600 transition-colors"
        >
          Importer CSV
        </button>
        <button
          type="button"
          onClick={() => handleCSVChange(EXAMPLE_CSV)}
          className="px-3 py-1.5 bg-slate-700/50 hover:bg-slate-600 text-slate-400 text-xs rounded-lg border border-slate-600 transition-colors"
        >
          Exemple
        </button>
        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFileUpload} className="sr-only" />
      </div>

      <textarea
        value={csvText}
        onChange={(e) => handleCSVChange(e.target.value)}
        placeholder={'ville,rayon\nSens,30\nMelun,50'}
        rows={5}
        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-orange-500 resize-none"
      />

      {items.length > 0 && (
        <p className="text-xs text-slate-400">{items.length} villes détectées</p>
      )}

      <button
        type="button"
        onClick={runBatch}
        disabled={!items.length || !geojson || running}
        className="w-full py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {running ? 'Génération en cours...' : `Générer ${items.length} carte${items.length > 1 ? 's' : ''}`}
      </button>

      {results.length > 0 && (
        <div className="flex flex-col gap-1">
          {results.map((r, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-700/50">
              <StatusDot status={r.status} />
              <span className="text-sm text-slate-200 flex-1">{r.city}</span>
              <span className="text-xs text-slate-500">{r.radius} km</span>
              {r.status === 'done' && r.svgUrl && (
                <a
                  href={r.svgUrl}
                  download={`carte-${r.city.toLowerCase()}-${r.radius}km.svg`}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  SVG
                </a>
              )}
              {r.status === 'error' && (
                <span className="text-xs text-red-400 truncate max-w-24">{r.error}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {doneCount > 1 && (
        <button
          type="button"
          onClick={downloadAllSVG}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors text-left"
        >
          Télécharger tous les SVG ({doneCount})
        </button>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: BatchResult['status'] }) {
  const cls = {
    pending: 'bg-slate-500',
    processing: 'bg-yellow-400 animate-pulse',
    done: 'bg-emerald-400',
    error: 'bg-red-400',
  }[status];
  return <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cls}`} />;
}
