'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createBoard,
  deleteBoardWithAssets,
  getBoardById,
  listBoardsByStudent,
  renameBoard,
} from '@/lib/supabase/boards';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { createEmptySceneData, generateId } from '@/lib/utils';
import type { BoardRecord, BoardSummary, StudentName } from '@/types/board';

function sortBoardsDesc(boards: BoardSummary[]): BoardSummary[] {
  return [...boards].sort(
    (a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)
  );
}

export function useBoards(student: StudentName, requestedBoardId: string | null) {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [activeBoard, setActiveBoard] = useState<BoardRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingList, setLoadingList] = useState(true);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configured = isSupabaseConfigured();

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoadingList(true);
      setError(null);

      if (!configured) {
        const now = new Date().toISOString();
        const demoBoard: BoardRecord = {
          id: `local-${student.toLowerCase()}`,
          student_name: student,
          title: `${student}'s Demo Board`,
          created_at: now,
          updated_at: now,
          scene_data: createEmptySceneData(),
        };
        if (!cancelled) {
          setBoards([
            {
              id: demoBoard.id,
              student_name: demoBoard.student_name,
              title: demoBoard.title,
              created_at: demoBoard.created_at,
              updated_at: demoBoard.updated_at,
            },
          ]);
          setActiveBoard(demoBoard);
          setLoadingList(false);
        }
        return;
      }

      try {
        const list = sortBoardsDesc(await listBoardsByStudent(student));
        if (cancelled) return;

        if (list.length === 0) {
          const initial = await createBoard(student, `${student}'s First Board`);
          if (cancelled) return;
          setBoards([
            {
              id: initial.id,
              student_name: initial.student_name,
              title: initial.title,
              created_at: initial.created_at,
              updated_at: initial.updated_at,
            },
          ]);
          setActiveBoard(initial);
          setLoadingList(false);
          return;
        }

        setBoards(list);
        const targetId =
          requestedBoardId && list.some((b) => b.id === requestedBoardId)
            ? requestedBoardId
            : list[0].id;

        setLoadingBoard(true);
        const full = await getBoardById(targetId);
        if (!cancelled) {
          setActiveBoard(full);
          setLoadingBoard(false);
          setLoadingList(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load workspace.');
          setLoadingList(false);
          setLoadingBoard(false);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [configured, requestedBoardId, student]);

  const selectBoard = useCallback(
    async (boardId: string) => {
      if (activeBoard?.id === boardId) return;
      if (!configured) return;

      setLoadingBoard(true);
      setError(null);
      try {
        const record = await getBoardById(boardId);
        if (record) {
          setActiveBoard(record);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to switch board.');
      } finally {
        setLoadingBoard(false);
      }
    },
    [activeBoard?.id, configured]
  );

  const createNewBoard = useCallback(
    async (title?: string): Promise<BoardRecord | null> => {
      const boardTitle = title?.trim() || `Session ${boards.length + 1}`;
      if (!configured) {
        const now = new Date().toISOString();
        const local: BoardRecord = {
          id: `local-${generateId()}`,
          student_name: student,
          title: boardTitle,
          created_at: now,
          updated_at: now,
          scene_data: createEmptySceneData(),
        };
        setBoards((prev) =>
          sortBoardsDesc([
            {
              id: local.id,
              student_name: local.student_name,
              title: local.title,
              created_at: local.created_at,
              updated_at: local.updated_at,
            },
            ...prev,
          ])
        );
        setActiveBoard(local);
        return local;
      }

      setError(null);
      const created = await createBoard(student, boardTitle);
      setBoards((prev) =>
        sortBoardsDesc([
          {
            id: created.id,
            student_name: created.student_name,
            title: created.title,
            created_at: created.created_at,
            updated_at: created.updated_at,
          },
          ...prev,
        ])
      );
      setActiveBoard(created);
      return created;
    },
    [boards.length, configured, student]
  );

  const renameBoardTitle = useCallback(
    async (boardId: string, nextTitle: string) => {
      const clean = nextTitle.trim() || 'Untitled Board';
      const optimisticTime = new Date().toISOString();

      setBoards((prev) =>
        sortBoardsDesc(
          prev.map((b) =>
            b.id === boardId ? { ...b, title: clean, updated_at: optimisticTime } : b
          )
        )
      );
      setActiveBoard((prev) =>
        prev && prev.id === boardId
          ? { ...prev, title: clean, updated_at: optimisticTime }
          : prev
      );

      if (!configured) return;
      const savedAt = await renameBoard(boardId, clean);
      setBoards((prev) =>
        sortBoardsDesc(
          prev.map((b) => (b.id === boardId ? { ...b, updated_at: savedAt } : b))
        )
      );
    },
    [configured]
  );

  const deleteBoard = useCallback(
    async (boardId: string) => {
      if (configured) {
        await deleteBoardWithAssets(boardId);
      }

      let nextBoardToOpen: string | null = null;
      setBoards((prev) => {
        const remaining = prev.filter((b) => b.id !== boardId);
        if (activeBoard?.id === boardId && remaining.length > 0) {
          nextBoardToOpen = remaining[0].id;
        }
        return remaining;
      });

      if (activeBoard?.id === boardId) {
        if (nextBoardToOpen) {
          if (configured) {
            setLoadingBoard(true);
            const nextRecord = await getBoardById(nextBoardToOpen);
            setActiveBoard(nextRecord);
            setLoadingBoard(false);
          }
        } else {
          const fresh = await createNewBoard(`${student}'s Board`);
          setActiveBoard(fresh);
        }
      }
    },
    [activeBoard?.id, configured, createNewBoard, student]
  );

  const markBoardSaved = useCallback((boardId: string, updatedAt: string) => {
    setBoards((prev) =>
      sortBoardsDesc(
        prev.map((b) => (b.id === boardId ? { ...b, updated_at: updatedAt } : b))
      )
    );
    setActiveBoard((prev) =>
      prev && prev.id === boardId ? { ...prev, updated_at: updatedAt } : prev
    );
  }, []);

  const filteredBoards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return boards;
    return boards.filter((b) => b.title.toLowerCase().includes(q));
  }, [boards, searchQuery]);

  return {
    boards,
    filteredBoards,
    activeBoard,
    searchQuery,
    setSearchQuery,
    loadingList,
    loadingBoard,
    error,
    configured,
    selectBoard,
    createNewBoard,
    renameBoardTitle,
    deleteBoard,
    markBoardSaved,
  };
}
