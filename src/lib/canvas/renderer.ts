import getStroke from 'perfect-freehand';
import type { ThemeMode } from '@/components/theme/ThemeProvider';
import {
  getObjectBBox,
  getResizeHandles,
  getSheetHeaderPillRect,
  rectsIntersect,
  screenToWorld,
  sortObjectsForRender,
} from './geometry';
import { ensurePdfPageRendered, getCachedPdfPageCanvas } from './pdfRenderer';
import type {
  BBox,
  Camera,
  CursorPayload,
  LiveStrokePayload,
  PaperObject,
  PdfPageObject,
  PhotoObject,
  SceneObject,
  ShapeObject,
  SnipMode,
  SnipObject,
  StrokeObject,
  StrokePoint,
} from '@/types/scene';

const strokePathCache = new Map<string, { sig: string; path: Path2D }>();
const imageElementCache = new Map<string, HTMLImageElement>();
const localPreviewUrlByKey = new Map<string, string>();
const loadingImageKeys = new Set<string>();

export function registerLocalImagePreview(imageUrl: string, blobUrl: string): void {
  localPreviewUrlByKey.set(imageUrl, blobUrl);
  imageElementCache.delete(imageUrl);
}

export const registerLocalSnipPreview = registerLocalImagePreview;

export function evictStrokeCache(strokeId: string): void {
  strokePathCache.delete(strokeId);
}

function getStrokeSignature(stroke: {
  points: StrokePoint[];
  size: number;
  tool: 'pen' | 'highlighter';
  simulatePressure?: boolean;
}): string {
  const first = stroke.points[0];
  const last = stroke.points[stroke.points.length - 1];
  return `${stroke.tool}:${stroke.size}:${stroke.simulatePressure ? 1 : 0}:${
    stroke.points.length
  }:${first?.[0]?.toFixed(1) ?? 0},${first?.[1]?.toFixed(1) ?? 0}:${
    last?.[0]?.toFixed(1) ?? 0
  },${last?.[1]?.toFixed(1) ?? 0}`;
}

export function getSvgPathFromPoints(points: number[][]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const [x, y] = points[0];
    return `M ${x.toFixed(2)} ${y.toFixed(2)} a 1 1 0 1 0 0.01 0 Z`;
  }

  const d: string[] = [];
  const [firstX, firstY] = points[0];
  d.push(`M ${firstX.toFixed(2)} ${firstY.toFixed(2)}`);

  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    const midX = (x0 + x1) / 2;
    const midY = (y0 + y1) / 2;
    d.push(
      `Q ${x0.toFixed(2)} ${y0.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`
    );
  }

  const last = points[points.length - 1];
  d.push(`L ${last[0].toFixed(2)} ${last[1].toFixed(2)} Z`);
  return d.join(' ');
}

function buildFreehandPath2D(
  points: StrokePoint[],
  tool: 'pen' | 'highlighter',
  size: number,
  simulatePressure: boolean
): Path2D {
  const outline = getStroke(
    points,
    tool === 'highlighter'
      ? {
          size,
          thinning: 0,
          smoothing: 0.5,
          streamline: 0.5,
          simulatePressure: false,
          start: { cap: true },
          end: { cap: true },
        }
      : {
          size,
          thinning: 0.55,
          smoothing: 0.5,
          streamline: 0.45,
          simulatePressure,
        }
  );

  const svgPath = getSvgPathFromPoints(outline);
  return new Path2D(svgPath);
}

function getCachedStrokePath(stroke: StrokeObject): Path2D {
  const sig = getStrokeSignature(stroke);
  const existing = strokePathCache.get(stroke.id);
  if (existing && existing.sig === sig) {
    return existing.path;
  }
  const path = buildFreehandPath2D(
    stroke.points,
    stroke.tool,
    stroke.size,
    stroke.simulatePressure ?? false
  );
  strokePathCache.set(stroke.id, { sig, path });
  return path;
}

