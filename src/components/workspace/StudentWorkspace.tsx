'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, X } from 'lucide-react';
import {
  WhiteboardCanvas,
  type WhiteboardCanvasHandle,
} from '@/components/canvas/WhiteboardCanvas';
import { BoardSidebar } from '@/components/sidebar/BoardSidebar';
import { WorkspaceHeader } from './WorkspaceHeader';
import { useBoards } from '@/hooks/useBoards';
import { useRealtimeBoard } from '@/hooks/useRealtimeBoard';
import { exportBoardAsPdf, exportBoardAsPng } from '@/lib/canvas/exporter';
import type { StudentName } from '@/types/board';
import type { SceneData, SceneObject } from '@/types/scene';

interface StudentWorkspaceProps {
  student: StudentName;
}

export function StudentWorkspace({ student }: StudentWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedBoardId = searchParams.get('board');

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [setupDismissed, setSetupDismissed] = useState(false);

  const canvasRef = useRef<WhiteboardCanvasHandle>(null);

  const {
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
  } = useBoards(student, requestedBoardId);

  const {
    peerCount,
    isLive,
    syncStatus,
    scheduleSave,
    flushSaveNow,
    broadcastCursor,
    broadcastLiveStroke,
    broadcastLiveStrokeEnd,
    broadcastScenePatch,
  } = useRealtimeBoard({
    boardId: activeBoard?.id ?? null,
    onRemoteScenePatch: (patch) => canvasRef.current?.applyRemoteScenePatch(patch),
    onRemoteLiveStroke: (payload) => canvasRef.current?.applyRemoteLiveStroke(payload),
    onRemoteLiveStrokeEnd: (payload) =>
      canvasRef.current?.applyRemoteLiveStrokeEnd(payload),
    onRemoteCursor: (payload) => canvasRef.current?.applyRemoteCursor(payload),
    onBoardSaved: markBoardSaved,
  });

  // Keep URL query ?board=<id> synced with active board
  useEffect(() => {
    if (!activeBoard || !configured) return;
    if (requestedBoardId !== activeBoard.id) {
      router.replace(`${pathname}?board=${activeBoard.id}`, { scroll: false });
    }
  }, [activeBoard, configured, pathname, requestedBoardId, router]);

  const handleSelectBoard = useCallback(
    async (boardId: string) => {
      await flushSaveNow();
      await selectBoard(boardId);
    },
    [flushSaveNow, selectBoard]
  );

  const handleCreateBoard = useCallback(async () => {
    await flushSaveNow();
    await createNewBoard();
  }, [createNewBoard, flushSaveNow]);

  const handleSceneMutated = useCallback(
    (
      upserts: SceneObject[],
      deletes: string[],
      getLatestScene: () => SceneData
    ) => {
      broadcastScenePatch(upserts, deletes);
      scheduleSave(getLatestScene);
    },
    [broadcastScenePatch, scheduleSave]
  );

  const handleExportPng = useCallback(async () => {
    const scene = canvasRef.current?.getSceneData();
    if (!scene || !activeBoard) return;
    await exportBoardAsPng(scene.objects, `${student}-${activeBoard.title}`);
  }, [activeBoard, student]);

  const handleExportPdf = useCallback(async () => {
    const scene = canvasRef.current?.getSceneData();
    if (!scene || !activeBoard) return;
    await exportBoardAsPdf(scene.objects, `${student}-${activeBoard.title}`);
  }, [activeBoard, student]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-100">
      <WorkspaceHeader
        student={student}
        boardTitle={activeBoard?.title ?? `${student}'s Workspace`}
        sidebarOpen={sidebarOpen}
        isLive={isLive}
        peerCount={peerCount}
        syncStatus={syncStatus}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        onBeforeNavigate={flushSaveNow}
        onRenameBoard={async (nextTitle) => {
          if (activeBoard) {
            await renameBoardTitle(activeBoard.id, nextTitle);
          }
        }}
        onExportPng={handleExportPng}
        onExportPdf={handleExportPdf}
      />

      {!configured && !setupDismissed && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <strong>Local Demo Mode:</strong> Add{' '}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">
                NEXT_PUBLIC_SUPABASE_URL
              </code>{' '}
              and{' '}
              <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">
                NEXT_PUBLIC_SUPABASE_ANON_KEY
              </code>{' '}
              in <code className="font-mono">.env.local</code> and run{' '}
              <code className="font-mono">supabase/schema.sql</code> to enable cloud
              persistence &amp; live multiplayer sync.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSetupDismissed(true)}
            aria-label="Dismiss setup notice"
            className="rounded p-1 text-amber-700 hover:bg-amber-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs font-medium text-rose-700">
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <BoardSidebar
          student={student}
          open={sidebarOpen}
          boards={filteredBoards}
          activeBoardId={activeBoard?.id ?? null}
          searchQuery={searchQuery}
          loading={loadingList}
          onSearchChange={setSearchQuery}
          onSelectBoard={(id) => void handleSelectBoard(id)}
          onCreateBoard={handleCreateBoard}
          onRenameBoard={renameBoardTitle}
          onDeleteBoard={deleteBoard}
        />

        <main className="relative flex min-w-0 flex-1 overflow-hidden">
          {loadingList || loadingBoard || !activeBoard ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-[#eef2f7] text-slate-500">
              <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
              <p className="text-sm font-medium">
                Loading {student}&apos;s whiteboard...
              </p>
            </div>
          ) : (
            <WhiteboardCanvas
              key={activeBoard.id}
              ref={canvasRef}
              boardId={activeBoard.id}
              initialScene={activeBoard.scene_data}
              onSceneMutated={handleSceneMutated}
              onCursorMove={broadcastCursor}
              onLiveStroke={broadcastLiveStroke}
              onLiveStrokeEnd={broadcastLiveStrokeEnd}
            />
          )}
        </main>
      </div>
    </div>
  );
}
