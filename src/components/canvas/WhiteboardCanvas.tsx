'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { FileUp } from 'lucide-react';
import { useTheme, type ThemeMode } from '@/components/theme/ThemeProvider';
import { FloatingToolbar } from './FloatingToolbar';
import { SelectionActionBar } from './SelectionActionBar';
import { ZoomControls } from './ZoomControls';
import {
  applyHandleResize,
  computeNextPaperPosition,
  computeStrokeBBox,
  constrainShapeEndpoint,
  getNextZIndex,
  getObjectBBox,
  getSelectionBBox,
  hitTestObject,
  hitTestResizeHandle,
  hitTestTopmostObject,
  pointToSegmentDistance,
  rectsIntersect,
  scaleObjectInBounds,
  screenToWorld,
  translateObject,
  type ResizeHandle,
} from '@/lib/canvas/geometry';
import { renderPdfFileToPages } from '@/lib/canvas/pdfRenderer';
import {
  canvasToPngBlob,
  evictStrokeCache,
  registerLocalImagePreview,
  renderLiveCanvas,
  renderRegionToCanvas,
  renderSceneCanvas,
} from '@/lib/canvas/renderer';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import {
  uploadPdfAsset,
  uploadPhotoAsset,
  uploadSnipAsset,
} from '@/lib/supabase/storage';
import { clamp, generateId } from '@/lib/utils';
import {
  A4_HEIGHT,
  A4_WIDTH,
  HIGHLIGHTER_COLORS,
  HIGHLIGHTER_SIZES,
  PEN_COLORS,
  PEN_SIZES,
  type BBox,
  type Camera,
  type CursorPayload,
  type HistoryPatch,
  type LiveStrokeEndPayload,
  type LiveStrokePayload,
  type PaperObject,
  type PaperTemplateType,
  type PhotoObject,
  type SceneData,
  type SceneObject,
  type ScenePatchPayload,
  type ShapeKind,
  type ShapeObject,
  type SnipMode,
  type SnipObject,
  type StrokeObject,
  type ToolType,
} from '@/types/scene';

export interface WhiteboardCanvasHandle {
  getSceneData: () => SceneData;
  applyRemoteScenePatch: (patch: ScenePatchPayload) => void;
  applyRemoteLiveStroke: (payload: LiveStrokePayload) => void;
  applyRemoteLiveStrokeEnd: (payload: LiveStrokeEndPayload) => void;
  applyRemoteCursor: (payload: CursorPayload) => void;
}

interface WhiteboardCanvasProps {
  boardId: string;
  initialScene: SceneData;
  onSceneMutated: (
    upserts: SceneObject[],
    deletes: string[],
    getLatestScene: () => SceneData
  ) => void;
  onCursorMove: (x: number, y: number, tool: ToolType, isDrawing: boolean) => void;
  onLiveStroke: (
    stroke: Omit<LiveStrokePayload, 'clientId'>,
    force?: boolean
  ) => void;
  onLiveStrokeEnd: (strokeId: string) => void;
}

type InteractionMode =
  | { type: 'idle' }
  | { type: 'pan'; lastClientX: number; lastClientY: number }
  | { type: 'draw'; stroke: StrokeObject; pointerId: number }
  | { type: 'erase'; deletedIds: Map<string, SceneObject>; lastWorldX: number; lastWorldY: number }
  | {
      type: 'shape';
      kind: ShapeKind;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }
  | {
      type: 'move';
      startWorldX: number;
      startWorldY: number;
      originals: Map<string, SceneObject>;
    }
  | {
      type: 'resize';
      handle: ResizeHandle;
      startWorldX: number;
      startWorldY: number;
      initialBBox: BBox;
      originals: Map<string, SceneObject>;
    }
  | {
      type: 'marquee';
      startWorldX: number;
      startWorldY: number;
      currentWorldX: number;
      currentWorldY: number;
    }
  | {
      type: 'snip';
      mode: SnipMode;
      startWorldX: number;
      startWorldY: number;
      currentWorldX: number;
      currentWorldY: number;
      lassoPoints: Array<[number, number]>;
    };

const MIN_ZOOM = 0.15;
const MAX_ZOOM = 5.0;
const MAX_HISTORY = 100;

