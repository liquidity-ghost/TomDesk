'use client';

import { useState, useRef, useEffect } from 'react';
import {
  ArrowUpRight,
  Circle,
  Eraser,
  FilePlus2,
  Highlighter,
  ImagePlus,
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
  uploadingMedia: boolean;
  onSelectTool: (tool: ToolType) => void;
  onPenColorChange: (color: string) => void;
  onPenSizeChange: (size: number) => void;
  onHighlighterColorChange: (color: string) => void;
  onHighlighterSizeChange: (size: number) => void;
  onSnipModeChange: (mode: SnipMode) => void;
  onAddPaper: (template: PaperTemplateType) => void;
  onTriggerMediaUpload: () => void;
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
  uploadingMedia,
  onSelectTool,
  onPenColorChange,
  onPenSizeChange,
  onHighlighterColorChange,
  onHighlighterSizeChange,
  onSnipModeChange,
  onAddPaper,
  onTriggerMediaUpload,
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
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-desk-border bg-desk-surface/95 px-3 py-2 shadow-lg backdrop-blur-md">
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
                            ? 'bg-desk-primary text-desk-primary-fg'
                            : 'text-desk-muted hover:bg-desk-hover hover:text-desk-heading'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                  <div className="h-5 w-px bg-desk-border" />
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
                        ? 'scale-110 border-desk-primary ring-2 ring-desk-primary/30'
                        : 'border-desk-border-strong shadow-sm'
                    )}
                    style={{ backgroundColor: preset.value }}
                  />
                ))}
              </div>

              <div className="h-5 w-px bg-desk-border" />

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
                        ? 'bg-desk-accent-soft ring-1 ring-desk-accent/60'
                        : 'hover:bg-desk-hover'
                    )}
                  >
                    <span
                      className="rounded-full ring-1 ring-white/25"
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
                <span className="hidden pl-1 text-[11px] font-medium text-desk-muted sm:inline">
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
                        ? 'scale-110 border-desk-primary ring-2 ring-desk-primary/30'
                        : 'border-desk-border-strong shadow-sm'
                    )}
                    style={{ backgroundColor: preset.value }}
                  />
                ))}
              </div>
              <div className="h-5 w-px bg-desk-border" />
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
                        ? 'bg-desk-accent-soft ring-1 ring-desk-accent/60'
                        : 'hover:bg-desk-hover'
                    )}
                  >
                    <span
                      className="rounded-sm opacity-80"
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
                    ? 'bg-desk-accent text-desk-accent-fg'
                    : 'text-desk-muted hover:bg-desk-hover hover:text-desk-heading'
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
                    ? 'bg-desk-accent text-desk-accent-fg'
                    : 'text-desk-muted hover:bg-desk-hover hover:text-desk-heading'
                )}
              >
                <Lasso className="h-3.5 w-3.5" />
                Freehand Lasso
              </button>
              <span className="hidden pl-1 text-xs text-desk-muted sm:inline">
                Drag over part of a page to snip &amp; copy
              </span>
            </div>
          )}
        </div>
      )}

      {/* Main Floating Dock */}
      <div className="pointer-events-auto relative flex items-center gap-1 rounded-2xl border border-desk-border bg-desk-surface/95 p-1.5 shadow-xl backdrop-blur-md">
        <ToolButton
          active={activeTool === 'select'}
          label="Select / Move"
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
          label="Eraser"
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
          label="Snip"
          shortcut="S"
          accentClass="bg-desk-accent text-desk-accent-fg shadow-sm"
          onClick={() => onSelectTool('snip')}
          icon={<Scissors className="h-4 w-4" />}
        />

        <div className="mx-1 h-6 w-px bg-desk-border" />

        {/* Add Paper Dropdown */}
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
                ? 'bg-desk-accent-soft text-desk-heading'
                : 'text-desk-heading hover:bg-desk-hover'
            )}
          >
            <FilePlus2 className="h-4 w-4 text-desk-accent" />
            <span className="hidden sm:inline">Add Paper</span>
          </button>
        </div>

        {/* Add PDF / Photo */}
        <button
          type="button"
          onClick={onTriggerMediaUpload}
          disabled={uploadingMedia}
          title="Add PDF or Photo (or drag & drop / Cmd+V to paste)"
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-desk-heading transition-colors hover:bg-desk-hover disabled:opacity-50"
        >
          <ImagePlus className="h-4 w-4 text-desk-accent" />
          <span className="hidden sm:inline">
            {uploadingMedia ? 'Adding...' : 'Add PDF / Photo'}
          </span>
        </button>

        <div className="mx-1 h-6 w-px bg-desk-border" />

        {/* Undo / Redo */}
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Cmd/Ctrl + Z)"
          aria-label="Undo"
          className="rounded-xl p-2 text-desk-muted transition-colors hover:bg-desk-hover hover:text-desk-heading disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Cmd/Ctrl + Shift + Z)"
          aria-label="Redo"
          className="rounded-xl p-2 text-desk-muted transition-colors hover:bg-desk-hover hover:text-desk-heading disabled:cursor-not-allowed disabled:opacity-35"
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
  accentClass = 'bg-desk-primary text-desk-primary-fg shadow-sm',
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
          : 'text-desk-muted hover:bg-desk-hover hover:text-desk-heading'
      )}
    >
      {icon}
      <span
        className={cn(
          'pointer-events-none absolute bottom-0.5 right-1 hidden text-[8px] font-bold sm:block',
          active ? 'opacity-80' : 'text-desk-muted/80'
        )}
      >
        {shortcut.length <= 1 ? shortcut : ''}
      </span>
    </button>
  );
}
