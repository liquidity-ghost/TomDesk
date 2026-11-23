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
  ['S', 'Snip area'],
  ['Cmd/Ctrl + V', 'Paste photo / screenshot'],
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
        <div className="w-80 rounded-2xl border border-desk-border bg-desk-surface/95 p-4 shadow-2xl backdrop-blur-md">
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-desk-heading">
              Shortcuts &amp; Controls
            </h3>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="rounded-md p-1 text-desk-muted hover:bg-desk-hover hover:text-desk-heading"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <dl className="space-y-1.5 text-xs">
            {SHORTCUTS.map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <dt className="text-desk-body">{desc}</dt>
                <dd className="shrink-0 rounded bg-desk-surface-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-desk-heading ring-1 ring-desk-border">
                  {key}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="flex items-center gap-0.5 rounded-xl border border-desk-border bg-desk-surface/95 p-1 shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={onZoomOut}
          title="Zoom out"
          aria-label="Zoom out"
          className="rounded-lg p-1.5 text-desk-muted hover:bg-desk-hover hover:text-desk-heading"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onResetZoom}
          title="Reset zoom to 100%"
          className="min-w-[48px] rounded-lg px-2 py-1 text-xs font-semibold tabular-nums text-desk-heading hover:bg-desk-hover"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={onZoomIn}
          title="Zoom in"
          aria-label="Zoom in"
          className="rounded-lg p-1.5 text-desk-muted hover:bg-desk-hover hover:text-desk-heading"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <div className="mx-0.5 h-4 w-px bg-desk-border" />
        <button
          type="button"
          onClick={onFitContent}
          title="Fit page in view"
          aria-label="Fit content"
          className="rounded-lg p-1.5 text-desk-muted hover:bg-desk-hover hover:text-desk-heading"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setShowHelp((prev) => !prev)}
          title="Keyboard shortcuts"
          aria-label="Keyboard shortcuts"
          className="rounded-lg p-1.5 text-desk-muted hover:bg-desk-hover hover:text-desk-heading"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