export const WhiteboardCanvas = forwardRef<WhiteboardCanvasHandle, WhiteboardCanvasProps>(
  function WhiteboardCanvas(
    {
      boardId,
      initialScene,
      onSceneMutated,
      onCursorMove,
      onLiveStroke,
      onLiveStrokeEnd,
    },
    ref
  ) {
    const { theme } = useTheme();
    const themeRef = useRef<ThemeMode>(theme);
    themeRef.current = theme;

    const containerRef = useRef<HTMLDivElement>(null);
    const sceneCanvasRef = useRef<HTMLCanvasElement>(null);
    const liveCanvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Core canvas engine refs (decoupled from React renders for 60-120fps)
    const objectsRef = useRef<Record<string, SceneObject>>({ ...initialScene.objects });
    const cameraRef = useRef<Camera>({ x: 120, y: 80, zoom: 0.9 });
    const viewportRef = useRef<{ width: number; height: number; dpr: number }>({
      width: 1200,
      height: 800,
      dpr: 1,
    });
    const selectedIdsRef = useRef<Set<string>>(new Set());
    const interactionRef = useRef<InteractionMode>({ type: 'idle' });
    const activeTouchPointersRef = useRef<Map<number, { x: number; y: number }>>(
      new Map()
    );
    const pinchLastRef = useRef<{ dist: number; midX: number; midY: number } | null>(
      null
    );
    const spaceHeldRef = useRef(false);
    const eraserCursorRef = useRef<{
      x: number;
      y: number;
      radiusWorld: number;
    } | null>(null);
    const remoteLiveStrokesRef = useRef<Map<string, LiveStrokePayload>>(new Map());
    const remoteCursorsRef = useRef<Map<string, CursorPayload>>(new Map());
    const undoStackRef = useRef<HistoryPatch[]>([]);
    const redoStackRef = useRef<HistoryPatch[]>([]);

    const dirtySceneRef = useRef(true);
    const dirtyLiveRef = useRef(true);
    const rafIdRef = useRef<number | null>(null);

    // UI State synced only when needed
    const [activeTool, setActiveTool] = useState<ToolType>('pen');
    const activeToolRef = useRef<ToolType>('pen');
    const [penColor, setPenColor] = useState<string>(PEN_COLORS[0].value);
    const penColorRef = useRef<string>(PEN_COLORS[0].value);
    const [penSize, setPenSize] = useState<number>(PEN_SIZES[1]);
    const penSizeRef = useRef<number>(PEN_SIZES[1]);
    const [highlighterColor, setHighlighterColor] = useState<string>(
      HIGHLIGHTER_COLORS[0].value
    );
    const highlighterColorRef = useRef<string>(HIGHLIGHTER_COLORS[0].value);
    const [highlighterSize, setHighlighterSize] = useState<number>(
      HIGHLIGHTER_SIZES[1]
    );
    const highlighterSizeRef = useRef<number>(HIGHLIGHTER_SIZES[1]);
    const [lastShapeTool, setLastShapeTool] = useState<ShapeKind>('rect');
    const [snipMode, setSnipMode] = useState<SnipMode>('rect');
    const snipModeRef = useRef<SnipMode>('rect');

    const [cameraUi, setCameraUi] = useState<Camera>(cameraRef.current);
    const [viewportUiWidth, setViewportUiWidth] = useState(1200);
    const [selectedIdsUi, setSelectedIdsUi] = useState<string[]>([]);
    const [historyCounts, setHistoryCounts] = useState({ undo: 0, redo: 0 });
    const [uploadingMedia, setUploadingMedia] = useState(false);
    const [dragOverMedia, setDragOverMedia] = useState(false);
    const [toast, setToast] = useState<{ text: string; tone: 'info' | 'error' } | null>(
      null
    );
    const [cursorCss, setCursorCss] = useState<string>('crosshair');

    const showToast = useCallback(
      (text: string, tone: 'info' | 'error' = 'info') => {
        setToast({ text, tone });
      },
      []
    );

    useEffect(() => {
      if (!toast) return;
      const t = window.setTimeout(() => setToast(null), 3200);
      return () => window.clearTimeout(t);
    }, [toast]);

    const getLatestScene = useCallback((): SceneData => {
      return {
        version: 1,
        objects: objectsRef.current,
      };
    }, []);

    const syncSelectionUi = useCallback(() => {
      setSelectedIdsUi(Array.from(selectedIdsRef.current));
    }, []);

    const syncHistoryUi = useCallback(() => {
      setHistoryCounts({
        undo: undoStackRef.current.length,
        redo: redoStackRef.current.length,
      });
    }, []);

    const syncCameraUi = useCallback(() => {
      setCameraUi({ ...cameraRef.current });
    }, []);

    const runRenderFrame = useCallback(() => {
      rafIdRef.current = null;
      const { width, height, dpr } = viewportRef.current;

      if (dirtySceneRef.current) {
        const sceneCtx = sceneCanvasRef.current?.getContext('2d');
        if (sceneCtx) {
          renderSceneCanvas(
            sceneCtx,
            width,
            height,
            dpr,
            cameraRef.current,
            objectsRef.current,
            selectedIdsRef.current,
            () => {
              dirtySceneRef.current = true;
              if (rafIdRef.current === null) {
                rafIdRef.current = window.requestAnimationFrame(runRenderFrame);
              }
            },
            themeRef.current
          );
        }
        dirtySceneRef.current = false;
      }

      if (dirtyLiveRef.current) {
        const liveCtx = liveCanvasRef.current?.getContext('2d');
        if (liveCtx) {
          const interaction = interactionRef.current;
          const activeStroke =
            interaction.type === 'draw' ? interaction.stroke : null;
          const activeShape =
            interaction.type === 'shape'
              ? {
                  type: 'shape' as const,
                  shape: interaction.kind,
                  x1: interaction.x1,
                  y1: interaction.y1,
                  x2: interaction.x2,
                  y2: interaction.y2,
                  color: penColorRef.current,
                  strokeWidth: Math.max(2, penSizeRef.current),
                }
              : null;
          const marqueeBBox =
            interaction.type === 'marquee'
              ? {
                  minX: Math.min(interaction.startWorldX, interaction.currentWorldX),
                  minY: Math.min(interaction.startWorldY, interaction.currentWorldY),
                  maxX: Math.max(interaction.startWorldX, interaction.currentWorldX),
                  maxY: Math.max(interaction.startWorldY, interaction.currentWorldY),
                }
              : null;

          const snipSelection =
            interaction.type === 'snip'
              ? {
                  mode: interaction.mode,
                  rect:
                    interaction.mode === 'rect'
                      ? {
                          minX: Math.min(
                            interaction.startWorldX,
                            interaction.currentWorldX
                          ),
                          minY: Math.min(
                            interaction.startWorldY,
                            interaction.currentWorldY
                          ),
                          maxX: Math.max(
                            interaction.startWorldX,
                            interaction.currentWorldX
                          ),
                          maxY: Math.max(
                            interaction.startWorldY,
                            interaction.currentWorldY
                          ),
                        }
                      : null,
                  lassoPoints: interaction.lassoPoints,
                }
              : null;

          const selectedList = Array.from(selectedIdsRef.current)
            .map((id) => objectsRef.current[id])
            .filter((o): o is SceneObject => Boolean(o));
          const selectionBBox = getSelectionBBox(selectedList);

          renderLiveCanvas(liveCtx, width, height, dpr, {
            camera: cameraRef.current,
            theme: themeRef.current,
            activeStroke,
            remoteLiveStrokes: remoteLiveStrokesRef.current,
            activeShape,
            marqueeBBox,
            selectionBBox,
            selectedObjectsCount: selectedList.length,
            eraserCursor: eraserCursorRef.current,
            snipSelection,
            remoteCursors: remoteCursorsRef.current,
          });
        }
        dirtyLiveRef.current = false;
      }
    }, []);

    const scheduleRender = useCallback(
      (scene = false, live = true) => {
        if (scene) dirtySceneRef.current = true;
        if (live) dirtyLiveRef.current = true;
        if (rafIdRef.current === null) {
          rafIdRef.current = window.requestAnimationFrame(runRenderFrame);
        }
      },
      [runRenderFrame]
    );

    useEffect(() => {
      themeRef.current = theme;
      scheduleRender(true, true);
    }, [theme, scheduleRender]);

    const selectTool = useCallback(
      (tool: ToolType) => {
        activeToolRef.current = tool;
        setActiveTool(tool);
        if (
          tool === 'line' ||
          tool === 'arrow' ||
          tool === 'rect' ||
          tool === 'ellipse'
        ) {
          setLastShapeTool(tool);
        }
        if (tool !== 'select') {
          selectedIdsRef.current.clear();
          syncSelectionUi();
        }
        if (tool !== 'eraser') {
          eraserCursorRef.current = null;
        }
        if (tool === 'select') setCursorCss('default');
        else if (tool === 'eraser') setCursorCss('none');
        else setCursorCss('crosshair');

        scheduleRender(true, true);
      },
      [scheduleRender, syncSelectionUi]
    );

    // Clear stale remote cursors smoothly
    useEffect(() => {
      const interval = window.setInterval(() => {
        const now = Date.now();
        let removed = false;
        for (const [key, cursor] of remoteCursorsRef.current.entries()) {
          if (now - cursor.ts > 6000) {
            remoteCursorsRef.current.delete(key);
            removed = true;
          }
        }
        if (removed) scheduleRender(false, true);
      }, 2000);
      return () => window.clearInterval(interval);
    }, [scheduleRender]);

    // Fit content helper
    const fitContent = useCallback(() => {
      const list = Object.values(objectsRef.current);
      const { width, height } = viewportRef.current;
      if (list.length === 0) {
        cameraRef.current = { x: width * 0.15, y: 80, zoom: 0.9 };
        syncCameraUi();
        scheduleRender(true, true);
        return;
      }

      const bbox = getSelectionBBox(list);
      if (!bbox) return;
      const contentW = Math.max(100, bbox.maxX - bbox.minX);
      const contentH = Math.max(100, bbox.maxY - bbox.minY);
      const padding = 80;
      const zoom = clamp(
        Math.min(
          (width - padding * 2) / contentW,
          (height - padding * 2) / contentH
        ),
        MIN_ZOOM,
        1.5
      );
      const cx = (bbox.minX + bbox.maxX) / 2;
      const cy = (bbox.minY + bbox.maxY) / 2;
      cameraRef.current = {
        x: width / 2 - cx * zoom,
        y: height / 2 - cy * zoom,
        zoom,
      };
      syncCameraUi();
      scheduleRender(true, true);
    }, [scheduleRender, syncCameraUi]);

    // Reset scene when switching boardId
    useEffect(() => {
      objectsRef.current = { ...initialScene.objects };
      selectedIdsRef.current.clear();
      undoStackRef.current = [];
      redoStackRef.current = [];
      remoteLiveStrokesRef.current.clear();
      remoteCursorsRef.current.clear();
      interactionRef.current = { type: 'idle' };
      syncSelectionUi();
      syncHistoryUi();
      fitContent();
    }, [boardId, initialScene, fitContent, syncHistoryUi, syncSelectionUi]);

    // ResizeObserver for crisp Retina DPR sizing
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const updateSize = () => {
        const rect = container.getBoundingClientRect();
        const width = Math.max(1, Math.floor(rect.width));
        const height = Math.max(1, Math.floor(rect.height));
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        viewportRef.current = { width, height, dpr };
        setViewportUiWidth(width);

        for (const canvas of [sceneCanvasRef.current, liveCanvasRef.current]) {
          if (!canvas) continue;
          canvas.width = Math.floor(width * dpr);
          canvas.height = Math.floor(height * dpr);
          canvas.style.width = `${width}px`;
          canvas.style.height = `${height}px`;
        }

        scheduleRender(true, true);
      };

      updateSize();
      const observer = new ResizeObserver(updateSize);
      observer.observe(container);
      window.addEventListener('resize', updateSize);
      return () => {
        observer.disconnect();
        window.removeEventListener('resize', updateSize);
        if (rafIdRef.current !== null) {
          window.cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
      };
    }, [scheduleRender]);

    // Apply a local patch + push to history + broadcast + schedule save
    const commitHistoryPatch = useCallback(
      (patch: HistoryPatch) => {
        const upserts: SceneObject[] = [];
        const deletes: string[] = [];

        for (const [id, nextObj] of Object.entries(patch.after)) {
          if (nextObj) {
            objectsRef.current[id] = nextObj;
            upserts.push(nextObj);
            if (nextObj.type === 'stroke') evictStrokeCache(id);
          } else {
            delete objectsRef.current[id];
            deletes.push(id);
            evictStrokeCache(id);
            selectedIdsRef.current.delete(id);
          }
        }

        if (upserts.length === 0 && deletes.length === 0) return;

        undoStackRef.current.push(patch);
        if (undoStackRef.current.length > MAX_HISTORY) {
          undoStackRef.current.shift();
        }
        redoStackRef.current = [];
        syncHistoryUi();
        syncSelectionUi();
        scheduleRender(true, true);
        onSceneMutated(upserts, deletes, getLatestScene);
      },
      [getLatestScene, onSceneMutated, scheduleRender, syncHistoryUi, syncSelectionUi]
    );

    const applyPatchDirection = useCallback(
      (patch: HistoryPatch, direction: 'undo' | 'redo') => {
        const targetMap = direction === 'undo' ? patch.before : patch.after;
        const upserts: SceneObject[] = [];
        const deletes: string[] = [];

        for (const [id, obj] of Object.entries(targetMap)) {
          if (obj) {
            objectsRef.current[id] = obj;
            upserts.push(obj);
          } else {
            delete objectsRef.current[id];
            deletes.push(id);
            selectedIdsRef.current.delete(id);
          }
          evictStrokeCache(id);
        }

        syncHistoryUi();
        syncSelectionUi();
        scheduleRender(true, true);
        onSceneMutated(upserts, deletes, getLatestScene);
      },
      [getLatestScene, onSceneMutated, scheduleRender, syncHistoryUi, syncSelectionUi]
    );

    const undo = useCallback(() => {
      const patch = undoStackRef.current.pop();
      if (!patch) return;
      redoStackRef.current.push(patch);
      applyPatchDirection(patch, 'undo');
    }, [applyPatchDirection]);

    const redo = useCallback(() => {
      const patch = redoStackRef.current.pop();
      if (!patch) return;
      undoStackRef.current.push(patch);
      applyPatchDirection(patch, 'redo');
    }, [applyPatchDirection]);

    // Imperative methods for parent/realtime hooks
    useImperativeHandle(
      ref,
      () => ({
        getSceneData: () => ({
          version: 1,
          objects: { ...objectsRef.current },
        }),
        applyRemoteScenePatch: (patch: ScenePatchPayload) => {
          for (const obj of patch.upserts) {
            const existing = objectsRef.current[obj.id];
            if (!existing || obj.updatedAt >= existing.updatedAt) {
              objectsRef.current[obj.id] = obj;
              if (obj.type === 'stroke') evictStrokeCache(obj.id);
            }
          }
          for (const id of patch.deletes) {
            delete objectsRef.current[id];
            evictStrokeCache(id);
            selectedIdsRef.current.delete(id);
          }
          syncSelectionUi();
          scheduleRender(true, true);
        },
        applyRemoteLiveStroke: (payload: LiveStrokePayload) => {
          remoteLiveStrokesRef.current.set(payload.strokeId, payload);
          scheduleRender(false, true);
        },
        applyRemoteLiveStrokeEnd: (payload: LiveStrokeEndPayload) => {
          remoteLiveStrokesRef.current.delete(payload.strokeId);
          scheduleRender(false, true);
        },
        applyRemoteCursor: (payload: CursorPayload) => {
          remoteCursorsRef.current.set(payload.clientId, payload);
          scheduleRender(false, true);
        },
      }),
      [scheduleRender, syncSelectionUi]
    );

    // Selection Actions
    const deleteSelection = useCallback(() => {
      if (selectedIdsRef.current.size === 0) return;
      const before: Record<string, SceneObject | null> = {};
      const after: Record<string, SceneObject | null> = {};
      for (const id of selectedIdsRef.current) {
        const existing = objectsRef.current[id];
        if (existing) {
          before[id] = existing;
          after[id] = null;
        }
      }
      selectedIdsRef.current.clear();
      commitHistoryPatch({ before, after });
    }, [commitHistoryPatch]);

    const duplicateSelection = useCallback(() => {
      if (selectedIdsRef.current.size === 0) return;
      const before: Record<string, SceneObject | null> = {};
      const after: Record<string, SceneObject | null> = {};
      const newSelection = new Set<string>();
      let nextZ = getNextZIndex(objectsRef.current);
      const now = Date.now();

      for (const id of selectedIdsRef.current) {
        const obj = objectsRef.current[id];
        if (!obj) continue;
        const cloneId = generateId();
        const shifted = translateObject(
          {
            ...obj,
            id: cloneId,
            zIndex: nextZ,
            locked: false,
            createdAt: now,
            updatedAt: now,
          },
          28,
          28,
          now
        );
        nextZ += 1;
        before[cloneId] = null;
        after[cloneId] = shifted;
        newSelection.add(cloneId);
      }

      selectedIdsRef.current = newSelection;
      commitHistoryPatch({ before, after });
    }, [commitHistoryPatch]);

    const toggleSelectionLock = useCallback(() => {
      if (selectedIdsRef.current.size === 0) return;
      const selected = Array.from(selectedIdsRef.current)
        .map((id) => objectsRef.current[id])
        .filter((o): o is SceneObject => Boolean(o));
      if (selected.length === 0) return;

      const targetLocked = !selected.every((o) => Boolean(o.locked));
      const before: Record<string, SceneObject | null> = {};
      const after: Record<string, SceneObject | null> = {};
      const now = Date.now();

      for (const obj of selected) {
        before[obj.id] = obj;
        after[obj.id] = { ...obj, locked: targetLocked, updatedAt: now };
      }
      commitHistoryPatch({ before, after });
    }, [commitHistoryPatch]);

    const reorderSelectionZ = useCallback(
      (direction: 'front' | 'back') => {
        if (selectedIdsRef.current.size === 0) return;
        const all = Object.values(objectsRef.current);
        let extremeZ =
          direction === 'front'
            ? all.reduce((acc, o) => Math.max(acc, o.zIndex), 0)
            : all.reduce((acc, o) => Math.min(acc, o.zIndex), 0);

        const before: Record<string, SceneObject | null> = {};
        const after: Record<string, SceneObject | null> = {};
        const now = Date.now();

        for (const id of selectedIdsRef.current) {
          const obj = objectsRef.current[id];
          if (!obj) continue;
          extremeZ = direction === 'front' ? extremeZ + 1 : extremeZ - 1;
          before[id] = obj;
          after[id] = { ...obj, zIndex: extremeZ, updatedAt: now };
        }
        commitHistoryPatch({ before, after });
      },
      [commitHistoryPatch]
    );

    // Insert Paper Frame
    const handleAddPaper = useCallback(
      (template: PaperTemplateType) => {
        const { width, height } = viewportRef.current;
        const pos = computeNextPaperPosition(
          objectsRef.current,
          cameraRef.current,
          width,
          height
        );
        const now = Date.now();
        const labelMap: Record<PaperTemplateType, string> = {
          blank: 'Blank Sheet',
          lined: 'Lined Sheet',
          graph: 'Graph Sheet',
          dot: 'Dot Grid',
        };
        const paper: PaperObject = {
          id: generateId(),
          type: 'paper',
          template,
          x: pos.x,
          y: pos.y,
          width: A4_WIDTH,
          height: A4_HEIGHT,
          label: labelMap[template],
          locked: false,
          zIndex: getNextZIndex(objectsRef.current),
          createdAt: now,
          updatedAt: now,
        };

        commitHistoryPatch({
          before: { [paper.id]: null },
          after: { [paper.id]: paper },
        });

        // Smoothly pan into view if off-screen
        const targetScreenX = pos.x * cameraRef.current.zoom + cameraRef.current.x;
        const targetScreenW = A4_WIDTH * cameraRef.current.zoom;
        if (targetScreenX + targetScreenW > width - 20 || targetScreenX < 20) {
          cameraRef.current = {
            ...cameraRef.current,
            x: width / 2 - (pos.x + A4_WIDTH / 2) * cameraRef.current.zoom,
            y: Math.min(cameraRef.current.y, 72 - pos.y * cameraRef.current.zoom),
          };
          syncCameraUi();
          scheduleRender(true, true);
        }
      },
      [commitHistoryPatch, scheduleRender, syncCameraUi]
    );

    // Upload & Render PDF
    const handlePdfFile = useCallback(
      async (file: File, dropClientCoords?: { clientX: number; clientY: number }) => {
        if (
          file.type !== 'application/pdf' &&
          !file.name.toLowerCase().endsWith('.pdf')
        ) {
          showToast('Please choose a valid PDF or image file.', 'error');
          return;
        }

        setUploadingMedia(true);
        showToast(`Adding ${file.name}...`);

        try {
          let startX = 0;
          let startY = 0;
          if (dropClientCoords && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const world = screenToWorld(
              dropClientCoords.clientX - rect.left,
              dropClientCoords.clientY - rect.top,
              cameraRef.current
            );
            startX = Math.round(world.x - A4_WIDTH / 2);
            startY = Math.round(world.y - 120);
          } else {
            const pos = computeNextPaperPosition(
              objectsRef.current,
              cameraRef.current,
              viewportRef.current.width,
              viewportRef.current.height
            );
            startX = pos.x;
            startY = pos.y;
          }

          let pdfUrl: string;
          let storagePath = '';
          if (isSupabaseConfigured()) {
            const uploaded = await uploadPdfAsset(boardId, file);
            pdfUrl = uploaded.url;
            storagePath = uploaded.storagePath;
          } else {
            pdfUrl = URL.createObjectURL(file);
            showToast(
              'Demo mode: PDF rendered locally (configure Supabase to persist PDFs).',
              'info'
            );
          }

          const startZ = getNextZIndex(objectsRef.current);
          const pages = await renderPdfFileToPages(
            file,
            pdfUrl,
            storagePath,
            startX,
            startY,
            startZ
          );

          const before: Record<string, SceneObject | null> = {};
          const after: Record<string, SceneObject | null> = {};
          for (const page of pages) {
            before[page.id] = null;
            after[page.id] = page;
          }

          const hadNoContent = Object.keys(objectsRef.current).length === 0;
          commitHistoryPatch({ before, after });

          if (hadNoContent && pages.length > 0) {
            cameraRef.current = {
              x: viewportRef.current.width / 2 - (startX + pages[0].width / 2) * 0.85,
              y: 56 - startY * 0.85,
              zoom: 0.85,
            };
            syncCameraUi();
            scheduleRender(true, true);
          }

          showToast(
            `Added ${pages.length} page${pages.length === 1 ? '' : 's'} from ${file.name}`
          );
        } catch (err) {
          showToast(
            err instanceof Error ? err.message : 'Failed to process PDF.',
            'error'
          );
        } finally {
          setUploadingMedia(false);
        }
      },
      [boardId, commitHistoryPatch, scheduleRender, showToast, syncCameraUi]
    );

    // Normalize image (inspect dimensions and ensure PNG/JPEG/WEBP)
    const normalizeImageBlob = useCallback(
      async (
        rawBlob: Blob
      ): Promise<{ blob: Blob; mimeType: string; width: number; height: number }> => {
        const objectUrl = URL.createObjectURL(rawBlob);
        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('Could not decode image file.'));
            el.src = objectUrl;
          });
          const width = Math.max(1, img.naturalWidth);
          const height = Math.max(1, img.naturalHeight);
          const supported = ['image/png', 'image/jpeg', 'image/webp'];
          if (supported.includes(rawBlob.type.toLowerCase())) {
            return { blob: rawBlob, mimeType: rawBlob.type.toLowerCase(), width, height };
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not process pasted image.');
          ctx.drawImage(img, 0, 0);
          const pngBlob = await canvasToPngBlob(canvas);
          return { blob: pngBlob, mimeType: 'image/png', width, height };
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      },
      []
    );

    // Upload & Place Photo or Pasted Screenshot
    const handlePhotoFile = useCallback(
      async (
        fileOrBlob: Blob,
        options?: { fileName?: string; dropClientCoords?: { clientX: number; clientY: number } }
      ) => {
        setUploadingMedia(true);
        showToast('Adding photo to page...');

        try {
          const normalized = await normalizeImageBlob(fileOrBlob);
          const fitScale = Math.min(
            1,
            680 / normalized.width,
            780 / normalized.height
          );
          const displayW = Math.max(24, Math.round(normalized.width * fitScale));
          const displayH = Math.max(24, Math.round(normalized.height * fitScale));

          let centerWorld: { x: number; y: number };
          if (options?.dropClientCoords && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            centerWorld = screenToWorld(
              options.dropClientCoords.clientX - rect.left,
              options.dropClientCoords.clientY - rect.top,
              cameraRef.current
            );
          } else {
            centerWorld = screenToWorld(
              viewportRef.current.width / 2,
              viewportRef.current.height / 2,
              cameraRef.current
            );
          }

          const x = Math.round(centerWorld.x - displayW / 2);
          const y = Math.round(centerWorld.y - displayH / 2);

          const photoId = generateId();
          const localPreviewUrl = URL.createObjectURL(normalized.blob);
          let imageUrl = localPreviewUrl;
          let storagePath = '';

          if (isSupabaseConfigured()) {
            const uploaded = await uploadPhotoAsset(
              boardId,
              normalized.blob,
              photoId,
              normalized.mimeType
            );
            imageUrl = uploaded.url;
            storagePath = uploaded.storagePath;
            registerLocalImagePreview(imageUrl, localPreviewUrl);
          }

          const now = Date.now();
          const photoObj: PhotoObject = {
            id: photoId,
            type: 'photo',
            imageUrl,
            storagePath,
            fileName: options?.fileName,
            x,
            y,
            width: displayW,
            height: displayH,
            naturalWidth: normalized.width,
            naturalHeight: normalized.height,
            locked: false,
            zIndex: getNextZIndex(objectsRef.current),
            createdAt: now,
            updatedAt: now,
          };

          commitHistoryPatch({
            before: { [photoId]: null },
            after: { [photoId]: photoObj },
          });

          showToast('Photo added to page');
        } catch (err) {
          showToast(
            err instanceof Error ? err.message : 'Failed to add photo.',
            'error'
          );
        } finally {
          setUploadingMedia(false);
        }
      },
      [boardId, commitHistoryPatch, normalizeImageBlob, showToast]
    );

    const handleMediaFiles = useCallback(
      async (
        files: FileList | File[],
        dropClientCoords?: { clientX: number; clientY: number }
      ) => {
        const list = Array.from(files);
        for (const file of list) {
          const lower = file.name.toLowerCase();
          if (file.type === 'application/pdf' || lower.endsWith('.pdf')) {
            await handlePdfFile(file, dropClientCoords);
          } else if (
            file.type.startsWith('image/') ||
            /\.(png|jpe?g|webp)$/i.test(lower)
          ) {
            await handlePhotoFile(file, {
              fileName: file.name,
              dropClientCoords,
            });
          } else {
            showToast(
              'Please choose a PDF or image file (PNG, JPG, WebP).',
              'error'
            );
          }
        }
      },
      [handlePdfFile, handlePhotoFile, showToast]
    );

    // Direct Screenshot / Photo Paste (Cmd/Ctrl + V)
    useEffect(() => {
      const handlePaste = (e: ClipboardEvent) => {
        const active = document.activeElement;
        if (
          active instanceof HTMLElement &&
          (active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.isContentEditable)
        ) {
          return;
        }

        const items = e.clipboardData?.items;
        let imageFile: File | null = null;
        if (items) {
          for (let i = 0; i < items.length; i += 1) {
            const item = items[i];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
              imageFile = item.getAsFile();
              if (imageFile) break;
            }
          }
        }
        if (!imageFile && e.clipboardData?.files) {
          for (let i = 0; i < e.clipboardData.files.length; i += 1) {
            const f = e.clipboardData.files[i];
            if (f.type.startsWith('image/')) {
              imageFile = f;
              break;
            }
          }
        }

        if (!imageFile) return;
        e.preventDefault();
        void handlePhotoFile(imageFile, {
          fileName: imageFile.name || 'Pasted Screenshot',
        });
      };

      window.addEventListener('paste', handlePaste);
      return () => window.removeEventListener('paste', handlePaste);
    }, [handlePhotoFile]);

    // Visual Area Snip Completion
    const finalizeSnip = useCallback(
      async (
        worldRect: BBox,
        lassoPolygon?: Array<[number, number]>
      ) => {
        const w = worldRect.maxX - worldRect.minX;
        const h = worldRect.maxY - worldRect.minY;
        if (w < 12 || h < 12) return;

        try {
          const dpr = Math.max(window.devicePixelRatio || 1, 2);
          const croppedCanvas = renderRegionToCanvas(worldRect, objectsRef.current, {
            scale: dpr,
            lassoPolygon,
            backgroundColor: '#ffffff',
          });
          const blob = await canvasToPngBlob(croppedCanvas);

          // Best-effort system clipboard copy
          let copiedToClipboard = false;
          if (
            typeof navigator !== 'undefined' &&
            navigator.clipboard &&
            typeof ClipboardItem !== 'undefined'
          ) {
            try {
              await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob }),
              ]);
              copiedToClipboard = true;
            } catch {
              // Clipboard permissions can vary across browsers; canvas insertion still proceeds
            }
          }

          const snipId = generateId();
          const localPreviewUrl = URL.createObjectURL(blob);
          let imageUrl = localPreviewUrl;
          let storagePath = '';

          if (isSupabaseConfigured()) {
            const uploaded = await uploadSnipAsset(boardId, blob, snipId);
            imageUrl = uploaded.url;
            storagePath = uploaded.storagePath;
            registerLocalImagePreview(imageUrl, localPreviewUrl);
          }

          const now = Date.now();
          const snipObj: SnipObject = {
            id: snipId,
            type: 'snip',
            imageUrl,
            storagePath,
            x: Math.round(worldRect.minX + 28),
            y: Math.round(worldRect.minY + 28),
            width: Math.round(w),
            height: Math.round(h),
            naturalWidth: croppedCanvas.width,
            naturalHeight: croppedCanvas.height,
            locked: false,
            zIndex: getNextZIndex(objectsRef.current),
            createdAt: now,
            updatedAt: now,
          };

          selectedIdsRef.current = new Set([snipId]);
          commitHistoryPatch({
            before: { [snipId]: null },
            after: { [snipId]: snipObj },
          });
          selectTool('select');
          selectedIdsRef.current = new Set([snipId]);
          syncSelectionUi();

          showToast(
            copiedToClipboard
              ? 'Snip inserted & copied to clipboard'
              : 'Snip cutout inserted onto board'
          );
        } catch (err) {
          showToast(
            err instanceof Error ? err.message : 'Failed to capture area snip.',
            'error'
          );
        }
      },
      [boardId, commitHistoryPatch, selectTool, showToast, syncSelectionUi]
    );

    // Keyboard shortcuts
    useEffect(() => {
      const isTextFocused = (target: EventTarget | null): boolean => {
        if (!(target instanceof HTMLElement)) return false;
        const tag = target.tagName;
        return (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          target.isContentEditable
        );
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (isTextFocused(e.target)) return;

        if (e.code === 'Space' && !e.repeat) {
          e.preventDefault();
          spaceHeldRef.current = true;
          if (interactionRef.current.type === 'idle') {
            setCursorCss('grab');
          }
          return;
        }

        const mod = e.metaKey || e.ctrlKey;
        const key = e.key.toLowerCase();

        if (mod && key === 'z') {
          e.preventDefault();
          if (e.shiftKey) redo();
          else undo();
          return;
        }
        if (mod && key === 'y') {
          e.preventDefault();
          redo();
          return;
        }
        if (mod && key === 'd') {
          e.preventDefault();
          duplicateSelection();
          return;
        }
        if (mod && (key === '=' || key === '+')) {
          e.preventDefault();
          zoomByFactor(1.2);
          return;
        }
        if (mod && key === '-') {
          e.preventDefault();
          zoomByFactor(1 / 1.2);
          return;
        }
        if (mod && key === '0') {
          e.preventDefault();
          resetZoom();
          return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (selectedIdsRef.current.size > 0) {
            e.preventDefault();
            deleteSelection();
          }
          return;
        }

        if (e.key === 'Escape') {
          selectedIdsRef.current.clear();
          syncSelectionUi();
          scheduleRender(true, true);
          return;
        }

        if (mod || e.altKey) return;

        if (key === 'p') selectTool('pen');
        else if (key === 'h') selectTool('highlighter');
        else if (key === 'e') selectTool('eraser');
        else if (key === 'v') selectTool('select');
        else if (key === 'r') selectTool('rect');
        else if (key === 'l') selectTool('line');
        else if (key === 's') selectTool('snip');
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          spaceHeldRef.current = false;
          if (interactionRef.current.type === 'idle') {
            const t = activeToolRef.current;
            setCursorCss(
              t === 'select' ? 'default' : t === 'eraser' ? 'none' : 'crosshair'
            );
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deleteSelection, duplicateSelection, redo, scheduleRender, selectTool, syncSelectionUi, undo]);

    const zoomAroundScreenPoint = useCallback(
      (screenX: number, screenY: number, nextZoomRaw: number) => {
        const prev = cameraRef.current;
        const nextZoom = clamp(nextZoomRaw, MIN_ZOOM, MAX_ZOOM);
        const worldX = (screenX - prev.x) / prev.zoom;
        const worldY = (screenY - prev.y) / prev.zoom;
        cameraRef.current = {
          x: screenX - worldX * nextZoom,
          y: screenY - worldY * nextZoom,
          zoom: nextZoom,
        };
        syncCameraUi();
        scheduleRender(true, true);
      },
      [scheduleRender, syncCameraUi]
    );

    const zoomByFactor = useCallback(
      (factor: number) => {
        const { width, height } = viewportRef.current;
        zoomAroundScreenPoint(
          width / 2,
          height / 2,
          cameraRef.current.zoom * factor
        );
      },
      [zoomAroundScreenPoint]
    );

    const resetZoom = useCallback(() => {
      const { width, height } = viewportRef.current;
      zoomAroundScreenPoint(width / 2, height / 2, 1);
    }, [zoomAroundScreenPoint]);

    // Wheel zoom & pan (non-passive so browser pinch-zoom doesn't hijack)
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;

      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const normDeltaY = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;

        if (e.ctrlKey || e.metaKey || (e.deltaX === 0 && !e.shiftKey)) {
          const sensitivity = e.ctrlKey || e.metaKey ? 0.008 : 0.0025;
          const factor = Math.exp(-normDeltaY * sensitivity);
          zoomAroundScreenPoint(sx, sy, cameraRef.current.zoom * factor);
        } else {
          const panX = e.shiftKey && e.deltaX === 0 ? normDeltaY : e.deltaX;
          const panY = e.shiftKey && e.deltaX === 0 ? 0 : normDeltaY;
          cameraRef.current = {
            ...cameraRef.current,
            x: cameraRef.current.x - panX,
            y: cameraRef.current.y - panY,
          };
          syncCameraUi();
          scheduleRender(true, true);
        }
      };

      el.addEventListener('wheel', handleWheel, { passive: false });
      return () => el.removeEventListener('wheel', handleWheel);
    }, [scheduleRender, syncCameraUi, zoomAroundScreenPoint]);

    // Eraser intersection helper along a segment
    const eraseAlongSegment = useCallback(
      (x1: number, y1: number, x2: number, y2: number, deletedMap: Map<string, SceneObject>) => {
        const radiusWorld = 16 / Math.max(cameraRef.current.zoom, 0.25);
        let erasedAny = false;

        for (const obj of Object.values(objectsRef.current)) {
          if (obj.locked) continue;
          if (obj.type !== 'stroke' && obj.type !== 'shape') continue;

          let hit = false;
          if (obj.type === 'stroke') {
            const box = getObjectBBox(obj);
            if (
              Math.max(x1, x2) + radiusWorld < box.minX ||
              Math.min(x1, x2) - radiusWorld > box.maxX ||
              Math.max(y1, y2) + radiusWorld < box.minY ||
              Math.min(y1, y2) - radiusWorld > box.maxY
            ) {
              continue;
            }
            const pts = obj.points;
            if (pts.length === 1) {
              hit =
                pointToSegmentDistance(pts[0][0], pts[0][1], x1, y1, x2, y2) <=
                radiusWorld + obj.size * 0.5;
            } else {
              for (let i = 0; i < pts.length; i += 1) {
                if (
                  pointToSegmentDistance(pts[i][0], pts[i][1], x1, y1, x2, y2) <=
                  radiusWorld + obj.size * 0.5
                ) {
                  hit = true;
                  break;
                }
              }
            }
          } else if (obj.type === 'shape') {
            const box = getObjectBBox(obj);
            if (
              Math.max(x1, x2) + radiusWorld < box.minX ||
              Math.min(x1, x2) - radiusWorld > box.maxX ||
              Math.max(y1, y2) + radiusWorld < box.minY ||
              Math.min(y1, y2) - radiusWorld > box.maxY
            ) {
              continue;
            }
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const zoom = cameraRef.current.zoom;
            hit =
              hitTestObject(midX, midY, obj, zoom) ||
              hitTestObject(x1, y1, obj, zoom) ||
              hitTestObject(x2, y2, obj, zoom);
          }

          if (hit) {
            deletedMap.set(obj.id, obj);
            delete objectsRef.current[obj.id];
            evictStrokeCache(obj.id);
            erasedAny = true;
          }
        }

        if (erasedAny) {
          scheduleRender(true, true);
        }
      },
      [scheduleRender]
    );

    const getPointerWorldCoords = (
      clientX: number,
      clientY: number
    ): { sx: number; sy: number; wx: number; wy: number } => {
      const rect = containerRef.current!.getBoundingClientRect();
      const sx = clientX - rect.left;
      const sy = clientY - rect.top;
      const w = screenToWorld(sx, sy, cameraRef.current);
      return { sx, sy, wx: w.x, wy: w.y };
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = liveCanvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);

      // Multi-touch pinch zoom tracking
      if (e.pointerType === 'touch') {
        activeTouchPointersRef.current.set(e.pointerId, {
          x: e.clientX,
          y: e.clientY,
        });
        if (activeTouchPointersRef.current.size === 2) {
          // Cancel single-finger stroke if pinch begins
          if (interactionRef.current.type === 'draw') {
            onLiveStrokeEnd(interactionRef.current.stroke.id);
          }
          interactionRef.current = { type: 'idle' };
          const pts = Array.from(activeTouchPointersRef.current.values());
          pinchLastRef.current = {
            dist: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y),
            midX: (pts[0].x + pts[1].x) / 2,
            midY: (pts[0].y + pts[1].y) / 2,
          };
          scheduleRender(false, true);
          return;
        }
      }

      const { wx, wy } = getPointerWorldCoords(e.clientX, e.clientY);

      // Middle mouse or Space+Drag panning
      if (e.button === 1 || spaceHeldRef.current) {
        interactionRef.current = {
          type: 'pan',
          lastClientX: e.clientX,
          lastClientY: e.clientY,
        };
        setCursorCss('grabbing');
        return;
      }

      if (e.button !== 0 && e.button !== 5) return;

      // Stylus barrel/tail eraser button (button === 5 or buttons === 32)
      const isStylusEraser =
        e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32) !== 0);
      const effectiveTool: ToolType = isStylusEraser
        ? 'eraser'
        : activeToolRef.current;

      if (effectiveTool === 'pen' || effectiveTool === 'highlighter') {
        const isPenInput = e.pointerType === 'pen';
        const hasRealPressure =
          isPenInput && e.pressure > 0 && Math.abs(e.pressure - 0.5) > 0.001;
        const pressure = hasRealPressure ? e.pressure : 0.5;
        const isHighlighter = effectiveTool === 'highlighter';
        const size = isHighlighter
          ? highlighterSizeRef.current
          : penSizeRef.current;
        const color = isHighlighter
          ? highlighterColorRef.current
          : penColorRef.current;
        const now = Date.now();

        const stroke: StrokeObject = {
          id: generateId(),
          type: 'stroke',
          tool: isHighlighter ? 'highlighter' : 'pen',
          color,
          size,
          opacity: isHighlighter ? 0.42 : 1,
          points: [[wx, wy, pressure]],
          bbox: computeStrokeBBox([[wx, wy, pressure]], size),
          simulatePressure: !isPenInput,
          zIndex: getNextZIndex(objectsRef.current),
          createdAt: now,
          updatedAt: now,
        };

        interactionRef.current = {
          type: 'draw',
          stroke,
          pointerId: e.pointerId,
        };

        onLiveStroke(
          {
            strokeId: stroke.id,
            tool: stroke.tool,
            color: stroke.color,
            size: stroke.size,
            opacity: stroke.opacity,
            points: stroke.points,
            simulatePressure: Boolean(stroke.simulatePressure),
          },
          true
        );
        scheduleRender(false, true);
        return;
      }

      if (effectiveTool === 'eraser') {
        const deletedMap = new Map<string, SceneObject>();
        const radiusWorld = 16 / Math.max(cameraRef.current.zoom, 0.25);
        eraserCursorRef.current = { x: wx, y: wy, radiusWorld };
        eraseAlongSegment(wx, wy, wx, wy, deletedMap);
        interactionRef.current = {
          type: 'erase',
          deletedIds: deletedMap,
          lastWorldX: wx,
          lastWorldY: wy,
        };
        scheduleRender(false, true);
        return;
      }

      if (
        effectiveTool === 'line' ||
        effectiveTool === 'arrow' ||
        effectiveTool === 'rect' ||
        effectiveTool === 'ellipse'
      ) {
        interactionRef.current = {
          type: 'shape',
          kind: effectiveTool,
          x1: wx,
          y1: wy,
          x2: wx,
          y2: wy,
        };
        scheduleRender(false, true);
        return;
      }

      if (effectiveTool === 'snip') {
        interactionRef.current = {
          type: 'snip',
          mode: snipModeRef.current,
          startWorldX: wx,
          startWorldY: wy,
          currentWorldX: wx,
          currentWorldY: wy,
          lassoPoints: [[wx, wy]],
        };
        scheduleRender(false, true);
        return;
      }

      if (effectiveTool === 'select') {
        // 1. Check resize handles of current selection
        const selectedObjects = Array.from(selectedIdsRef.current)
          .map((id) => objectsRef.current[id])
          .filter((o): o is SceneObject => Boolean(o));
        const currentSelBBox = getSelectionBBox(selectedObjects);
        const allUnlocked =
          selectedObjects.length > 0 && selectedObjects.every((o) => !o.locked);

        if (currentSelBBox && allUnlocked) {
          const hitHandle = hitTestResizeHandle(
            wx,
            wy,
            currentSelBBox,
            cameraRef.current.zoom
          );
          if (hitHandle) {
            const originals = new Map<string, SceneObject>();
            for (const o of selectedObjects) originals.set(o.id, o);
            interactionRef.current = {
              type: 'resize',
              handle: hitHandle.handle,
              startWorldX: wx,
              startWorldY: wy,
              initialBBox: currentSelBBox,
              originals,
            };
            return;
          }
        }

        // 2. Hit test topmost unlocked object (or sheet header pill, which also selects locked sheets)
        const hitObj = hitTestTopmostObject(
          wx,
          wy,
          objectsRef.current,
          cameraRef.current.zoom,
          { includeLocked: false, checkSheetHeaderPills: true }
        );

        if (hitObj) {
          if (e.shiftKey) {
            if (selectedIdsRef.current.has(hitObj.id)) {
              selectedIdsRef.current.delete(hitObj.id);
            } else {
              selectedIdsRef.current.add(hitObj.id);
            }
          } else if (!selectedIdsRef.current.has(hitObj.id)) {
            selectedIdsRef.current = new Set([hitObj.id]);
          }
          syncSelectionUi();

          const movingObjects = Array.from(selectedIdsRef.current)
            .map((id) => objectsRef.current[id])
            .filter((o): o is SceneObject => Boolean(o));

          if (movingObjects.every((o) => !o.locked)) {
            const originals = new Map<string, SceneObject>();
            for (const o of movingObjects) originals.set(o.id, o);
            interactionRef.current = {
              type: 'move',
              startWorldX: wx,
              startWorldY: wy,
              originals,
            };
          }
          scheduleRender(true, true);
          return;
        }

        // 3. Empty space or locked PDF -> start marquee box selection
        if (!e.shiftKey) {
          selectedIdsRef.current.clear();
          syncSelectionUi();
        }
        interactionRef.current = {
          type: 'marquee',
          startWorldX: wx,
          startWorldY: wy,
          currentWorldX: wx,
          currentWorldY: wy,
        };
        scheduleRender(true, true);
      }
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      // Handle two-finger touch pinch & pan
      if (e.pointerType === 'touch' && activeTouchPointersRef.current.has(e.pointerId)) {
        activeTouchPointersRef.current.set(e.pointerId, {
          x: e.clientX,
          y: e.clientY,
        });
        if (activeTouchPointersRef.current.size === 2 && pinchLastRef.current) {
          const pts = Array.from(activeTouchPointersRef.current.values());
          const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
          const midX = (pts[0].x + pts[1].x) / 2;
          const midY = (pts[0].y + pts[1].y) / 2;

          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const dMidX = midX - pinchLastRef.current.midX;
            const dMidY = midY - pinchLastRef.current.midY;
            cameraRef.current = {
              ...cameraRef.current,
              x: cameraRef.current.x + dMidX,
              y: cameraRef.current.y + dMidY,
            };
            const scaleFactor = dist / Math.max(1, pinchLastRef.current.dist);
            zoomAroundScreenPoint(
              midX - rect.left,
              midY - rect.top,
              cameraRef.current.zoom * scaleFactor
            );
          }

          pinchLastRef.current = { dist, midX, midY };
          return;
        }
      }

      const { wx, wy } = getPointerWorldCoords(e.clientX, e.clientY);
      const interaction = interactionRef.current;

      onCursorMove(
        wx,
        wy,
        activeToolRef.current,
        interaction.type === 'draw' || interaction.type === 'shape'
      );

      if (interaction.type === 'pan') {
        const dx = e.clientX - interaction.lastClientX;
        const dy = e.clientY - interaction.lastClientY;
        interaction.lastClientX = e.clientX;
        interaction.lastClientY = e.clientY;
        cameraRef.current = {
          ...cameraRef.current,
          x: cameraRef.current.x + dx,
          y: cameraRef.current.y + dy,
        };
        syncCameraUi();
        scheduleRender(true, true);
        return;
      }

      if (interaction.type === 'draw') {
        const nativeEvent = e.nativeEvent;
        const coalesced =
          typeof nativeEvent.getCoalescedEvents === 'function'
            ? nativeEvent.getCoalescedEvents()
            : [nativeEvent];
        const samples = coalesced.length > 0 ? coalesced : [nativeEvent];

        for (const sample of samples) {
          const pt = getPointerWorldCoords(sample.clientX, sample.clientY);
          const prevPt =
            interaction.stroke.points[interaction.stroke.points.length - 1];
          const dist = prevPt
            ? Math.hypot(pt.wx - prevPt[0], pt.wy - prevPt[1])
            : Infinity;

          // Deduplicate sub-pixel noise while preserving rapid curves
          if (dist < 0.75) continue;

          const hasRealPressure =
            sample.pointerType === 'pen' &&
            sample.pressure > 0 &&
            Math.abs(sample.pressure - 0.5) > 0.001;
          const pressure = hasRealPressure ? sample.pressure : 0.5;
          interaction.stroke.points.push([pt.wx, pt.wy, pressure]);
        }

        onLiveStroke({
          strokeId: interaction.stroke.id,
          tool: interaction.stroke.tool,
          color: interaction.stroke.color,
          size: interaction.stroke.size,
          opacity: interaction.stroke.opacity,
          points: interaction.stroke.points,
          simulatePressure: Boolean(interaction.stroke.simulatePressure),
        });
        scheduleRender(false, true);
        return;
      }

      if (interaction.type === 'erase') {
        const radiusWorld = 16 / Math.max(cameraRef.current.zoom, 0.25);
        eraserCursorRef.current = { x: wx, y: wy, radiusWorld };
        eraseAlongSegment(
          interaction.lastWorldX,
          interaction.lastWorldY,
          wx,
          wy,
          interaction.deletedIds
        );
        interaction.lastWorldX = wx;
        interaction.lastWorldY = wy;
        scheduleRender(false, true);
        return;
      }

      if (interaction.type === 'shape') {
        const snapped = constrainShapeEndpoint(
          interaction.kind,
          interaction.x1,
          interaction.y1,
          wx,
          wy,
          e.shiftKey
        );
        interaction.x2 = snapped.x2;
        interaction.y2 = snapped.y2;
        scheduleRender(false, true);
        return;
      }

      if (interaction.type === 'move') {
        const dx = wx - interaction.startWorldX;
        const dy = wy - interaction.startWorldY;
        const now = Date.now();
        for (const [id, orig] of interaction.originals.entries()) {
          objectsRef.current[id] = translateObject(orig, dx, dy, now);
          if (orig.type === 'stroke') evictStrokeCache(id);
        }
        scheduleRender(true, true);
        return;
      }

      if (interaction.type === 'resize') {
        const dx = wx - interaction.startWorldX;
        const dy = wy - interaction.startWorldY;
        const originalsArr = Array.from(interaction.originals.values());
        const keepRatio =
          e.shiftKey ||
          (originalsArr.length === 1 &&
            (originalsArr[0].type === 'snip' ||
              originalsArr[0].type === 'pdf-page' ||
              originalsArr[0].type === 'photo'));

        const nextBBox = applyHandleResize(
          interaction.initialBBox,
          interaction.handle,
          dx,
          dy,
          keepRatio
        );
        const now = Date.now();
        for (const [id, orig] of interaction.originals.entries()) {
          objectsRef.current[id] = scaleObjectInBounds(
            orig,
            interaction.initialBBox,
            nextBBox,
            now
          );
          if (orig.type === 'stroke') evictStrokeCache(id);
        }
        scheduleRender(true, true);
        return;
      }

      if (interaction.type === 'marquee') {
        interaction.currentWorldX = wx;
        interaction.currentWorldY = wy;
        scheduleRender(false, true);
        return;
      }

      if (interaction.type === 'snip') {
        interaction.currentWorldX = wx;
        interaction.currentWorldY = wy;
        if (interaction.mode === 'lasso') {
          const last =
            interaction.lassoPoints[interaction.lassoPoints.length - 1];
          if (!last || Math.hypot(wx - last[0], wy - last[1]) >= 4) {
            interaction.lassoPoints.push([wx, wy]);
          }
        }
        scheduleRender(false, true);
        return;
      }

      // Hover state updates (eraser preview / resize cursor)
      if (activeToolRef.current === 'eraser') {
        const radiusWorld = 16 / Math.max(cameraRef.current.zoom, 0.25);
        eraserCursorRef.current = { x: wx, y: wy, radiusWorld };
        scheduleRender(false, true);
      } else if (activeToolRef.current === 'select' && !spaceHeldRef.current) {
        const selectedObjects = Array.from(selectedIdsRef.current)
          .map((id) => objectsRef.current[id])
          .filter((o): o is SceneObject => Boolean(o));
        const selBBox = getSelectionBBox(selectedObjects);
        if (selBBox && selectedObjects.every((o) => !o.locked)) {
          const h = hitTestResizeHandle(wx, wy, selBBox, cameraRef.current.zoom);
          if (h) {
            setCursorCss(h.cursor);
            return;
          }
        }
        setCursorCss('default');
      }
    };

    const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === 'touch') {
        activeTouchPointersRef.current.delete(e.pointerId);
        if (activeTouchPointersRef.current.size < 2) {
          pinchLastRef.current = null;
        }
      }

      const interaction = interactionRef.current;
      interactionRef.current = { type: 'idle' };

      if (interaction.type === 'pan') {
        const t = activeToolRef.current;
        setCursorCss(
          spaceHeldRef.current
            ? 'grab'
            : t === 'select'
              ? 'default'
              : t === 'eraser'
                ? 'none'
                : 'crosshair'
        );
        return;
      }

      if (interaction.type === 'draw') {
        const roundedPoints = interaction.stroke.points.map(
          ([x, y, p]): [number, number, number] => [
            Math.round(x * 10) / 10,
            Math.round(y * 10) / 10,
            Math.round(p * 1000) / 1000,
          ]
        );
        const finalStroke: StrokeObject = {
          ...interaction.stroke,
          points: roundedPoints,
          bbox: computeStrokeBBox(roundedPoints, interaction.stroke.size),
          updatedAt: Date.now(),
        };
        onLiveStrokeEnd(finalStroke.id);
        commitHistoryPatch({
          before: { [finalStroke.id]: null },
          after: { [finalStroke.id]: finalStroke },
        });
        return;
      }

      if (interaction.type === 'erase') {
        if (interaction.deletedIds.size > 0) {
          const before: Record<string, SceneObject | null> = {};
          const after: Record<string, SceneObject | null> = {};
          for (const [id, obj] of interaction.deletedIds.entries()) {
            before[id] = obj;
            after[id] = null;
          }
          commitHistoryPatch({ before, after });
        }
        return;
      }

      if (interaction.type === 'shape') {
        const dist = Math.hypot(
          interaction.x2 - interaction.x1,
          interaction.y2 - interaction.y1
        );
        if (dist >= 4) {
          const now = Date.now();
          const shapeObj: ShapeObject = {
            id: generateId(),
            type: 'shape',
            shape: interaction.kind,
            x1: interaction.x1,
            y1: interaction.y1,
            x2: interaction.x2,
            y2: interaction.y2,
            color: penColorRef.current,
            strokeWidth: Math.max(2, penSizeRef.current),
            zIndex: getNextZIndex(objectsRef.current),
            createdAt: now,
            updatedAt: now,
          };
          commitHistoryPatch({
            before: { [shapeObj.id]: null },
            after: { [shapeObj.id]: shapeObj },
          });
        } else {
          scheduleRender(false, true);
        }
        return;
      }

      if (interaction.type === 'move' || interaction.type === 'resize') {
        const before: Record<string, SceneObject | null> = {};
        const after: Record<string, SceneObject | null> = {};
        for (const [id, orig] of interaction.originals.entries()) {
          const updated = objectsRef.current[id];
          if (updated && updated !== orig) {
            before[id] = orig;
            after[id] = updated;
          }
        }
        if (Object.keys(after).length > 0) {
          commitHistoryPatch({ before, after });
        } else {
          scheduleRender(true, true);
        }
        return;
      }

      if (interaction.type === 'marquee') {
        const box: BBox = {
          minX: Math.min(interaction.startWorldX, interaction.currentWorldX),
          minY: Math.min(interaction.startWorldY, interaction.currentWorldY),
          maxX: Math.max(interaction.startWorldX, interaction.currentWorldX),
          maxY: Math.max(interaction.startWorldY, interaction.currentWorldY),
        };
        if (box.maxX - box.minX > 4 || box.maxY - box.minY > 4) {
          for (const obj of Object.values(objectsRef.current)) {
            if (obj.locked) continue;
            if (rectsIntersect(getObjectBBox(obj), box)) {
              selectedIdsRef.current.add(obj.id);
            }
          }
          syncSelectionUi();
        }
        scheduleRender(true, true);
        return;
      }

      if (interaction.type === 'snip') {
        scheduleRender(false, true);
        if (interaction.mode === 'rect') {
          const rect: BBox = {
            minX: Math.min(interaction.startWorldX, interaction.currentWorldX),
            minY: Math.min(interaction.startWorldY, interaction.currentWorldY),
            maxX: Math.max(interaction.startWorldX, interaction.currentWorldX),
            maxY: Math.max(interaction.startWorldY, interaction.currentWorldY),
          };
          void finalizeSnip(rect);
        } else if (interaction.lassoPoints.length > 3) {
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          for (const [px, py] of interaction.lassoPoints) {
            if (px < minX) minX = px;
            if (py < minY) minY = py;
            if (px > maxX) maxX = px;
            if (py > maxY) maxY = py;
          }
          void finalizeSnip({ minX, minY, maxX, maxY }, interaction.lassoPoints);
        }
      }
    };

    const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (activeToolRef.current !== 'select') return;
      const { wx, wy } = getPointerWorldCoords(e.clientX, e.clientY);
      const hitLocked = hitTestTopmostObject(
        wx,
        wy,
        objectsRef.current,
        cameraRef.current.zoom,
        { includeLocked: true, checkSheetHeaderPills: true }
      );
      if (hitLocked && hitLocked.locked) {
        selectedIdsRef.current = new Set([hitLocked.id]);
        commitHistoryPatch({
          before: { [hitLocked.id]: hitLocked },
          after: { [hitLocked.id]: { ...hitLocked, locked: false, updatedAt: Date.now() } },
        });
        showToast('Sheet unlocked — drag to reposition');
      }
    };

    // Selected objects for SelectionActionBar
    const selectedObjects = selectedIdsUi
      .map((id) => objectsRef.current[id])
      .filter((o): o is SceneObject => Boolean(o));
    const selectionBBoxUi = getSelectionBBox(selectedObjects);

    return (
      <div
        ref={containerRef}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) {
            e.preventDefault();
            setDragOverMedia(true);
          }
        }}
        onDragLeave={() => setDragOverMedia(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverMedia(false);
          if (e.dataTransfer.files?.length) {
            void handleMediaFiles(e.dataTransfer.files, {
              clientX: e.clientX,
              clientY: e.clientY,
            });
          }
        }}
        className="relative h-full w-full flex-1 select-none overflow-hidden bg-desk-canvas"
        style={{ touchAction: 'none' }}
      >
        {/* Static/Committed Scene Canvas */}
        <canvas
          ref={sceneCanvasRef}
          className="pointer-events-none absolute inset-0 block"
        />

        {/* High-Frequency Interactive Overlay Canvas */}
        <canvas
          ref={liveCanvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUpOrCancel}
          onPointerCancel={handlePointerUpOrCancel}
          onPointerLeave={() => {
            eraserCursorRef.current = null;
            scheduleRender(false, true);
          }}
          onDoubleClick={handleDoubleClick}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute inset-0 block"
          style={{ cursor: cursorCss, touchAction: 'none' }}
        />

        {/* Hidden PDF / Photo File Picker */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="application/pdf,.pdf,image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            e.target.value = '';
            if (files.length > 0) void handleMediaFiles(files);
          }}
        />

        {/* Drag & Drop PDF / Photo Overlay */}
        {dragOverMedia && (
          <div className="pointer-events-none absolute inset-4 z-40 flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-desk-accent bg-desk-surface/90 text-desk-heading backdrop-blur-sm">
            <FileUp className="h-10 w-10 text-desk-accent" />
            <p className="mt-2 text-base font-semibold">
              Drop a PDF or photo onto the page
            </p>
          </div>
        )}

        {/* Toast Notification */}
        {toast && (
          <div
            role="status"
            className={`pointer-events-none absolute left-1/2 top-4 z-40 -translate-x-1/2 rounded-xl border px-4 py-2 text-xs font-semibold shadow-lg backdrop-blur-md ${
              toast.tone === 'error'
                ? 'border-rose-300 bg-rose-50/95 text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/90 dark:text-rose-200'
                : 'border-desk-border bg-desk-surface/95 text-desk-heading'
            }`}
          >
            {toast.text}
          </div>
        )}

        {/* Floating Selection Action Bar */}
        <SelectionActionBar
          selectionBBox={selectionBBoxUi}
          selectedObjects={selectedObjects}
          camera={cameraUi}
          viewportWidth={viewportUiWidth}
          onToggleLock={toggleSelectionLock}
          onDuplicate={duplicateSelection}
          onBringToFront={() => reorderSelectionZ('front')}
          onSendToBack={() => reorderSelectionZ('back')}
          onDelete={deleteSelection}
        />

        {/* Floating Bottom Toolbar */}
        <FloatingToolbar
          activeTool={activeTool}
          penColor={penColor}
          penSize={penSize}
          highlighterColor={highlighterColor}
          highlighterSize={highlighterSize}
          lastShapeTool={lastShapeTool}
          snipMode={snipMode}
          canUndo={historyCounts.undo > 0}
          canRedo={historyCounts.redo > 0}
          uploadingMedia={uploadingMedia}
          onSelectTool={selectTool}
          onPenColorChange={(c) => {
            penColorRef.current = c;
            setPenColor(c);
          }}
          onPenSizeChange={(s) => {
            penSizeRef.current = s;
            setPenSize(s);
          }}
          onHighlighterColorChange={(c) => {
            highlighterColorRef.current = c;
            setHighlighterColor(c);
          }}
          onHighlighterSizeChange={(s) => {
            highlighterSizeRef.current = s;
            setHighlighterSize(s);
          }}
          onSnipModeChange={(m) => {
            snipModeRef.current = m;
            setSnipMode(m);
          }}
          onAddPaper={handleAddPaper}
          onTriggerMediaUpload={() => fileInputRef.current?.click()}
          onUndo={undo}
          onRedo={redo}
        />

        {/* Zoom Controls */}
        <ZoomControls
          zoom={cameraUi.zoom}
          onZoomIn={() => zoomByFactor(1.25)}
          onZoomOut={() => zoomByFactor(1 / 1.25)}
          onResetZoom={resetZoom}
          onFitContent={fitContent}
        />
      </div>
    );
  }
);
