'use client';

import { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import { DeleteBoardDialog } from './DeleteBoardDialog';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { BoardSummary, StudentName } from '@/types/board';

interface BoardSidebarProps {
  student: StudentName;
  open: boolean;
  boards: BoardSummary[];
  activeBoardId: string | null;
  searchQuery: string;
  loading: boolean;
  onSearchChange: (q: string) => void;
  onSelectBoard: (boardId: string) => void;
  onCreateBoard: () => Promise<void>;
  onRenameBoard: (boardId: string, nextTitle: string) => Promise<void>;
  onDeleteBoard: (boardId: string) => Promise<void>;
}

export function BoardSidebar({
  student,
  open,
  boards,
  activeBoardId,
  searchQuery,
  loading,
  onSearchChange,
  onSelectBoard,
  onCreateBoard,
  onRenameBoard,
  onDeleteBoard,
}: BoardSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<BoardSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  function startRename(board: BoardSummary) {
    setEditingId(board.id);
    setDraftTitle(board.title);
  }

  async function commitRename(board: BoardSummary) {
    if (editingId !== board.id) return;
    const trimmed = draftTitle.trim();
    setEditingId(null);
    if (trimmed && trimmed !== board.title) {
      await onRenameBoard(board.id, trimmed);
    }
  }

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      await onCreateBoard();
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      await onDeleteBoard(pendingDelete.id);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <aside
        aria-label={`${student} past lessons`}
        className={cn(
          'relative z-20 flex h-full shrink-0 flex-col border-r border-desk-border bg-desk-surface transition-all duration-200 ease-out',
          open ? 'w-[264px]' : 'w-0 overflow-hidden border-r-0'
        )}
      >
        <div className="flex w-[264px] flex-1 flex-col overflow-hidden">
          {/* Top Heading, Create & Search Controls */}
          <div className="space-y-2.5 border-b border-desk-border p-3">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-desk-muted">
                Past Lessons
              </h2>
              <span className="text-[11px] font-medium text-desk-muted">
                {boards.length} {boards.length === 1 ? 'page' : 'pages'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-desk-primary px-3.5 py-2.5 text-sm font-semibold text-desk-primary-fg shadow-sm transition-colors hover:bg-desk-primary-hover disabled:opacity-60"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              New Page
            </button>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-desk-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={`Search ${student}'s lessons...`}
                className="w-full rounded-lg border border-desk-border bg-desk-surface-muted py-1.5 pl-8 pr-7 text-xs text-desk-body placeholder:text-desk-muted/75 focus:border-desk-primary focus:bg-desk-surface focus:outline-none focus:ring-2 focus:ring-desk-primary/15"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-desk-muted hover:text-desk-heading"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Lesson List */}
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="space-y-2 p-1">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-14 animate-pulse rounded-xl bg-desk-surface-muted"
                  />
                ))}
              </div>
            ) : boards.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <FileText className="mx-auto h-7 w-7 text-desk-muted/50" />
                <p className="mt-2 text-xs font-medium text-desk-muted">
                  {searchQuery
                    ? 'No matching lessons found.'
                    : 'No pages yet — click New Page above to start!'}
                </p>
              </div>
            ) : (
              <ul className="space-y-1">
                {boards.map((board) => {
                  const isActive = board.id === activeBoardId;
                  const isEditing = editingId === board.id;

                  return (
                    <li key={board.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (!isEditing) onSelectBoard(board.id);
                        }}
                        onKeyDown={(e) => {
                          if ((e.key === 'Enter' || e.key === ' ') && !isEditing) {
                            e.preventDefault();
                            onSelectBoard(board.id);
                          }
                        }}
                        className={cn(
                          'group relative flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 transition-colors',
                          isActive
                            ? 'bg-desk-accent-soft text-desk-heading ring-1 ring-desk-accent/40'
                            : 'text-desk-body hover:bg-desk-hover'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          {isEditing ? (
                            <input
                              ref={editInputRef}
                              type="text"
                              value={draftTitle}
                              onChange={(e) => setDraftTitle(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onBlur={() => void commitRename(board)}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') {
                                  void commitRename(board);
                                } else if (e.key === 'Escape') {
                                  setEditingId(null);
                                }
                              }}
                              className="w-full rounded-md border border-desk-primary bg-desk-surface px-1.5 py-0.5 text-sm font-medium text-desk-heading focus:outline-none"
                            />
                          ) : (
                            <p
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                startRename(board);
                              }}
                              title="Double-click to rename"
                              className={cn(
                                'truncate text-sm font-medium',
                                isActive ? 'font-semibold text-desk-heading' : 'text-desk-body'
                              )}
                            >
                              {board.title}
                            </p>
                          )}
                          <p className="mt-0.5 text-[11px] text-desk-muted">
                            Updated {formatRelativeTime(board.updated_at)}
                          </p>
                        </div>

                        {!isEditing && (
                          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                startRename(board);
                              }}
                              title="Rename page"
                              aria-label={`Rename ${board.title}`}
                              className="rounded-md p-1.5 text-desk-muted hover:bg-desk-surface hover:text-desk-heading"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDelete(board);
                              }}
                              title="Delete page"
                              aria-label={`Delete ${board.title}`}
                              className="rounded-md p-1.5 text-desk-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/60 dark:hover:text-rose-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-desk-border px-3 py-2 text-[11px] text-desk-muted">
            Double-click any title to rename
          </div>
        </div>
      </aside>

      <DeleteBoardDialog
        board={pendingDelete}
        deleting={deleting}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void handleConfirmDelete()}
      />
    </>
  );
}
