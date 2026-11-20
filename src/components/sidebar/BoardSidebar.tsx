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
        aria-label={`${student} boards sidebar`}
        className={cn(
          'relative z-20 flex h-full shrink-0 flex-col border-r border-slate-200 bg-white transition-all duration-200 ease-out',
          open ? 'w-[264px]' : 'w-0 overflow-hidden border-r-0'
        )}
      >
        <div className="flex w-[264px] flex-1 flex-col overflow-hidden">
          {/* Top Create & Search Controls */}
          <div className="space-y-2.5 border-b border-slate-100 p-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              New Board
            </button>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={`Search ${student}'s boards...`}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-7 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Board List */}
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="space-y-2 p-1">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-14 animate-pulse rounded-xl bg-slate-100"
                  />
                ))}
              </div>
            ) : boards.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <FileText className="mx-auto h-7 w-7 text-slate-300" />
                <p className="mt-2 text-xs font-medium text-slate-500">
                  {searchQuery
                    ? 'No matching boards found.'
                    : 'No boards yet. Create one above!'}
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
                            ? 'bg-indigo-50/90 text-indigo-950 ring-1 ring-indigo-200/80'
                            : 'text-slate-700 hover:bg-slate-50'
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
                              className="w-full rounded-md border border-indigo-400 bg-white px-1.5 py-0.5 text-sm font-medium text-slate-900 focus:outline-none"
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
                                isActive ? 'text-indigo-950' : 'text-slate-800'
                              )}
                            >
                              {board.title}
                            </p>
                          )}
                          <p className="mt-0.5 text-[11px] text-slate-400">
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
                              title="Rename board"
                              aria-label={`Rename ${board.title}`}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPendingDelete(board);
                              }}
                              title="Delete board"
                              aria-label={`Delete ${board.title}`}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
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

          <div className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
            Double-click any board title to rename
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