export function drawPaperObject(
  ctx: CanvasRenderingContext2D,
  paper: PaperObject,
  isExport = false
): void {
  const { x, y, width, height, template } = paper;

  // Paper Contrast Rule: always crisp white #FFFFFF with dark markings in both themes
  ctx.save();
  if (!isExport) {
    ctx.shadowColor = 'rgba(15, 23, 42, 0.14)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, width, height);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();

  if (template === 'lined') {
    const topMargin = 84;
    const lineSpacing = 28;
    ctx.strokeStyle = '#dbeafe';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let ly = y + topMargin; ly < y + height - 20; ly += lineSpacing) {
      ctx.moveTo(x, ly + 0.5);
      ctx.lineTo(x + width, ly + 0.5);
    }
    ctx.stroke();

    // Vertical left margin rule
    ctx.strokeStyle = '#fecdd3';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(x + 88.5, y);
    ctx.lineTo(x + 88.5, y + height);
    ctx.stroke();
  } else if (template === 'graph') {
    const minor = 24;
    const major = 120;

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    for (let gx = x + minor; gx < x + width; gx += minor) {
      ctx.moveTo(gx + 0.5, y);
      ctx.lineTo(gx + 0.5, y + height);
    }
    for (let gy = y + minor; gy < y + height; gy += minor) {
      ctx.moveTo(x, gy + 0.5);
      ctx.lineTo(x + width, gy + 0.5);
    }
    ctx.stroke();

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let gx = x + major; gx < x + width; gx += major) {
      ctx.moveTo(gx + 0.5, y);
      ctx.lineTo(gx + 0.5, y + height);
    }
    for (let gy = y + major; gy < y + height; gy += major) {
      ctx.moveTo(x, gy + 0.5);
      ctx.lineTo(x + width, gy + 0.5);
    }
    ctx.stroke();
  } else if (template === 'dot') {
    const spacing = 24;
    ctx.fillStyle = '#94a3b8';
    for (let dy = y + spacing; dy <= y + height - spacing; dy += spacing) {
      for (let dx = x + spacing; dx <= x + width - spacing; dx += spacing) {
        ctx.beginPath();
        ctx.arc(dx, dy, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  ctx.restore();

  ctx.save();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

export function drawPdfPageObject(
  ctx: CanvasRenderingContext2D,
  page: PdfPageObject,
  onPdfReady?: () => void,
  isExport = false
): void {
  const { x, y, width, height } = page;

  ctx.save();
  if (!isExport) {
    ctx.shadowColor = 'rgba(15, 23, 42, 0.16)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 7;
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, width, height);
  ctx.restore();

  const cachedCanvas = getCachedPdfPageCanvas(page.pdfUrl, page.pageNumber);
  if (cachedCanvas) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(cachedCanvas, x, y, width, height);
    ctx.restore();
  } else {
    if (onPdfReady) {
      ensurePdfPageRendered(page.pdfUrl, page.pageNumber, onPdfReady);
    }
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = '#64748b';
    ctx.font = '600 15px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `Loading ${page.fileName} — Page ${page.pageNumber}/${page.totalPages}...`,
      x + width / 2,
      y + height / 2
    );
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

function getOrLoadImage(
  imageUrl: string,
  onReady?: () => void
): HTMLImageElement | null {
  const cached = imageElementCache.get(imageUrl);
  if (cached) {
    return cached.complete && cached.naturalWidth > 0 ? cached : null;
  }

  if (loadingImageKeys.has(imageUrl)) {
    return null;
  }

  const effectiveSrc = localPreviewUrlByKey.get(imageUrl) ?? imageUrl;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  loadingImageKeys.add(imageUrl);

  img.onload = () => {
    loadingImageKeys.delete(imageUrl);
    imageElementCache.set(imageUrl, img);
    onReady?.();
  };
  img.onerror = () => {
    loadingImageKeys.delete(imageUrl);
  };
  img.src = effectiveSrc;
  return null;
}

export function drawImageObject(
  ctx: CanvasRenderingContext2D,
  item: SnipObject | PhotoObject,
  onImageReady?: () => void,
  isExport = false
): void {
  const { x, y, width, height } = item;
  const img = getOrLoadImage(item.imageUrl, onImageReady);

  ctx.save();
  if (!isExport) {
    ctx.shadowColor = 'rgba(15, 23, 42, 0.16)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, width, height);
  ctx.restore();

  if (img) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x, y, width, height);
    ctx.restore();
  } else {
    ctx.save();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = '#64748b';
    ctx.font = '500 13px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      item.type === 'photo' ? 'Loading photo...' : 'Loading snip...',
      x + width / 2,
      y + height / 2
    );
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

export const drawSnipObject = drawImageObject;

export function drawShapeObject(
  ctx: CanvasRenderingContext2D,
  shape: Pick<ShapeObject, 'shape' | 'x1' | 'y1' | 'x2' | 'y2' | 'color' | 'strokeWidth'>
): void {
  const { shape: kind, x1, y1, x2, y2, color, strokeWidth } = shape;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (kind === 'line') {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  } else if (kind === 'arrow') {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headLen = Math.max(12, strokeWidth * 3.8);
    const shaftEndX = x2 - Math.cos(angle) * headLen * 0.65;
    const shaftEndY = y2 - Math.sin(angle) * headLen * 0.65;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(shaftEndX, shaftEndY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - headLen * Math.cos(angle - Math.PI / 6),
      y2 - headLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      x2 - headLen * Math.cos(angle + Math.PI / 6),
      y2 - headLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'rect') {
    const rx = Math.min(x1, x2);
    const ry = Math.min(y1, y2);
    const rw = Math.abs(x2 - x1);
    const rh = Math.abs(y2 - y1);
    ctx.strokeRect(rx, ry, rw, rh);
  } else if (kind === 'ellipse') {
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawStrokeObject(
  ctx: CanvasRenderingContext2D,
  stroke: StrokeObject,
  isLivePreview = false
): void {
  if (stroke.points.length === 0) return;

  const path = isLivePreview
    ? buildFreehandPath2D(
        stroke.points,
        stroke.tool,
        stroke.size,
        stroke.simulatePressure ?? false
      )
    : getCachedStrokePath(stroke);

  ctx.save();
  ctx.fillStyle = stroke.color;
  if (stroke.tool === 'highlighter') {
    ctx.globalCompositeOperation = isLivePreview ? 'source-over' : 'multiply';
    ctx.globalAlpha = stroke.opacity;
  } else {
    ctx.globalAlpha = stroke.opacity;
  }
  ctx.fill(path);
  ctx.restore();
}

function drawInfiniteDotGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  camera: Camera,
  theme: ThemeMode
): void {
  let worldStep = 32;
  while (worldStep * camera.zoom < 18) {
    worldStep *= 2;
  }
  while (worldStep * camera.zoom > 64) {
    worldStep /= 2;
  }

  const topLeft = screenToWorld(0, 0, camera);
  const bottomRight = screenToWorld(width, height, camera);

  const startX = Math.floor(topLeft.x / worldStep) * worldStep;
  const endX = Math.ceil(bottomRight.x / worldStep) * worldStep;
  const startY = Math.floor(topLeft.y / worldStep) * worldStep;
  const endY = Math.ceil(bottomRight.y / worldStep) * worldStep;

  ctx.save();
  ctx.fillStyle =
    theme === 'dark'
      ? 'rgba(125, 211, 252, 0.16)'
      : 'rgba(219, 39, 119, 0.20)';
  const radius = Math.max(0.85, Math.min(1.4, 1.15 / camera.zoom));

  for (let wx = startX; wx <= endX; wx += worldStep) {
    for (let wy = startY; wy <= endY; wy += worldStep) {
      ctx.fillRect(wx - radius, wy - radius, radius * 2, radius * 2);
    }
  }
  ctx.restore();
}

function drawSheetHeaderPill(
  ctx: CanvasRenderingContext2D,
  sheet: PaperObject | PdfPageObject,
  camera: Camera,
  isSelected: boolean,
  theme: ThemeMode
): void {
  const pill = getSheetHeaderPillRect(sheet, camera.zoom);
  const w = pill.maxX - pill.minX;
  const h = pill.maxY - pill.minY;
  const invZoom = 1 / Math.max(camera.zoom, 0.25);
  const label =
    sheet.type === 'pdf-page'
      ? `PDF p.${sheet.pageNumber}/${sheet.totalPages}${sheet.locked ? ' · Locked' : ''}`
      : `${sheet.label ?? 'Paper'}${sheet.locked ? ' · Locked' : ''}`;

  ctx.save();
  if (theme === 'dark') {
    ctx.fillStyle = isSelected
      ? 'rgba(125, 211, 252, 0.95)'
      : 'rgba(19, 26, 42, 0.94)';
    ctx.strokeStyle = isSelected ? '#7DD3FC' : '#324160';
  } else {
    ctx.fillStyle = isSelected
      ? 'rgba(30, 58, 138, 0.94)'
      : 'rgba(255, 255, 255, 0.94)';
    ctx.strokeStyle = isSelected ? '#1E3A8A' : '#F3D5E5';
  }
  ctx.lineWidth = invZoom;

  const r = 6 * invZoom;
  ctx.beginPath();
  ctx.roundRect(pill.minX, pill.minY, w, h, r);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle =
    theme === 'dark'
      ? isSelected
        ? '#0B0F19'
        : '#7DD3FC'
      : isSelected
        ? '#FFFFFF'
        : '#1E3A8A';
  ctx.font = `600 ${11 * invZoom}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(label, pill.minX + 8 * invZoom, pill.minY + h / 2, w - 16 * invZoom);
  ctx.restore();
}

export function renderSceneCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  camera: Camera,
  objects: Record<string, SceneObject>,
  selectedIds: Set<string>,
  onAssetReady: () => void,
  theme: ThemeMode = 'light'
): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = theme === 'dark' ? '#0B0F19' : '#FDF2F8';
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(camera.x, camera.y);
  ctx.scale(camera.zoom, camera.zoom);

  drawInfiniteDotGrid(ctx, width, height, camera, theme);

  const tl = screenToWorld(0, 0, camera);
  const br = screenToWorld(width, height, camera);
  const viewBBox: BBox = {
    minX: tl.x - 100,
    minY: tl.y - 100,
    maxX: br.x + 100,
    maxY: br.y + 100,
  };

  const ordered = sortObjectsForRender(Object.values(objects));
  for (const obj of ordered) {
    if (!rectsIntersect(getObjectBBox(obj), viewBBox)) continue;

    switch (obj.type) {
      case 'paper':
        drawPaperObject(ctx, obj, false);
        drawSheetHeaderPill(ctx, obj, camera, selectedIds.has(obj.id), theme);
        break;
      case 'pdf-page':
        drawPdfPageObject(ctx, obj, onAssetReady, false);
        drawSheetHeaderPill(ctx, obj, camera, selectedIds.has(obj.id), theme);
        break;
      case 'snip':
      case 'photo':
        drawImageObject(ctx, obj, onAssetReady, false);
        break;
      case 'shape':
        drawShapeObject(ctx, obj);
        break;
      case 'stroke':
        drawStrokeObject(ctx, obj, false);
        break;
    }
  }

  ctx.restore();
}

export interface LiveOverlayState {
  camera: Camera;
  theme: ThemeMode;
  activeStroke: StrokeObject | null;
  remoteLiveStrokes: Map<string, LiveStrokePayload>;
  activeShape: Omit<ShapeObject, 'id' | 'zIndex' | 'createdAt' | 'updatedAt'> | null;
  marqueeBBox: BBox | null;
  selectionBBox: BBox | null;
  selectedObjectsCount: number;
  eraserCursor: { x: number; y: number; radiusWorld: number } | null;
  snipSelection: {
    mode: SnipMode;
    rect: BBox | null;
    lassoPoints: Array<[number, number]>;
  } | null;
  remoteCursors: Map<string, CursorPayload>;
}

export function renderLiveCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number,
  state: LiveOverlayState
): void {
  const { camera, theme } = state;
  const primaryColor = theme === 'dark' ? '#7DD3FC' : '#1E3A8A';
  const accentColor = theme === 'dark' ? '#F9A8D4' : '#EC4899';

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  ctx.save();
  ctx.translate(camera.x, camera.y);
  ctx.scale(camera.zoom, camera.zoom);

  // 1. Remote live strokes
  for (const remote of state.remoteLiveStrokes.values()) {
    const tempStroke: StrokeObject = {
      id: remote.strokeId,
      type: 'stroke',
      tool: remote.tool,
      color: remote.color,
      size: remote.size,
      opacity: remote.opacity,
      points: remote.points,
      simulatePressure: remote.simulatePressure,
      bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      zIndex: 0,
      createdAt: 0,
      updatedAt: 0,
    };
    drawStrokeObject(ctx, tempStroke, true);
  }

  // 2. Active local stroke
  if (state.activeStroke) {
    drawStrokeObject(ctx, state.activeStroke, true);
  }

  // 3. Active shape draft
  if (state.activeShape) {
    drawShapeObject(ctx, state.activeShape);
  }

  const invZoom = 1 / Math.max(camera.zoom, 0.25);

  // 4. Marquee selection box
  if (state.marqueeBBox) {
    const { minX, minY, maxX, maxY } = state.marqueeBBox;
    ctx.save();
    ctx.fillStyle =
      theme === 'dark'
        ? 'rgba(125, 211, 252, 0.10)'
        : 'rgba(236, 72, 153, 0.08)';
    ctx.strokeStyle = theme === 'dark' ? primaryColor : accentColor;
    ctx.lineWidth = 1.5 * invZoom;
    ctx.setLineDash([5 * invZoom, 4 * invZoom]);
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
    ctx.restore();
  }

  // 5. Selection bounding box & resize handles
  if (state.selectionBBox) {
    const { minX, minY, maxX, maxY } = state.selectionBBox;
    ctx.save();
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 1.5 * invZoom;
    ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);

    const handleSize = 8 * invZoom;
    for (const h of getResizeHandles(state.selectionBBox)) {
      ctx.fillStyle = theme === 'dark' ? '#131A2A' : '#FFFFFF';
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 1.5 * invZoom;
      ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
    }
    ctx.restore();
  }

  // 6. Eraser cursor preview
  if (state.eraserCursor) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(
      state.eraserCursor.x,
      state.eraserCursor.y,
      state.eraserCursor.radiusWorld,
      0,
      Math.PI * 2
    );
    ctx.fillStyle =
      theme === 'dark'
        ? 'rgba(249, 168, 212, 0.16)'
        : 'rgba(236, 72, 153, 0.14)';
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5 * invZoom;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // 7. Visual Area Snip overlay
  if (state.snipSelection) {
    const { mode, rect, lassoPoints } = state.snipSelection;
    if (mode === 'rect' && rect) {
      const w = rect.maxX - rect.minX;
      const h = rect.maxY - rect.minY;
      ctx.save();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2 * invZoom;
      ctx.setLineDash([6 * invZoom, 4 * invZoom]);
      ctx.fillStyle =
        theme === 'dark'
          ? 'rgba(249, 168, 212, 0.12)'
          : 'rgba(236, 72, 153, 0.10)';
      ctx.fillRect(rect.minX, rect.minY, w, h);
      ctx.strokeRect(rect.minX, rect.minY, w, h);
      ctx.setLineDash([]);

      // Dimension pill
      const label = `${Math.round(w)} × ${Math.round(h)} px`;
      ctx.font = `600 ${11 * invZoom}px system-ui, -apple-system, sans-serif`;
      const metrics = ctx.measureText(label);
      const pillW = metrics.width + 14 * invZoom;
      const pillH = 22 * invZoom;
      const pillX = rect.minX;
      const pillY = rect.maxY + 8 * invZoom;
      ctx.fillStyle = theme === 'dark' ? '#131A2A' : '#1E3A8A';
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 6 * invZoom);
      ctx.fill();
      ctx.fillStyle = theme === 'dark' ? '#7DD3FC' : '#FFFFFF';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, pillX + 7 * invZoom, pillY + pillH / 2);
      ctx.restore();
    } else if (mode === 'lasso' && lassoPoints.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lassoPoints[0][0], lassoPoints[0][1]);
      for (let i = 1; i < lassoPoints.length; i += 1) {
        ctx.lineTo(lassoPoints[i][0], lassoPoints[i][1]);
      }
      ctx.closePath();
      ctx.fillStyle =
        theme === 'dark'
          ? 'rgba(249, 168, 212, 0.12)'
          : 'rgba(236, 72, 153, 0.10)';
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2 * invZoom;
      ctx.setLineDash([6 * invZoom, 4 * invZoom]);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // 8. Remote Peer Cursors
  const now = Date.now();
  for (const cursor of state.remoteCursors.values()) {
    if (now - cursor.ts > 6000) continue;
    ctx.save();
    ctx.translate(cursor.x, cursor.y);
    ctx.scale(invZoom, invZoom);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 16);
    ctx.lineTo(5, 12);
    ctx.lineTo(12, 11);
    ctx.closePath();
    ctx.fillStyle = cursor.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = cursor.color;
    ctx.beginPath();
    ctx.roundRect(10, 13, 48, 18, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 10px system-ui, -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(cursor.isDrawing ? 'Writing' : 'Peer', 16, 22);
    ctx.restore();
  }

  ctx.restore();
}

export function renderRegionToCanvas(
  worldRect: BBox,
  objects: Record<string, SceneObject>,
  options: {
    scale: number;
    lassoPolygon?: Array<[number, number]>;
    backgroundColor?: string;
  }
): HTMLCanvasElement {
  const worldW = Math.max(1, worldRect.maxX - worldRect.minX);
  const worldH = Math.max(1, worldRect.maxY - worldRect.minY);

  const maxPixelDim = 4096;
  const maxAllowedScale = Math.min(
    options.scale,
    maxPixelDim / worldW,
    maxPixelDim / worldH
  );
  const scale = Math.max(0.25, maxAllowedScale);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(worldW * scale));
  canvas.height = Math.max(1, Math.round(worldH * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize offscreen rendering context.');
  }

  ctx.save();

  if (options.lassoPolygon && options.lassoPolygon.length > 2) {
    ctx.beginPath();
    ctx.moveTo(
      (options.lassoPolygon[0][0] - worldRect.minX) * scale,
      (options.lassoPolygon[0][1] - worldRect.minY) * scale
    );
    for (let i = 1; i < options.lassoPolygon.length; i += 1) {
      ctx.lineTo(
        (options.lassoPolygon[i][0] - worldRect.minX) * scale,
        (options.lassoPolygon[i][1] - worldRect.minY) * scale
      );
    }
    ctx.closePath();
    ctx.clip();
  }

  ctx.fillStyle = options.backgroundColor ?? '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.scale(scale, scale);
  ctx.translate(-worldRect.minX, -worldRect.minY);

  const ordered = sortObjectsForRender(Object.values(objects));
  for (const obj of ordered) {
    if (!rectsIntersect(getObjectBBox(obj), worldRect)) continue;

    switch (obj.type) {
      case 'paper':
        drawPaperObject(ctx, obj, true);
        break;
      case 'pdf-page':
        drawPdfPageObject(ctx, obj, undefined, true);
        break;
      case 'snip':
      case 'photo':
        drawImageObject(ctx, obj, undefined, true);
        break;
      case 'shape':
        drawShapeObject(ctx, obj);
        break;
      case 'stroke':
        drawStrokeObject(ctx, obj, false);
        break;
    }
  }

  ctx.restore();
  return canvas;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode PNG image from canvas.'));
          return;
        }
        resolve(blob);
      },
      'image/png',
      1.0
    );
  });
}
