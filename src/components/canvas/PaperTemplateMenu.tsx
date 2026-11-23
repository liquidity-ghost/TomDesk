'use client';

import { PAPER_TEMPLATES, type PaperTemplateType } from '@/types/scene';

interface PaperTemplateMenuProps {
  onSelect: (template: PaperTemplateType) => void;
  onClose: () => void;
}

function TemplateThumbnail({ type }: { type: PaperTemplateType }) {
  return (
    <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
      {type === 'blank' && <div className="h-full w-full bg-white" />}
      {type === 'lined' && (
        <svg viewBox="0 0 48 64" className="h-full w-full">
          <line x1="10" y1="0" x2="10" y2="64" stroke="#fda4af" strokeWidth="1" />
          {[14, 22, 30, 38, 46, 54].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="48"
              y2={y}
              stroke="#bfdbfe"
              strokeWidth="1"
            />
          ))}
        </svg>
      )}
      {type === 'graph' && (
        <svg viewBox="0 0 48 64" className="h-full w-full">
          {[8, 16, 24, 32, 40].map((x) => (
            <line
              key={`vx-${x}`}
              x1={x}
              y1="0"
              x2={x}
              y2="64"
              stroke="#cbd5e1"
              strokeWidth="0.75"
            />
          ))}
          {[8, 16, 24, 32, 40, 48, 56].map((y) => (
            <line
              key={`hy-${y}`}
              x1="0"
              y1={y}
              x2="48"
              y2={y}
              stroke="#cbd5e1"
              strokeWidth="0.75"
            />
          ))}
        </svg>
      )}
      {type === 'dot' && (
        <svg viewBox="0 0 48 64" className="h-full w-full">
          {[10, 20, 30, 40, 50].map((y) =>
            [10, 19, 28, 37].map((x) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="#64748b" />
            ))
          )}
        </svg>
      )}
    </div>
  );
}

export function PaperTemplateMenu({ onSelect, onClose }: PaperTemplateMenuProps) {
  return (
    <div
      className="w-72 rounded-2xl border border-desk-border bg-desk-surface/95 p-3 shadow-2xl backdrop-blur-md"
      role="menu"
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-desk-muted">
          Add Paper Sheet
        </span>
        <span className="text-[11px] text-desk-muted">Places side-by-side</span>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {PAPER_TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            onClick={() => {
              onSelect(tpl.id);
              onClose();
            }}
            className="flex items-center gap-3 rounded-xl border border-transparent p-2 text-left transition-colors hover:border-desk-accent/40 hover:bg-desk-hover"
          >
            <TemplateThumbnail type={tpl.id} />
            <div>
              <p className="text-sm font-semibold text-desk-heading">{tpl.label}</p>
              <p className="text-xs text-desk-muted">{tpl.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
