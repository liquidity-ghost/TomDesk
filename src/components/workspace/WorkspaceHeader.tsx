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
    <header className="relative z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 sm:px-4">
      {/* Left: Sidebar toggle + Brand + Student Workspace Tabs */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          title={sidebarOpen ? 'Hide boards sidebar' : 'Show boards sidebar'}
          aria-label={sidebarOpen ? 'Hide boards sidebar' : 'Show boards sidebar'}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
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
          className="hidden items-center gap-2 rounded-lg px-1.5 py-1 text-slate-900 transition-colors hover:bg-slate-50 md:flex"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
            <PenTool className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-bold tracking-tight">TomDesk</span>
        </Link>

        <div className="hidden h-5 w-px bg-slate-200 md:block" />

        {/* Student Navigation Pills */}
        <nav
          aria-label="Student workspaces"
          className="flex items-center rounded-xl bg-slate-100/90 p-1"
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
                    ? meta.activeNavClass
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {name}
              </Link>
            );
          })}
        </nav>

        {/* Active Board Title */}
        <div className="hidden min-w-0 items-center lg:flex">
          <span className="mr-2 text-slate-300">/</span>
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
              className="w-52 rounded-lg border border-indigo-400 bg-white px-2 py-1 text-sm font-medium text-slate-900 focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onDoubleClick={() => setEditingTitle(true)}
              title="Double-click to rename board"
              className="max-w-[220px] truncate rounded-lg px-2 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              {boardTitle}
            </button>
          )}
        </div>
      </div>

      {/* Right: Live Presence + Sync Badge + Export + Lock */}
      <div className="flex shrink-0 items-center gap-2">
        {isLive && (
          <div
            title={`${peerCount} participants connected in real time`}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </div>
        )}

        {/* Sync Status Badge */}
        <div
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
            syncStatus === 'saved' &&
              'border-slate-200 bg-slate-50 text-slate-600',
            syncStatus === 'saving' &&
              'border-indigo-200 bg-indigo-50 text-indigo-700',
            (syncStatus === 'offline' || syncStatus === 'error') &&
              'border-amber-200 bg-amber-50 text-amber-800'
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
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="hidden sm:inline">Saving...</span>
            </>
          )}
          {(syncStatus === 'offline' || syncStatus === 'error') && (
            <>
              <CloudOff className="h-3.5 w-3.5 text-amber-600" />
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
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">Export Board</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {exportOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
              <button
                type="button"
                onClick={() => void handleExport('png')}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <FileImage className="h-4 w-4 text-indigo-600" />
                <div>
                  <p className="font-semibold text-slate-800">High-Res PNG</p>
                  <p className="text-[11px] text-slate-400">2x Retina snapshot</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => void handleExport('pdf')}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <FileText className="h-4 w-4 text-rose-600" />
                <div>
                  <p className="font-semibold text-slate-800">Multi-Page PDF</p>
                  <p className="text-[11px] text-slate-400">Each sheet as a page</p>
                </div>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handleLockHub()}
          title="Lock Hub (return to PIN screen)"
          aria-label="Lock Hub"
          className="rounded-xl border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        >
          <Lock className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
