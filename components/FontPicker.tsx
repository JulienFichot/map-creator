'use client';

import { useEffect, useRef, useState } from 'react';
import { FONTS, getFontByStack, loadGoogleFont, loadGoogleFontByName, loadLocalFont, getCustomFonts } from '@/lib/fonts';
import type { CustomFont } from '@/lib/fonts';

interface FontPickerProps {
  value: string;
  onChange: (stack: string) => void;
}

export function FontPicker({ value, onChange }: FontPickerProps) {
  const selected = getFontByStack(value);
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [googleInput, setGoogleInput] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    FONTS.forEach((f) => { if (f.googleParam) loadGoogleFont(f); });
    setCustomFonts(getCustomFonts());
  }, []);

  async function handleGoogleLoad() {
    const name = googleInput.trim();
    if (!name) return;
    setLoading('google');
    setError(null);
    try {
      const font = await loadGoogleFontByName(name);
      setCustomFonts(getCustomFonts());
      onChange(font.stack);
    } catch {
      setError(`Impossible de charger "${name}"`);
    } finally {
      setLoading(null);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading('file');
    setError(null);
    try {
      const font = await loadLocalFont(file);
      setCustomFonts(getCustomFonts());
      onChange(font.stack);
    } catch {
      setError('Impossible de charger ce fichier');
    } finally {
      setLoading(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const allFonts = [...FONTS, ...customFonts];

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-slate-300">Police de caractères</label>

      {/* Font grid */}
      <div className="grid grid-cols-2 gap-1.5">
        {allFonts.map((font) => {
          const isSelected = font.stack === selected.stack;
          return (
            <button
              key={font.id}
              type="button"
              onClick={() => {
                if ('googleParam' in font && font.googleParam) loadGoogleFont(font as typeof FONTS[0]);
                onChange(font.stack);
              }}
              className={`px-2.5 py-2 rounded-lg text-sm text-left transition-all border ${
                isSelected
                  ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                  : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:border-slate-500'
              }`}
              style={{ fontFamily: font.stack }}
            >
              <span className="text-sm leading-none truncate block">{font.label}</span>
            </button>
          );
        })}
      </div>

      {/* Load Google Font by name */}
      <div className="border-t border-slate-700 pt-2 flex flex-col gap-1.5">
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Google Font personnalisée</p>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={googleInput}
            onChange={(e) => setGoogleInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleGoogleLoad())}
            placeholder="Ex : Inter, Nunito..."
            className="flex-1 bg-slate-700 border border-slate-600 text-slate-200 placeholder-slate-500 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:border-orange-500"
          />
          <button
            type="button"
            onClick={handleGoogleLoad}
            disabled={loading === 'google' || !googleInput.trim()}
            className="px-3 bg-orange-500/20 border border-orange-500/40 text-orange-400 text-xs font-semibold rounded-lg hover:bg-orange-500/30 transition-colors disabled:opacity-40"
          >
            {loading === 'google' ? '...' : 'Charger'}
          </button>
        </div>
      </div>

      {/* Local font upload */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wide">Police locale (.ttf / .woff2)</p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={loading === 'file'}
          className="w-full py-2 border border-dashed border-slate-600 rounded-lg text-xs text-slate-400 hover:border-orange-500/50 hover:text-slate-300 transition-colors disabled:opacity-40"
        >
          {loading === 'file' ? 'Chargement...' : '+ Importer un fichier de police'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {error && <p className="text-[10px] text-red-400">{error}</p>}
    </div>
  );
}
