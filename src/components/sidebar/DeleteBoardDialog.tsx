'use client';

import { useEffect } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import type { BoardSummary } from '@/types/board';

interface DeleteBoardDialogProps {
  board: BoardSummary | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteBoardDialog({
  board,
  deleting,
  onCancel,
  onConfirm,
}: DeleteBoardDialogProps) {
  useEffect(() => {
    if (!board) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [board, deleting, onCancel]);

  if (!board) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-board-title"
      onClick={() => {
        if (!deleting) onCancel();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-desk-border bg-desk-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <button
            type="button"
            disabled={deleting}
            onClick={onCancel}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-desk-muted transition-colors hover:bg-desk-hover hover:text-desk-heading disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2
          id="delete-board-title"
          className="mt-4 text-lg font-semibold text-desk-heading"
        >
          Delete &ldquo;{board.title}&rdquo;?
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-desk-muted">
          This permanently removes this page along with any PDFs, photos, and
          snipped cutouts saved on it. This can&apos;t be undone.
        </p>

        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="rounded-xl border border-desk-border bg-desk-surface px-4 py-2 text-sm font-medium text-desk-body transition-colors hover:bg-desk-hover disabled:opacity-50"
          >
            Keep Page
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onConfirm}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-60"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete Page'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
