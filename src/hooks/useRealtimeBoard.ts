'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { saveBoardScene } from '@/lib/supabase/boards';
import { generateId } from '@/lib/utils';
import type { SyncStatus } from '@/types/board';
import type {
  CursorPayload,
  LiveStrokeEndPayload,
  LiveStrokePayload,
  SceneData,
  SceneObject,
  ScenePatchPayload,
  ToolType,
} from '@/types/scene';

const PEER_COLORS = ['#4f46e5', '#059669', '#db2777', '#d97706', '#0284c7'];
const RETRY_DELAYS_MS = [2000, 4000, 8000, 15000];
const SAVE_DEBOUNCE_MS = 1500;
const THROTTLE_30HZ_MS = 33;

export interface UseRealtimeBoardOptions {
  boardId: string | null;
  onRemoteScenePatch: (patch: ScenePatchPayload) => void;
  onRemoteLiveStroke: (payload: LiveStrokePayload) => void;
  onRemoteLiveStrokeEnd: (payload: LiveStrokeEndPayload) => void;
  onRemoteCursor: (payload: CursorPayload) => void;
  onBoardSaved?: (boardId: string, updatedAt: string) => void;
}

export function useRealtimeBoard({
  boardId,
  onRemoteScenePatch,
  onRemoteLiveStroke,
  onRemoteLiveStrokeEnd,
  onRemoteCursor,
  onBoardSaved,
}: UseRealtimeBoardOptions) {
  const [peerCount, setPeerCount] = useState(1);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('saved');

  const clientIdRef = useRef<string>(generateId());
  const myColorRef = useRef<string>(
    PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)]
  );
  const channelRef = useRef<RealtimeChannel | null>(null);
  const channelSubscribedRef = useRef(false);

  const onRemoteScenePatchRef = useRef(onRemoteScenePatch);
  const onRemoteLiveStrokeRef = useRef(onRemoteLiveStroke);
  const onRemoteLiveStrokeEndRef = useRef(onRemoteLiveStrokeEnd);
  const onRemoteCursorRef = useRef(onRemoteCursor);
  const onBoardSavedRef = useRef(onBoardSaved);

  onRemoteScenePatchRef.current = onRemoteScenePatch;
  onRemoteLiveStrokeRef.current = onRemoteLiveStroke;
  onRemoteLiveStrokeEndRef.current = onRemoteLiveStrokeEnd;
  onRemoteCursorRef.current = onRemoteCursor;
  onBoardSavedRef.current = onBoardSaved;

  // Throttle timers
  const lastCursorSentRef = useRef(0);
  const lastStrokeSentRef = useRef(0);

  // Debounced auto-save state
  const saveTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const retryIndexRef = useRef(0);
  const pendingSceneGetterRef = useRef<(() => SceneData) | null>(null);
  const dirtyVersionRef = useRef(0);
  const activeBoardIdRef = useRef<string | null>(boardId);
  activeBoardIdRef.current = boardId;

  const clearSaveTimers = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const performSave = useCallback(async () => {
    const targetBoardId = activeBoardIdRef.current;
    const getScene = pendingSceneGetterRef.current;
    if (!targetBoardId || !getScene) return;

    if (!isSupabaseConfigured()) {
      setSyncStatus('saved');
      return;
    }

    const versionAtStart = dirtyVersionRef.current;
    setSyncStatus('saving');

    try {
      const updatedAt = await saveBoardScene(targetBoardId, getScene());
      retryIndexRef.current = 0;

      if (
        activeBoardIdRef.current === targetBoardId &&
        dirtyVersionRef.current === versionAtStart
      ) {
        setSyncStatus('saved');
      }
      onBoardSavedRef.current?.(targetBoardId, updatedAt);
    } catch {
      if (activeBoardIdRef.current !== targetBoardId) return;
      setSyncStatus('offline');

      const delay =
        RETRY_DELAYS_MS[
          Math.min(retryIndexRef.current, RETRY_DELAYS_MS.length - 1)
        ];
      retryIndexRef.current += 1;

      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
      }
      retryTimerRef.current = window.setTimeout(() => {
        retryTimerRef.current = null;
        void performSave();
      }, delay);
    }
  }, []);

  const scheduleSave = useCallback(
    (getLatestScene: () => SceneData) => {
      pendingSceneGetterRef.current = getLatestScene;
      dirtyVersionRef.current += 1;

      if (!isSupabaseConfigured() || !activeBoardIdRef.current) {
        setSyncStatus('saved');
        return;
      }

      setSyncStatus('saving');
      clearSaveTimers();
      retryIndexRef.current = 0;

      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        void performSave();
      }, SAVE_DEBOUNCE_MS);
    },
    [clearSaveTimers, performSave]
  );

  const flushSaveNow = useCallback(async () => {
    if (saveTimerRef.current !== null || retryTimerRef.current !== null) {
      clearSaveTimers();
      await performSave();
    }
  }, [clearSaveTimers, performSave]);

  // Retry immediately when browser comes back online, and flush on tab hide
  useEffect(() => {
    const handleOnline = () => {
      if (retryTimerRef.current !== null || saveTimerRef.current !== null) {
        clearSaveTimers();
        void performSave();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void flushSaveNow();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [clearSaveTimers, flushSaveNow, performSave]);

  // Subscribe to Supabase Realtime channel per board_id
  useEffect(() => {
    clearSaveTimers();
    pendingSceneGetterRef.current = null;
    setSyncStatus('saved');
    setPeerCount(1);

    const supabase = getSupabaseClient();
    if (!supabase || !boardId) {
      channelRef.current = null;
      channelSubscribedRef.current = false;
      return;
    }

    const channel = supabase.channel(`board:${boardId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: clientIdRef.current },
      },
    });

    channelRef.current = channel;
    channelSubscribedRef.current = false;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const count = Math.max(1, Object.keys(state).length);
        setPeerCount(count);
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        if (payload && payload.clientId !== clientIdRef.current) {
          onRemoteCursorRef.current(payload as CursorPayload);
        }
      })
      .on('broadcast', { event: 'live_stroke' }, ({ payload }) => {
        if (payload && payload.clientId !== clientIdRef.current) {
          onRemoteLiveStrokeRef.current(payload as LiveStrokePayload);
        }
      })
      .on('broadcast', { event: 'live_stroke_end' }, ({ payload }) => {
        if (payload && payload.clientId !== clientIdRef.current) {
          onRemoteLiveStrokeEndRef.current(payload as LiveStrokeEndPayload);
        }
      })
      .on('broadcast', { event: 'scene_patch' }, ({ payload }) => {
        if (payload && payload.clientId !== clientIdRef.current) {
          onRemoteScenePatchRef.current(payload as ScenePatchPayload);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          channelSubscribedRef.current = true;
          await channel.track({
            clientId: clientIdRef.current,
            color: myColorRef.current,
            joinedAt: Date.now(),
          });
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          channelSubscribedRef.current = false;
        }
      });

    return () => {
      channelSubscribedRef.current = false;
      channelRef.current = null;
      void supabase.removeChannel(channel);
      clearSaveTimers();
    };
  }, [boardId, clearSaveTimers]);

  const broadcastCursor = useCallback(
    (x: number, y: number, tool: ToolType, isDrawing: boolean) => {
      const channel = channelRef.current;
      if (!channel || !channelSubscribedRef.current) return;

      const now = performance.now();
      if (now - lastCursorSentRef.current < THROTTLE_30HZ_MS) return;
      lastCursorSentRef.current = now;

      const payload: CursorPayload = {
        clientId: clientIdRef.current,
        x,
        y,
        color: myColorRef.current,
        tool,
        isDrawing,
        ts: Date.now(),
      };

      void channel.send({
        type: 'broadcast',
        event: 'cursor',
        payload,
      });
    },
    []
  );

  const broadcastLiveStroke = useCallback(
    (
      stroke: Omit<LiveStrokePayload, 'clientId'>,
      force = false
    ) => {
      const channel = channelRef.current;
      if (!channel || !channelSubscribedRef.current) return;

      const now = performance.now();
      if (!force && now - lastStrokeSentRef.current < THROTTLE_30HZ_MS) return;
      lastStrokeSentRef.current = now;

      // Keep extremely long strokes lightweight on the wire
      const pts =
        stroke.points.length > 400
          ? stroke.points.filter(
              (_, idx) => idx % 2 === 0 || idx === stroke.points.length - 1
            )
          : stroke.points;

      const payload: LiveStrokePayload = {
        ...stroke,
        points: pts,
        clientId: clientIdRef.current,
      };

      void channel.send({
        type: 'broadcast',
        event: 'live_stroke',
        payload,
      });
    },
    []
  );

  const broadcastLiveStrokeEnd = useCallback((strokeId: string) => {
    const channel = channelRef.current;
    if (!channel || !channelSubscribedRef.current) return;

    const payload: LiveStrokeEndPayload = {
      clientId: clientIdRef.current,
      strokeId,
    };

    void channel.send({
      type: 'broadcast',
      event: 'live_stroke_end',
      payload,
    });
  }, []);

  const broadcastScenePatch = useCallback(
    (upserts: SceneObject[], deletes: string[]) => {
      const channel = channelRef.current;
      if (!channel || !channelSubscribedRef.current) return;
      if (upserts.length === 0 && deletes.length === 0) return;

      const payload: ScenePatchPayload = {
        clientId: clientIdRef.current,
        upserts,
        deletes,
      };

      void channel.send({
        type: 'broadcast',
        event: 'scene_patch',
        payload,
      });
    },
    []
  );

  return {
    clientId: clientIdRef.current,
    peerCount,
    isLive: peerCount >= 2,
    syncStatus,
    scheduleSave,
    flushSaveNow,
    broadcastCursor,
    broadcastLiveStroke,
    broadcastLiveStrokeEnd,
    broadcastScenePatch,
  };
}
