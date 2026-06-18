'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { MapConfig, MapStyle, SecondaryCity, DepartmentsGeoJSON, MapOverrides, ElementSelection, ExtraZone, ExtraZoneStyle, LabelOverride } from '@/lib/types';
import { emptyOverrides } from '@/lib/types';
import { ControlPanel } from './ControlPanel';
import { ExportButtons } from './ExportButtons';
import { CommunesList } from './CommunesList';
import { BatchMode } from './BatchMode';
import { ElementEditPanel } from './ElementEditPanel';
import { VariantsTab } from './VariantsTab';
import type { LeafletMapHandle } from './LeafletMap';

const LeafletMap = dynamic(() => import('./LeafletMap').then((m) => ({ default: m.LeafletMap })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-xl">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-orange-400 rounded-full animate-spin" />
        <p className="text-sm">Chargement de la carte...</p>
      </div>
    </div>
  ),
});

type BottomTab = 'communes' | 'export' | 'batch';

export function MapGenerator() {
  const [config, setConfig] = useState<MapConfig | null>(null);
  const [configSnapshot, setConfigSnapshot] = useState<MapConfig | null>(null);
  const [overridesSnapshot, setOverridesSnapshot] = useState<MapOverrides>(emptyOverrides());
  const [showBefore, setShowBefore] = useState(false);
  const [geojson, setGeojson] = useState<DepartmentsGeoJSON | null>(null);
  const [neighborCodes, setNeighborCodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<BottomTab>('communes');
  const [overrides, setOverrides] = useState<MapOverrides>(emptyOverrides());
  const [selectedElement, setSelectedElement] = useState<ElementSelection | null>(null);
  const [mapContainerRect, setMapContainerRect] = useState({ width: 800, height: 500 });
  const [resetKey, setResetKey] = useState(0);
  const [deptToggleMode, setDeptToggleMode] = useState(false);

  const mapRef = useRef<LeafletMapHandle>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setMapContainerRect({ width: el.clientWidth, height: el.clientHeight });
    });
    obs.observe(el);
    setMapContainerRect({ width: el.clientWidth, height: el.clientHeight });
    return () => obs.disconnect();
  }, []);

  const loadGeoJSON = useCallback(async (): Promise<DepartmentsGeoJSON> => {
    if (geojson) return geojson;
    const resp = await fetch('/api/geojson/departements');
    if (!resp.ok) throw new Error('Erreur chargement GeoJSON départements');
    const data: DepartmentsGeoJSON = await resp.json();
    setGeojson(data);
    return data;
  }, [geojson]);

  const handleGenerate = useCallback(
    async (city: string, radius: number, style: MapStyle, secondaryCities: SecondaryCity[], extraDeptCodes: string[], hiddenDeptCodes: string[], extraZones: ExtraZone[]) => {
      setLoading(true);
      setError(null);
      setSelectedElement(null);

      try {
        const [geoData, deptData] = await Promise.all([
          fetch(`/api/geocode?city=${encodeURIComponent(city)}`).then((r) => {
            if (!r.ok) return r.json().then((d) => Promise.reject(new Error(d.error ?? 'Erreur géocodage')));
            return r.json();
          }),
          loadGeoJSON(),
        ]);

        const newConfig: MapConfig = {
          cityName: geoData.name,
          lat: geoData.lat,
          lng: geoData.lng,
          radius,
          departmentCode: geoData.departmentCode,
          departmentName: geoData.departmentName,
          region: geoData.region,
          style,
          secondaryCities,
          extraDeptCodes,
          hiddenDeptCodes,
          hiddenLabelCodes: [],
          extraZones,
        };

        setConfig((prev) => {
          if (prev?.cityName !== geoData.name) setOverrides(emptyOverrides());
          return newConfig;
        });
        setConfigSnapshot(newConfig);
        setOverridesSnapshot(emptyOverrides());
        setShowBefore(false);

        if (deptData) setGeojson(deptData);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    },
    [loadGeoJSON]
  );

  const handleDeptOverrideChange = useCallback((extraDeptCodes: string[], hiddenDeptCodes: string[], hiddenLabelCodes: string[]) => {
    setConfig((prev) => prev ? { ...prev, extraDeptCodes, hiddenDeptCodes, hiddenLabelCodes } : prev);
  }, []);

  const handleExtraZonesChange = useCallback((extraZones: ExtraZone[]) => {
    setConfig((prev) => prev ? { ...prev, extraZones } : prev);
  }, []);

  const handleExtraZoneCenterMove = useCallback((id: string, ziLat: number, ziLng: number) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const extraZones = (prev.extraZones ?? []).map((z) => z.id === id ? { ...z, lat: ziLat, lng: ziLng } : z);
      return { ...prev, extraZones };
    });
  }, []);

  const handleApplyVariant = useCallback((style: MapStyle, radius: number) => {
    setConfig((prev) => prev ? { ...prev, style, radius } : prev);
  }, []);

  const handleStyleUpdate = useCallback((patch: Partial<MapStyle>) => {
    setConfig((prev) => prev ? { ...prev, style: { ...prev.style, ...patch } } : prev);
  }, []);

  const handleExtraZoneStyleUpdate = useCallback((id: string, patch: Partial<ExtraZoneStyle>) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const extraZones = (prev.extraZones ?? []).map((z) => {
        if (z.id !== id) return z;
        const merged = { ...z.zoneStyle, ...patch };
        const zoneStyle = Object.fromEntries(
          Object.entries(merged).filter(([, v]) => v !== undefined)
        ) as ExtraZoneStyle;
        return { ...z, zoneStyle };
      });
      return { ...prev, extraZones };
    });
  }, []);

  const handleZiCenterMove = useCallback((ziLat: number, ziLng: number) => {
    setConfig((prev) => prev ? { ...prev, ziCenterLat: ziLat, ziCenterLng: ziLng } : prev);
  }, []);

  const handleOverrideUpdate = useCallback((patch: Partial<MapOverrides>) => {
    setOverrides((prev) => ({
      depts: { ...prev.depts, ...(patch.depts ?? {}) },
      cityLabel: patch.cityLabel !== undefined ? patch.cityLabel : prev.cityLabel,
      extraZoneLabels: prev.extraZoneLabels,
      secondaryCityLabels: prev.secondaryCityLabels,
    }));
  }, []);

  const handleExtraZoneLabelMove = useCallback((id: string, lat: number, lng: number) => {
    setOverrides((prev) => ({
      ...prev,
      extraZoneLabels: { ...(prev.extraZoneLabels ?? {}), [id]: { ...(prev.extraZoneLabels?.[id] ?? {}), lat, lng } },
    }));
  }, []);

  const handleExtraZoneLabelUpdate = useCallback((id: string, patch: Partial<LabelOverride>) => {
    setOverrides((prev) => ({
      ...prev,
      extraZoneLabels: { ...(prev.extraZoneLabels ?? {}), [id]: { ...(prev.extraZoneLabels?.[id] ?? {}), ...patch } },
    }));
  }, []);

  const handleExtraZoneLabelReset = useCallback((id: string) => {
    setOverrides((prev) => {
      const labels = { ...(prev.extraZoneLabels ?? {}) };
      delete labels[id];
      return { ...prev, extraZoneLabels: labels };
    });
  }, []);

  const handleSecondaryCityLabelMove = useCallback((id: string, lat: number, lng: number) => {
    setOverrides((prev) => ({
      ...prev,
      secondaryCityLabels: { ...(prev.secondaryCityLabels ?? {}), [id]: { ...(prev.secondaryCityLabels?.[id] ?? {}), lat, lng } },
    }));
  }, []);

  const handleSecondaryCityLabelUpdate = useCallback((id: string, patch: Partial<LabelOverride>) => {
    setOverrides((prev) => ({
      ...prev,
      secondaryCityLabels: { ...(prev.secondaryCityLabels ?? {}), [id]: { ...(prev.secondaryCityLabels?.[id] ?? {}), ...patch } },
    }));
  }, []);

  const handleSecondaryCityLabelReset = useCallback((id: string) => {
    setOverrides((prev) => {
      const labels = { ...(prev.secondaryCityLabels ?? {}) };
      delete labels[id];
      return { ...prev, secondaryCityLabels: labels };
    });
  }, []);

  const handleDeptLabelMove = useCallback((code: string, lat: number, lng: number) => {
    setOverrides((prev) => ({
      ...prev,
      depts: { ...prev.depts, [code]: { ...prev.depts[code], labelLat: lat, labelLng: lng } },
    }));
  }, []);

  const handleCityLabelMove = useCallback((lat: number, lng: number) => {
    setOverrides((prev) => ({ ...prev, cityLabel: { ...prev.cityLabel, lat, lng } }));
  }, []);

  const handleResetAll = useCallback(() => {
    setOverrides(emptyOverrides());
    setSelectedElement(null);
  }, []);

  const handleDeptToggleVisibility = useCallback((code: string) => {
    setConfig((prev) => {
      if (!prev || code === prev.departmentCode) return prev;
      const hidden = prev.hiddenDeptCodes ?? [];
      const next = hidden.includes(code) ? hidden.filter((c) => c !== code) : [...hidden, code];
      return { ...prev, hiddenDeptCodes: next };
    });
  }, []);

  const handleFullReset = useCallback(() => {
    setConfig(null);
    setConfigSnapshot(null);
    setOverridesSnapshot(emptyOverrides());
    setOverrides(emptyOverrides());
    setNeighborCodes(new Set());
    setSelectedElement(null);
    setError(null);
    setShowBefore(false);
    setBottomTab('communes');
    setResetKey((k) => k + 1);
  }, []);

  const hasOverrides =
    Object.keys(overrides.depts).length > 0 ||
    Object.keys(overrides.cityLabel).length > 0 ||
    Object.values(overrides.extraZoneLabels ?? {}).some((l) => Object.keys(l).length > 0);

  // What to display on the map — snapshot when toggled to "avant"
  const displayConfig = showBefore ? configSnapshot : config;
  const displayOverrides = showBefore ? overridesSnapshot : overrides;

  const tabs: { id: BottomTab; label: string }[] = [
    { id: 'communes', label: 'Communes' },
    { id: 'export', label: 'Export' },
    { id: 'batch', label: 'Batch' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900">
      <ControlPanel
        key={resetKey}
        onGenerate={handleGenerate}
        onDeptOverrideChange={handleDeptOverrideChange}
        onExtraZonesChange={handleExtraZonesChange}
        onReset={handleFullReset}
        config={config}
        loading={loading}
        error={error}
        visibleDeptCodes={config ? [config.departmentCode, ...[...neighborCodes]] : []}
      />

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex-1 relative" ref={mapContainerRef}>
          {!config && !loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div className="text-center text-slate-500 max-w-sm">
                <div className="text-6xl mb-4 opacity-30">🗺️</div>
                <p className="text-lg font-semibold text-slate-400">Saisissez une ville</p>
                <p className="text-sm mt-1">Entrez une ville française et cliquez sur "Générer"</p>
              </div>
            </div>
          )}

          {config && (
            <div className="absolute top-2 left-2 z-[1001] flex items-center gap-2 pointer-events-none">
              <div className="bg-slate-900/80 backdrop-blur-sm text-slate-400 text-[10px] px-2.5 py-1 rounded-full border border-slate-700">
                Cliquer pour éditer · Glisser les labels · ✛ pour déplacer la ZI
              </div>

              {/* Before/After toggle */}
              <div className="pointer-events-auto flex border border-slate-600 rounded-lg overflow-hidden backdrop-blur-sm">
                <button onClick={() => setShowBefore(true)}
                  className={`px-2.5 py-1 text-[10px] font-semibold transition-colors ${showBefore ? 'bg-slate-300 text-slate-900' : 'bg-slate-900/80 text-slate-400 hover:text-slate-200'}`}>
                  Avant
                </button>
                <button onClick={() => setShowBefore(false)}
                  className={`px-2.5 py-1 text-[10px] font-semibold transition-colors ${!showBefore ? 'bg-orange-500 text-white' : 'bg-slate-900/80 text-slate-400 hover:text-slate-200'}`}>
                  Après
                </button>
              </div>

              {config && !showBefore && (
                <button
                  onClick={() => setDeptToggleMode((m) => !m)}
                  className={`pointer-events-auto backdrop-blur-sm text-[10px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                    deptToggleMode
                      ? 'bg-orange-500/20 border-orange-500/60 text-orange-300'
                      : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {deptToggleMode ? '👁 Masquer/Afficher' : '👁 Masquer depts'}
                </button>
              )}

              {hasOverrides && !showBefore && (
                <button onClick={handleResetAll}
                  className="pointer-events-auto bg-slate-900/80 backdrop-blur-sm text-orange-400 text-[10px] px-2.5 py-1 rounded-full border border-orange-500/40 hover:bg-orange-500/10 transition-colors cursor-pointer">
                  ↺ Réinitialiser tout
                </button>
              )}
            </div>
          )}

          {/* "Avant" mode indicator stripe */}
          {showBefore && config && (
            <div className="absolute top-0 left-0 right-0 z-[1000] h-1 bg-slate-400/60 pointer-events-none" />
          )}

          <div className="w-full h-full">
            <LeafletMap
              ref={mapRef}
              config={displayConfig}
              geojson={geojson}
              overrides={displayOverrides}
              onNeighborCodesChange={setNeighborCodes}
              onElementSelect={showBefore || deptToggleMode ? undefined : setSelectedElement}
              deptToggleMode={deptToggleMode && !showBefore}
              onDeptToggleVisibility={deptToggleMode && !showBefore ? handleDeptToggleVisibility : undefined}
              onDeptLabelMove={showBefore ? undefined : handleDeptLabelMove}
              onCityLabelMove={showBefore ? undefined : handleCityLabelMove}
              onZiCenterMove={showBefore ? undefined : handleZiCenterMove}
              onExtraZoneCenterMove={showBefore ? undefined : handleExtraZoneCenterMove}
              onExtraZoneLabelMove={showBefore ? undefined : handleExtraZoneLabelMove}
              onSecondaryCityLabelMove={showBefore ? undefined : handleSecondaryCityLabelMove}
            />
          </div>

          {selectedElement && config && (
            <ElementEditPanel
              selection={selectedElement}
              overrides={overrides}
              style={config.style}
              containerRect={mapContainerRect}
              extraZones={config.extraZones}
              onUpdate={handleOverrideUpdate}
              onStyleUpdate={handleStyleUpdate}
              onExtraZoneStyleUpdate={handleExtraZoneStyleUpdate}
              onExtraZoneLabelUpdate={handleExtraZoneLabelUpdate}
              onExtraZoneLabelReset={handleExtraZoneLabelReset}
              onSecondaryCityLabelUpdate={handleSecondaryCityLabelUpdate}
              onSecondaryCityLabelReset={handleSecondaryCityLabelReset}
              onClose={() => setSelectedElement(null)}
            />
          )}
        </div>

        <aside className="h-64 border-t border-slate-700 bg-slate-800 flex flex-col flex-shrink-0">
          <div className="flex border-b border-slate-700">
            {tabs.map((t) => (
              <button key={t.id} type="button" onClick={() => setBottomTab(t.id)}
                className={`px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${bottomTab === t.id ? 'text-orange-400 border-b-2 border-orange-400' : 'text-slate-400 hover:text-slate-200'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {bottomTab === 'communes' && <CommunesList config={config} />}
            {bottomTab === 'export' && (
              <ExportButtons config={config} geojson={geojson} neighborCodes={neighborCodes} overrides={overrides} />
            )}
            {bottomTab === 'batch' && <BatchMode geojson={geojson} />}
          </div>
        </aside>
      </main>

      {/* Right panel — 4 Variants always visible */}
      <aside className="w-72 bg-slate-800 border-l border-slate-700 flex flex-col overflow-hidden flex-shrink-0">
        <div className="p-3 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-sm font-bold text-slate-200">4 Variantes</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">Profils structurels · appliquer ou exporter</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <VariantsTab config={config} geojson={geojson} onApply={handleApplyVariant} />
        </div>
      </aside>
    </div>
  );
}
