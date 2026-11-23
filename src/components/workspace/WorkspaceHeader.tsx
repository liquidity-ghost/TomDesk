'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  ChevronDown,
  CloudOff,
  Download,
  FileImage,
  FileText,
  Loader2,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  PenTool,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { cn } from '@/lib/utils';
import { STUDENTS, STUDENT_META, type StudentName, type SyncStatus } from '@/types/board';

interface WorkspaceHeaderProps {
  student: StudentName;
  boardTitle: string;
  sidebarOpen: boolean;
  isLive: boolean;
  peerCount: number;
  syncStatus: SyncStatus;
  onToggleSidebar: () => void;
  onBeforeNavigate?: () => Promise<void>;
  onRenameBoard: (nextTitle: string) => Promise<void>;
  onExportPng: () => Promise<void>;
  onExportPdf: () => Promise<void>;
}

export function WorkspaceHeader({
  student,
  boardTitle,
  sidebarOpen,
  isLive,
  peerCount,
  syncStatus,
  onToggleSidebar,
  onBeforeNavigate,
  onRenameBoard,
  onExportPng,
  onExportPdf,
}: WorkspaceHeaderProps) {
  const router = useRouter();
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(boardTitle);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftTitle(boardTitle);
  }, [boardTitle]);

  useEffect(() => {
    if (editingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [editingTitle]);

  useEffect(() => {
    if (!exportOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [exportOpen]);

  async function commitTitle() {
    setEditingTitle(false);
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== boardTitle) {
      await onRenameBoard(trimmed);
    } else {
      setDraftTitle(boardTitle);
    }
  }

  async function handleExport(kind: 'png' | 'pdf') {
    setExportOpen(false);
    setExporting(kind);
    try {
      if (kind === 'png') await onExportPng();
      else await onExportPdf();
    } finally {
      setExporting(null);
    }
  }

  async function handleLockHub() {
    if (onBeforeNavigate) {
      await onBeforeNavigate();
    }
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/pin');
    router.refresh();
  }

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-desk-border bg-desk-surface px-3 sm:px-4">
      {/* Left: Sidebar toggle + Brand + Student Tabs */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          title={sidebarOpen ? 'Hide past lessons' : 'Show past lessons'}
          aria-label={sidebarOpen ? 'Hide past lessons' : 'Show past lessons'}
          className="rounded-lg p-2 text-desk-muted transition-colors hover:bg-desk-hover hover:text-desk-heading"
        >
          {sidebarOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </button>

        <Link
          href="/"
          onClick={() => {
            if (onBeforeNavigate) void onBeforeNavigate();
          }}
          className="hidden items-center gap-2 rounded-lg px-1.5 py-1 text-desk-heading transition-colors hover:bg-desk-hover md:flex"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-desk-primary text-desk-primary-fg shadow-sm">
            <PenTool className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-bold tracking-tight">Tom&apos;s Desk</span>
        </Link>

        <div className="hidden h-5 w-px bg-desk-border md:block" />

        {/* Student Navigation Pills */}
        <nav
          aria-label="Notebooks"
          className="flex items-center rounded-xl bg-desk-surface-muted p-1 ring-1 ring-desk-border"
        >
          {STUDENTS.map((name) => {
            const meta = STUDENT_META[name];
            const active = name === student;
            return (
              <Link
                key={name}
                href={meta.href}
                onClick={() => {
                  if (!active && onBeforeNavigate) void onBeforeNavigate();
                }}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-xs font-semibold transition-all sm:px-3',
                  active
                    ? 'bg-desk-primary text-desk-primary-fg shadow-sm'
                    : 'text-desk-muted hover:text-desk-heading'
                )}
              >
                {name}
              </Link>
            );
          })}
        </nav>

        {/* Active Page Title */}
        <div className="hidden min-w-0 items-center lg:flex">
          <span className="mr-2 text-desk-border-strong">/</span>
          {editingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={() => void commitTitle()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void commitTitle();
                else if (e.key === 'Escape') {
                  setDraftTitle(boardTitle);
                  setEditingTitle(false);
                }
              }}
              className="w-52 rounded-lg border border-desk-primary bg-desk-surface px-2 py-1 text-sm font-medium text-desk-heading focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onDoubleClick={() => setEditingTitle(true)}
              title="Double-click to rename lesson"
              className="max-w-[220px] truncate rounded-lg px-2 py-1 text-sm font-semibold text-desk-heading hover:bg-desk-hover"
            >
              {boardTitle}
            </button>
          )}
        </div>
      </div>

      {/* Right: Live Presence + Sync Badge + Export + Theme Toggle + Lock */}
      <div className="flex shrink-0 items-center gap-2">
        {isLive && (
          <div
            title={`${peerCount} together on this page`}
            className="inline-flex items-center gap-1.5 rounded-full border border-desk-accent/40 bg-desk-accent-soft px-2.5 py-1 text-xs font-semibold text-desk-accent"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-desk-accent opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-desk-accent" />
            </span>
            Live
          </div>
        )}

        {/* Sync Status Badge */}
        <div
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
            syncStatus === 'saved' &&
              'border-desk-border bg-desk-surface-muted text-desk-muted',
            syncStatus === 'saving' &&
              'border-desk-accent/40 bg-desk-accent-soft text-desk-heading',
            (syncStatus === 'offline' || syncStatus === 'error') &&
              'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-200'
          )}
        >
          {syncStatus === 'saved' && (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="hidden sm:inline">Saved</span>
            </>
          )}
          {syncStatus === 'saving' && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-desk-accent" />
              <span className="hidden sm:inline">Saving...</span>
            </>
          )}
          {(syncStatus === 'offline' || syncStatus === 'error') && (
            <>
              <CloudOff className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>Offline — Retrying</span>
            </>
          )}
        </div>

        {/* Export Dropdown */}
        <div ref={exportMenuRef} className="relative">
          <button
            type="button"
            disabled={exporting !== null}
            onClick={() => setExportOpen((prev) => !prev)}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-desk-border bg-desk-surface px-3 text-xs font-semibold text-desk-heading shadow-sm transition-colors hover:border-desk-border-strong hover:bg-desk-hover disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className="h-3.5 w-3.5 text-desk-muted" />
          </button>

          {exportOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl border border-desk-border bg-desk-surface p-1.5 shadow-xl">
              <button
                type="button"
                onClick={() => void handleExport('png')}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-desk-body hover:bg-desk-hover"
              >
                <FileImage className="h-4 w-4 text-desk-heading" />
                <div>
                  <p className="font-semibold text-desk-heading">Save as PNG</p>
                  <p className="text-[11px] text-desk-muted">Crisp page snapshot</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => void handleExport('pdf')}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-desk-body hover:bg-desk-hover"
              >
                <FileText className="h-4 w-4 text-desk-accent" />
                <div>
                  <p className="font-semibold text-desk-heading">Save as PDF</p>
                  <p className="text-[11px] text-desk-muted">Multi-page packet</p>
                </div>
              </button>
            </div>
          )}
        </div>

        <ThemeToggle />

        <button
          type="button"
          onClick={() => void handleLockHub()}
          title="Lock Study Desk"
          aria-label="Lock Study Desk"
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-desk-border bg-desk-surface text-desk-muted transition-colors hover:border-desk-border-strong hover:bg-desk-hover hover:text-desk-heading"
        >
          <Lock className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
