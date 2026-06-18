'use client';

import { useState, useEffect } from 'react';
import type { Commune, MapConfig } from '@/lib/types';

interface CommunesListProps {
  config: MapConfig | null;
}

export function CommunesList({ config }: CommunesListProps) {
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!config) return;
    setLoading(true);
    setError(null);
    setCommunes([]);

    fetch(`/api/communes?lat=${config.lat}&lng=${config.lng}&radius=${config.radius}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setCommunes(data);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [config]);

  const filtered = communes.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.postalCode.includes(search)
  );

  if (!config) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
        Générez une carte pour voir les communes
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">
          Communes dans un rayon de {config.radius} km
        </h3>
        {communes.length > 0 && (
          <span className="text-xs bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full">
            {communes.length} résultats
          </span>
        )}
      </div>

      {communes.length > 5 && (
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-orange-500"
        />
      )}

      {loading && (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-4 justify-center">
          <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          Chargement des communes...
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2">
            <span>Commune</span>
            <span className="text-center">Code postal</span>
            <span className="text-right">Distance</span>
          </div>
          <div className="flex flex-col gap-0.5 max-h-80 overflow-y-auto pr-1">
            {filtered.map((c, i) => (
              <div
                key={`${c.name}-${i}`}
                className="grid grid-cols-3 gap-1 px-2 py-1.5 rounded hover:bg-slate-700/50 transition-colors"
              >
                <span className="text-sm text-slate-200 truncate font-medium">{c.name}</span>
                <span className="text-sm text-slate-400 text-center">
                  {c.postalCode || <span className="text-slate-600">—</span>}
                </span>
                <span className="text-sm text-slate-400 text-right">{c.distance} km</span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => copyToClipboard(communes)}
            className="text-xs text-slate-400 hover:text-slate-200 mt-1 transition-colors text-left"
          >
            Copier la liste (SEO)
          </button>
        </>
      )}

      {!loading && !error && communes.length === 0 && config && (
        <div className="text-slate-500 text-sm text-center py-4">Aucune commune trouvée</div>
      )}
    </div>
  );
}

function copyToClipboard(communes: Commune[]): void {
  const text = communes.map((c) => `${c.name}${c.postalCode ? ` (${c.postalCode})` : ''}`).join(', ');
  navigator.clipboard.writeText(text).catch(() => {});
}
