'use client';

import { useState, useRef, useEffect } from 'react';
import {
  ArrowUpRight,
  Circle,
  Eraser,
  FilePlus2,
  FileUp,
  Highlighter,
  Lasso,
  Minus,
  MousePointer2,
  Pen,
  Redo2,
  Scissors,
  Square,
  Undo2,
} from 'lucide-react';
import { PaperTemplateMenu } from './PaperTemplateMenu';
import { cn } from '@/lib/utils';
import {
  HIGHLIGHTER_COLORS,
  HIGHLIGHTER_SIZES,
  PEN_COLORS,
  PEN_SIZES,
  type PaperTemplateType,
  type ShapeKind,
  type SnipMode,
  type ToolType,
} from '@/types/scene';

interface FloatingToolbarProps {
  activeTool: ToolType;
  penColor: string;
  penSize: number;
  highlighterColor: string;
  highlighterSize: number;
  lastShapeTool: ShapeKind;
  snipMode: SnipMode;
  canUndo: boolean;
  canRedo: boolean;
  uploadingPdf: boolean;
  onSelectTool: (tool: ToolType) => void;
  onPenColorChange: (color: string) => void;
  onPenSizeChange: (size: number) => void;
  onHighlighterColorChange: (color: string) => void;
  onHighlighterSizeChange: (size: number) => void;
  onSnipModeChange: (mode: SnipMode) => void;
  onAddPaper: (template: PaperTemplateType) => void;
  onTriggerPdfUpload: () => void;
  onUndo: () => void;
  onRedo: () => void;
}

const SHAPE_TOOLS: Array<{ id: ShapeKind; label: string; shortcut: string; Icon: typeof Square }> = [
  { id: 'line', label: 'Line', shortcut: 'L', Icon: Minus },
  { id: 'arrow', label: 'Arrow', shortcut: 'L', Icon: ArrowUpRight },
  { id: 'rect', label: 'Rectangle', shortcut: 'R', Icon: Square },
  { id: 'ellipse', label: 'Circle', shortcut: 'R', Icon: Circle },
];

