'use client';

import { ArrowDownToLine, ArrowUpToLine, Copy, Lock, Trash2, Unlock } from 'lucide-react';
import { worldToScreen } from '@/lib/canvas/geometry';
import { clamp } from '@/lib/utils';
import type { BBox, Camera, SceneObject } from '@/types/scene';

interface SelectionActionBarProps {
  selectionBBox: BBox | null;
  selectedObjects: SceneObject[];
  camera: Camera;
  viewportWidth: number;
  onToggleLock: () => void;
  onDuplicate: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onDelete: () => void;
}

export function SelectionActionBar({
  selectionBBox,
  selectedObjects,
  camera,
  viewportWidth,
  onToggleLock,
  onDuplicate,
  onBringToFront,
  onSendToBack,
  onDelete,
}: SelectionActionBarProps) {
  if (!selectionBBox || selectedObjects.length === 0) return null;

  const topLeft = worldToScreen(selectionBBox.minX, selectionBBox.minY, camera);
  const bottomRight = worldToScreen(selectionBBox.maxX, selectionBBox.maxY, camera);
  const centerX = (topLeft.x + bottomRight.x) / 2;

  const left = clamp(centerX, 130, Math.max(130, viewportWidth - 130));
  const top = Math.max(14, topLeft.y - 52);

  const allLocked = selectedObjects.every((o) => Boolean(o.locked));

  return (
    <div
      style={{ left, top }}
      className="pointer-events-auto absolute z-30 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-desk-border bg-desk-surface/95 p-1 shadow-lg backdrop-blur-md"
    >
      <button
        type="button"
        onClick={onToggleLock}
        title={allLocked ? 'Unlock selection' : 'Lock selection'}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-desk-heading hover:bg-desk-hover"
      >
        {allLocked ? (
          <>
            <Unlock className="h-3.5 w-3.5 text-desk-accent" />
            <span>Unlock</span>
          </>
        ) : (
          <>
            <Lock className="h-3.5 w-3.5 text-desk-muted" />
            <span>Lock</span>
          </>
        )}
      </button>

      <div className="h-4 w-px bg-desk-border" />

      <button
        type="button"
        onClick={onDuplicate}
        title="Duplicate (Cmd/Ctrl + D)"
        className="rounded-lg p-1.5 text-desk-body hover:bg-desk-hover hover:text-desk-heading"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onBringToFront}
        title="Bring to Front"
        className="rounded-lg p-1.5 text-desk-body hover:bg-desk-hover hover:text-desk-heading"
      >
        <ArrowUpToLine className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onSendToBack}
        title="Send to Back"
        className="rounded-lg p-1.5 text-desk-body hover:bg-desk-hover hover:text-desk-heading"
      >
        <ArrowDownToLine className="h-3.5 w-3.5" />
      </button>

      <div className="h-4 w-px bg-desk-border" />

      <button
        type="button"
        onClick={onDelete}
        title="Delete (Backspace / Del)"
        className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/60"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
