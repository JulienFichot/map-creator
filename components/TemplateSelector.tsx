'use client';

import { TEMPLATES } from '@/lib/templates';
import type { TemplateId } from '@/lib/types';

interface TemplateSelectorProps {
  selected: TemplateId;
  onChange: (id: TemplateId) => void;
}

export function TemplateSelector({ selected, onChange }: TemplateSelectorProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Template</p>
      <div className="grid grid-cols-1 gap-1.5">
        {TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onChange(tpl.id)}
            className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${
              selected === tpl.id
                ? 'border-orange-500 bg-orange-500/10 text-orange-300'
                : 'border-slate-600 bg-slate-700/50 text-slate-300 hover:border-slate-400'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0 ring-1 ring-white/20"
                style={{ backgroundColor: tpl.style.markerColor }}
              />
              <span className="font-medium">{tpl.label}</span>
            </div>
            <p className="text-slate-400 mt-0.5 text-[10px] leading-tight">{tpl.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
