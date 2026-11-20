'use client';

import { useState } from 'react';
import { HelpCircle, Maximize2, Minus, Plus, X } from 'lucide-react';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitContent: () => void;
}

const SHORTCUTS = [
  ['P', 'Pen'],
  ['H', 'Highlighter'],
  ['E', 'Eraser'],
  ['V', 'Select / Move'],
  ['R / L', 'Rectangle / Line'],
  ['S', 'Visual Area Snip'],
  ['Space + Drag', 'Pan canvas'],
  ['Wheel / Pinch', 'Zoom canvas'],
  ['Cmd/Ctrl + Z', 'Undo'],
  ['Cmd/Ctrl + Shift + Z', 'Redo'],
  ['Cmd/Ctrl + D', 'Duplicate selected'],
  ['Delete / Backspace', 'Delete selected'],
];

export function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitContent,
}: ZoomControlsProps) {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 z-30 flex flex-col items-end gap-2">
      {showHelp && (
        <div className="w-72 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-md">
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Shortcuts &amp; Controls
            </h3>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <dl className="space-y-1.5 text-xs">
            {SHORTCUTS.map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <dt className="text-slate-600">{desc}</dt>
                <dd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-700">
                  {key}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="flex items-center gap-0.5 rounded-xl border border-slate-200/90 bg-white/95 p-1 shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={onZoomOut}
          title="Zoom out"
          aria-label="Zoom out"
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onResetZoom}
          title="Reset zoom to 100%"
          className="min-w-[48px] rounded-lg px-2 py-1 text-xs font-semibold tabular-nums text-slate-700 hover:bg-slate-100"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          title="Zoom in"
          aria-label="Zoom in"
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <div className="mx-0.5 h-4 w-px bg-slate-200" />
        <button
          type="button"
          onClick={onFitContent}
          title="Fit all sheets & strokes in view"
          aria-label="Fit content"
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setShowHelp((prev) => !prev)}
          title="Keyboard shortcuts"
          aria-label="Keyboard shortcuts"
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
