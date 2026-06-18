'use client';

import { useRef, useState, useEffect } from 'react';
import { getHistory, pushToHistory, subscribeHistory } from '@/lib/colorHistory';

function isValidHex(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(v);
}

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  const nativeRef = useRef<HTMLInputElement>(null);
  const [hexInput, setHexInput] = useState(value);
  const [history, setHistory] = useState<string[]>([]);

  // Keep hex text in sync when value changes externally (e.g. variant applied)
  useEffect(() => { setHexInput(value); }, [value]);

  // Subscribe to the shared history store — all pickers update in sync
  useEffect(() => {
    setHistory(getHistory());
    return subscribeHistory(() => setHistory(getHistory()));
  }, []);

  // ── Native color picker ──────────────────────────────────────────────────
  // onChange fires on every drag step → live preview immediately.
  // pushToHistory is debounced (500 ms) → only the final color is recorded.
  function handleNativeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setHexInput(v);
    onChange(v);
    pushToHistory(v);
  }

  // ── Hex text input ───────────────────────────────────────────────────────
  function handleHexChange(raw: string) {
    const v = raw.startsWith('#') ? raw : '#' + raw;
    setHexInput(v);
    if (isValidHex(v)) onChange(v);
  }

  function handleHexBlur() {
    if (isValidHex(hexInput)) {
      pushToHistory(hexInput);
    } else {
      setHexInput(value);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs text-slate-300 flex-1 truncate">{label}</label>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={hexInput}
            onChange={(e) => handleHexChange(e.target.value)}
            onBlur={handleHexBlur}
            maxLength={7}
            spellCheck={false}
            className="w-20 bg-slate-700 border border-slate-600 text-slate-200 text-[11px] font-mono px-1.5 py-1 rounded focus:outline-none focus:border-orange-500 uppercase"
          />
          <button
            type="button"
            className="w-7 h-7 rounded border border-slate-500 shadow-inner cursor-pointer flex-shrink-0 hover:scale-110 transition-transform"
            style={{ backgroundColor: isValidHex(value) ? value : '#888' }}
            onClick={() => nativeRef.current?.click()}
            title={value}
          />
          <input
            ref={nativeRef}
            type="color"
            value={isValidHex(value) ? value : '#888888'}
            onChange={handleNativeChange}
            className="sr-only"
          />
        </div>
      </div>

      {history.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5 pl-0.5">
          {history.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => { onChange(c); setHexInput(c); }}
              className={`w-5 h-5 rounded border transition-all hover:scale-110 ${value.toUpperCase() === c ? 'border-orange-400 scale-110' : 'border-slate-600'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