export function FloatingToolbar({
  activeTool,
  penColor,
  penSize,
  highlighterColor,
  highlighterSize,
  lastShapeTool,
  snipMode,
  canUndo,
  canRedo,
  uploadingPdf,
  onSelectTool,
  onPenColorChange,
  onPenSizeChange,
  onHighlighterColorChange,
  onHighlighterSizeChange,
  onSnipModeChange,
  onAddPaper,
  onTriggerPdfUpload,
  onUndo,
  onRedo,
}: FloatingToolbarProps) {
  const [paperMenuOpen, setPaperMenuOpen] = useState(false);
  const paperPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!paperMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        paperPopoverRef.current &&
        !paperPopoverRef.current.contains(e.target as Node)
      ) {
        setPaperMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [paperMenuOpen]);

  const isShapeActive =
    activeTool === 'line' ||
    activeTool === 'arrow' ||
    activeTool === 'rect' ||
    activeTool === 'ellipse';

  const ActiveShapeMeta =
    SHAPE_TOOLS.find((s) => s.id === (isShapeActive ? activeTool : lastShapeTool)) ??
    SHAPE_TOOLS[2];

  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-2.5">
      {/* Contextual Sub-Bar */}
      {(activeTool === 'pen' ||
        activeTool === 'highlighter' ||
        isShapeActive ||
        activeTool === 'snip') && (
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/90 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-md">
          {(activeTool === 'pen' || isShapeActive) && (
            <>
              {isShapeActive && (
                <>
                  <div className="flex items-center gap-1 pr-1">
                    {SHAPE_TOOLS.map(({ id, label, Icon }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSelectTool(id)}
                        title={label}
                        className={cn(
                          'rounded-lg p-1.5 transition-colors',
                          activeTool === id
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                  <div className="h-5 w-px bg-slate-200" />
                </>
              )}

              <div className="flex items-center gap-1.5">
                {PEN_COLORS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    title={preset.name}
                    aria-label={preset.name}
                    onClick={() => onPenColorChange(preset.value)}
                    className={cn(
                      'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                      penColor === preset.value
                        ? 'scale-110 border-indigo-500 ring-2 ring-indigo-500/25'
                        : 'border-white shadow-sm'
                    )}
                    style={{ backgroundColor: preset.value }}
                  />
                ))}
              </div>

              <div className="h-5 w-px bg-slate-200" />

              <div className="flex items-center gap-1">
                {PEN_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    title={`Stroke ${size}px`}
                    aria-label={`Stroke thickness ${size}px`}
                    onClick={() => onPenSizeChange(size)}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                      penSize === size
                        ? 'bg-indigo-50 ring-1 ring-indigo-300'
                        : 'hover:bg-slate-100'
                    )}
                  >
                    <span
                      className="rounded-full"
                      style={{
                        width: Math.max(4, Math.min(16, size * 1.35)),
                        height: Math.max(4, Math.min(16, size * 1.35)),
                        backgroundColor: penColor,
                      }}
                    />
                  </button>
                ))}
              </div>
              {isShapeActive && (
                <span className="hidden pl-1 text-[11px] font-medium text-slate-400 sm:inline">
                  Hold Shift to snap
                </span>
              )}
            </>
          )}

          {activeTool === 'highlighter' && (
            <>
              <div className="flex items-center gap-1.5">
                {HIGHLIGHTER_COLORS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    title={preset.name}
                    aria-label={preset.name}
                    onClick={() => onHighlighterColorChange(preset.value)}
                    className={cn(
                      'h-6 w-6 rounded-full border-2 transition-transform hover:scale-110',
                      highlighterColor === preset.value
                        ? 'scale-110 border-indigo-500 ring-2 ring-indigo-500/25'
                        : 'border-white shadow-sm'
                    )}
                    style={{ backgroundColor: preset.value }}
                  />
                ))}
              </div>
              <div className="h-5 w-px bg-slate-200" />
              <div className="flex items-center gap-1">
                {HIGHLIGHTER_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    title={`Width ${size}px`}
                    onClick={() => onHighlighterSizeChange(size)}
                    className={cn(
                      'flex h-7 w-8 items-center justify-center rounded-lg transition-colors',
                      highlighterSize === size
                        ? 'bg-indigo-50 ring-1 ring-indigo-300'
                        : 'hover:bg-slate-100'
                    )}
                  >
                    <span
                      className="rounded-sm opacity-75"
                      style={{
                        width: 16,
                        height: Math.round(size * 0.45),
                        backgroundColor: highlighterColor,
                      }}
                    />
                  </button>
                ))}
              </div>
            </>
          )}

          {activeTool === 'snip' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSnipModeChange('rect')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                  snipMode === 'rect'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                <Square className="h-3.5 w-3.5" />
                Box Crop
              </button>
              <button
                type="button"
                onClick={() => onSnipModeChange('lasso')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors',
                  snipMode === 'lasso'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                )}
              >
                <Lasso className="h-3.5 w-3.5" />
                Freehand Lasso
              </button>
              <span className="hidden pl-1 text-xs text-slate-400 sm:inline">
                Drag around PDF + ink to snip &amp; copy
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Floating Dock */}
      <div className="pointer-events-auto relative flex items-center gap-1 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-xl shadow-slate-900/10 backdrop-blur-md">
        <ToolButton
          active={activeTool === 'select'}
          label="Select / Transform"
          shortcut="V"
          onClick={() => onSelectTool('select')}
          icon={<MousePointer2 className="h-4 w-4" />}
        />
        <ToolButton
          active={activeTool === 'pen'}
          label="Pen"
          shortcut="P"
          onClick={() => onSelectTool('pen')}
          icon={<Pen className="h-4 w-4" />}
        />
        <ToolButton
          active={activeTool === 'highlighter'}
          label="Highlighter"
          shortcut="H"
          onClick={() => onSelectTool('highlighter')}
          icon={<Highlighter className="h-4 w-4" />}
        />
        <ToolButton
          active={activeTool === 'eraser'}
          label="Stroke Eraser"
          shortcut="E"
          onClick={() => onSelectTool('eraser')}
          icon={<Eraser className="h-4 w-4" />}
        />
        <ToolButton
          active={isShapeActive}
          label="Shapes & Lines"
          shortcut="R / L"
          onClick={() => onSelectTool(lastShapeTool)}
          icon={<ActiveShapeMeta.Icon className="h-4 w-4" />}
        />
        <ToolButton
          active={activeTool === 'snip'}
          label="Visual Area Snip"
          shortcut="S"
          accentClass="bg-sky-600 text-white shadow-sm"
          onClick={() => onSelectTool('snip')}
          icon={<Scissors className="h-4 w-4" />}
        />

        <div className="mx-1 h-6 w-px bg-slate-200" />

        {/* + Add Paper Dropdown */}
        <div ref={paperPopoverRef} className="relative">
          {paperMenuOpen && (
            <div className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2">
              <PaperTemplateMenu
                onSelect={onAddPaper}
                onClose={() => setPaperMenuOpen(false)}
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => setPaperMenuOpen((prev) => !prev)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors',
              paperMenuOpen
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-700 hover:bg-slate-100'
            )}
          >
            <FilePlus2 className="h-4 w-4 text-indigo-600" />
            <span className="hidden sm:inline">+ Add Paper</span>
          </button>
        </div>

        {/* Upload PDF */}
        <button
          type="button"
          onClick={onTriggerPdfUpload}
          disabled={uploadingPdf}
          title="Upload PDF (or drag & drop PDF onto canvas)"
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
        >
          <FileUp className="h-4 w-4 text-rose-600" />
          <span className="hidden sm:inline">
            {uploadingPdf ? 'Loading PDF...' : 'PDF'}
          </span>
        </button>

        <div className="mx-1 h-6 w-px bg-slate-200" />

        {/* Undo / Redo */}
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Cmd/Ctrl + Z)"
          aria-label="Undo"
          className="rounded-xl p-2 text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Cmd/Ctrl + Shift + Z)"
          aria-label="Redo"
          className="rounded-xl p-2 text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface ToolButtonProps {
  active: boolean;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
  accentClass?: string;
  onClick: () => void;
}

function ToolButton({
  active,
  label,
  shortcut,
  icon,
  accentClass = 'bg-indigo-600 text-white shadow-sm',
  onClick,
}: ToolButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} (${shortcut})`}
      aria-label={`${label} (${shortcut})`}
      aria-pressed={active}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-xl transition-all sm:w-10',
        active
          ? accentClass
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      )}
    >
      {icon}
      <span
        className={cn(
          'pointer-events-none absolute bottom-0.5 right-1 hidden text-[8px] font-bold sm:block',
          active ? 'text-white/75' : 'text-slate-400'
        )}
      >
        {shortcut.length <= 1 ? shortcut : ''}
      </span>
    </button>
  );
}
