import { clamp } from '@/lib/utils';
import {
  A4_HEIGHT,
  A4_WIDTH,
  type BBox,
  type Camera,
  type PaperObject,
  type PdfPageObject,
  type PhotoObject,
  type SceneObject,
  type ShapeKind,
  type ShapeObject,
  type StrokeObject,
  type StrokePoint,
} from '@/types/scene';

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export function screenToWorld(
  sx: number,
  sy: number,
  camera: Camera
): { x: number; y: number } {
  return {
    x: (sx - camera.x) / camera.zoom,
    y: (sy - camera.y) / camera.zoom,
  };
}

export function worldToScreen(
  wx: number,
  wy: number,
  camera: Camera
): { x: number; y: number } {
  return {
    x: wx * camera.zoom + camera.x,
    y: wy * camera.zoom + camera.y,
  };
}

export function computeStrokeBBox(points: StrokePoint[], size: number): BBox {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const [x, y] = points[i];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const pad = size * 0.75 + 3;
  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  };
}

export function getObjectBBox(obj: SceneObject): BBox {
  switch (obj.type) {
    case 'stroke':
      return obj.bbox ?? computeStrokeBBox(obj.points, obj.size);
    case 'paper':
    case 'pdf-page':
    case 'snip':
    case 'photo':
      return {
        minX: obj.x,
        minY: obj.y,
        maxX: obj.x + obj.width,
        maxY: obj.y + obj.height,
      };
    case 'shape': {
      const pad = Math.max(4, obj.strokeWidth * 0.75);
      return {
        minX: Math.min(obj.x1, obj.x2) - pad,
        minY: Math.min(obj.y1, obj.y2) - pad,
        maxX: Math.max(obj.x1, obj.x2) + pad,
        maxY: Math.max(obj.y1, obj.y2) + pad,
      };
    }
  }
}

export function getSelectionBBox(objects: SceneObject[]): BBox | null {
  if (objects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const obj of objects) {
    const b = getObjectBBox(obj);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }

  return { minX, minY, maxX, maxY };
}

export function rectsIntersect(a: BBox, b: BBox): boolean {
  return (
    a.minX <= b.maxX &&
    a.maxX >= b.minX &&
    a.minY <= b.maxY &&
    a.maxY >= b.minY
  );
}

export function pointInBBox(x: number, y: number, b: BBox, margin = 0): boolean {
  return (
    x >= b.minX - margin &&
    x <= b.maxX + margin &&
    y >= b.minY - margin &&
    y <= b.maxY + margin
  );
}

export function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function hitTestShape(
  wx: number,
  wy: number,
  shape: ShapeObject,
  zoom: number
): boolean {
  const tol = shape.strokeWidth * 0.65 + 8 / zoom;

  if (shape.shape === 'line' || shape.shape === 'arrow') {
    return (
      pointToSegmentDistance(wx, wy, shape.x1, shape.y1, shape.x2, shape.y2) <= tol
    );
  }

  const minX = Math.min(shape.x1, shape.x2);
  const maxX = Math.max(shape.x1, shape.x2);
  const minY = Math.min(shape.y1, shape.y2);
  const maxY = Math.max(shape.y1, shape.y2);

  if (shape.shape === 'rect') {
    if (!pointInBBox(wx, wy, { minX, minY, maxX, maxY }, tol)) return false;
    const dTop = pointToSegmentDistance(wx, wy, minX, minY, maxX, minY);
    const dRight = pointToSegmentDistance(wx, wy, maxX, minY, maxX, maxY);
    const dBottom = pointToSegmentDistance(wx, wy, minX, maxY, maxX, maxY);
    const dLeft = pointToSegmentDistance(wx, wy, minX, minY, minX, maxY);
    return Math.min(dTop, dRight, dBottom, dLeft) <= tol;
  }

  // Ellipse perimeter distance approximation
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const rx = Math.max(1, (maxX - minX) / 2);
  const ry = Math.max(1, (maxY - minY) / 2);
  const nx = (wx - cx) / rx;
  const ny = (wy - cy) / ry;
  const normDist = Math.hypot(nx, ny);
  if (normDist === 0) return false;
  // Approximate pixel distance from ellipse perimeter
  const radialPx = Math.abs(normDist - 1) * Math.min(rx, ry);
  return radialPx <= tol;
}

export function hitTestStroke(
  wx: number,
  wy: number,
  stroke: StrokeObject,
  zoom: number
): boolean {
  const tol = stroke.size * 0.6 + 6 / zoom;
  const bbox = getObjectBBox(stroke);
  if (!pointInBBox(wx, wy, bbox, tol)) return false;

  const pts = stroke.points;
  if (pts.length === 0) return false;
  if (pts.length === 1) {
    return Math.hypot(wx - pts[0][0], wy - pts[0][1]) <= tol;
  }

  for (let i = 0; i < pts.length - 1; i += 1) {
    const d = pointToSegmentDistance(
      wx,
      wy,
      pts[i][0],
      pts[i][1],
      pts[i + 1][0],
      pts[i + 1][1]
    );
    if (d <= tol) return true;
  }
  return false;
}

export function getSheetHeaderPillRect(
  sheet: PaperObject | PdfPageObject,
  zoom: number
): BBox {
  const scale = 1 / Math.max(zoom, 0.25);
  const height = 26 * scale;
  const width = (sheet.type === 'pdf-page' ? 175 : 140) * scale;
  const padY = 6 * scale;
  return {
    minX: sheet.x,
    minY: sheet.y - height - padY,
    maxX: sheet.x + Math.min(sheet.width, width),
    maxY: sheet.y - padY,
  };
}

export function hitTestObject(
  wx: number,
  wy: number,
  obj: SceneObject,
  zoom: number
): boolean {
  switch (obj.type) {
    case 'stroke':
      return hitTestStroke(wx, wy, obj, zoom);
    case 'shape':
      return hitTestShape(wx, wy, obj, zoom);
    case 'snip':
    case 'photo':
    case 'paper':
    case 'pdf-page': {
      const box = getObjectBBox(obj);
      return pointInBBox(wx, wy, box, 2 / zoom);
    }
  }
}

export function getLayerPriority(obj: SceneObject): number {
  switch (obj.type) {
    case 'paper':
    case 'pdf-page':
      return 1;
    case 'snip':
    case 'photo':
      return 2;
    case 'shape':
      return 3;
    case 'stroke':
      return obj.tool === 'highlighter' ? 4 : 5;
  }
}

export function sortObjectsForRender(objects: Iterable<SceneObject>): SceneObject[] {
  return Array.from(objects).sort((a, b) => {
    const layerDiff = getLayerPriority(a) - getLayerPriority(b);
    if (layerDiff !== 0) return layerDiff;
    return a.zIndex - b.zIndex;
  });
}

export function hitTestTopmostObject(
  wx: number,
  wy: number,
  objects: Record<string, SceneObject>,
  zoom: number,
  options?: { includeLocked?: boolean; checkSheetHeaderPills?: boolean }
): SceneObject | null {
  const includeLocked = options?.includeLocked ?? false;
  const checkSheetHeaderPills = options?.checkSheetHeaderPills ?? true;

  const sortedDesc = sortObjectsForRender(Object.values(objects)).reverse();

  // First check sheet header pills (above papers/PDFs) so locked PDFs can always be selected via their badge
  if (checkSheetHeaderPills) {
    for (const obj of sortedDesc) {
      if (obj.type === 'pdf-page' || obj.type === 'paper') {
        const pill = getSheetHeaderPillRect(obj, zoom);
        if (pointInBBox(wx, wy, pill, 2 / zoom)) {
          return obj;
        }
      }
    }
  }

  for (const obj of sortedDesc) {
    if (!includeLocked && obj.locked) continue;
    if (hitTestObject(wx, wy, obj, zoom)) {
      return obj;
    }
  }

  return null;
}

export function pointInPolygon(
  x: number,
  y: number,
  polygon: Array<[number, number]>
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function constrainShapeEndpoint(
  shape: ShapeKind,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  shiftKey: boolean
): { x2: number; y2: number } {
  if (!shiftKey) return { x2, y2 };
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (shape === 'line' || shape === 'arrow') {
    const len = Math.hypot(dx, dy);
    if (len === 0) return { x2, y2 };
    const angle = Math.atan2(dy, dx);
    const snapAngle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
    return {
      x2: x1 + Math.cos(snapAngle) * len,
      y2: y1 + Math.sin(snapAngle) * len,
    };
  }

  // Square / circle constraint
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  return {
    x2: x1 + (dx >= 0 ? size : -size),
    y2: y1 + (dy >= 0 ? size : -size),
  };
}

export function translateObject<T extends SceneObject>(
  obj: T,
  dx: number,
  dy: number,
  now = Date.now()
): T {
  switch (obj.type) {
    case 'stroke': {
      const points: StrokePoint[] = obj.points.map(([x, y, p]) => [
        x + dx,
        y + dy,
        p,
      ]);
      const bbox: BBox = {
        minX: obj.bbox.minX + dx,
        minY: obj.bbox.minY + dy,
        maxX: obj.bbox.maxX + dx,
        maxY: obj.bbox.maxY + dy,
      };
      return { ...obj, points, bbox, updatedAt: now };
    }
    case 'paper':
    case 'pdf-page':
    case 'snip':
    case 'photo':
      return {
        ...obj,
        x: obj.x + dx,
        y: obj.y + dy,
        updatedAt: now,
      };
    case 'shape':
      return {
        ...obj,
        x1: obj.x1 + dx,
        y1: obj.y1 + dy,
        x2: obj.x2 + dx,
        y2: obj.y2 + dy,
        updatedAt: now,
      };
  }
}

export function scaleObjectInBounds<T extends SceneObject>(
  obj: T,
  oldBBox: BBox,
  newBBox: BBox,
  now = Date.now()
): T {
  const oldW = Math.max(1, oldBBox.maxX - oldBBox.minX);
  const oldH = Math.max(1, oldBBox.maxY - oldBBox.minY);
  const newW = Math.max(12, newBBox.maxX - newBBox.minX);
  const newH = Math.max(12, newBBox.maxY - newBBox.minY);

  const mapX = (x: number) => newBBox.minX + ((x - oldBBox.minX) / oldW) * newW;
  const mapY = (y: number) => newBBox.minY + ((y - oldBBox.minY) / oldH) * newH;

  switch (obj.type) {
    case 'stroke': {
      const points: StrokePoint[] = obj.points.map(([x, y, p]) => [
        mapX(x),
        mapY(y),
        p,
      ]);
      return {
        ...obj,
        points,
        bbox: computeStrokeBBox(points, obj.size),
        updatedAt: now,
      };
    }
    case 'paper':
    case 'pdf-page':
    case 'snip':
    case 'photo': {
      const x1 = mapX(obj.x);
      const y1 = mapY(obj.y);
      const x2 = mapX(obj.x + obj.width);
      const y2 = mapY(obj.y + obj.height);
      return {
        ...obj,
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.max(24, Math.abs(x2 - x1)),
        height: Math.max(24, Math.abs(y2 - y1)),
        updatedAt: now,
      };
    }
    case 'shape':
      return {
        ...obj,
        x1: mapX(obj.x1),
        y1: mapY(obj.y1),
        x2: mapX(obj.x2),
        y2: mapY(obj.y2),
        updatedAt: now,
      };
  }
}

export interface HandleCoord {
  handle: ResizeHandle;
  x: number;
  y: number;
  cursor: string;
}

export function getResizeHandles(bbox: BBox): HandleCoord[] {
  const mx = (bbox.minX + bbox.maxX) / 2;
  const my = (bbox.minY + bbox.maxY) / 2;
  return [
    { handle: 'nw', x: bbox.minX, y: bbox.minY, cursor: 'nwse-resize' },
    { handle: 'n', x: mx, y: bbox.minY, cursor: 'ns-resize' },
    { handle: 'ne', x: bbox.maxX, y: bbox.minY, cursor: 'nesw-resize' },
    { handle: 'e', x: bbox.maxX, y: my, cursor: 'ew-resize' },
    { handle: 'se', x: bbox.maxX, y: bbox.maxY, cursor: 'nwse-resize' },
    { handle: 's', x: mx, y: bbox.maxY, cursor: 'ns-resize' },
    { handle: 'sw', x: bbox.minX, y: bbox.maxY, cursor: 'nesw-resize' },
    { handle: 'w', x: bbox.minX, y: my, cursor: 'ew-resize' },
  ];
}

export function hitTestResizeHandle(
  wx: number,
  wy: number,
  bbox: BBox,
  zoom: number
): HandleCoord | null {
  const radius = 9 / zoom;
  for (const item of getResizeHandles(bbox)) {
    if (Math.abs(wx - item.x) <= radius && Math.abs(wy - item.y) <= radius) {
      return item;
    }
  }
  return null;
}

export function applyHandleResize(
  initialBBox: BBox,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  keepAspectRatio: boolean
): BBox {
  let { minX, minY, maxX, maxY } = initialBBox;
  const minSize = 24;

  if (handle.includes('w')) {
    minX = Math.min(maxX - minSize, minX + dx);
  }
  if (handle.includes('e')) {
    maxX = Math.max(minX + minSize, maxX + dx);
  }
  if (handle.includes('n')) {
    minY = Math.min(maxY - minSize, minY + dy);
  }
  if (handle.includes('s')) {
    maxY = Math.max(minY + minSize, maxY + dy);
  }

  if (keepAspectRatio && handle.length === 2) {
    const origW = Math.max(1, initialBBox.maxX - initialBBox.minX);
    const origH = Math.max(1, initialBBox.maxY - initialBBox.minY);
    const ratio = origW / origH;
    const curW = maxX - minX;
    const curH = maxY - minY;
    if (curW / curH > ratio) {
      const targetH = curW / ratio;
      if (handle.includes('n')) {
        minY = maxY - targetH;
      } else {
        maxY = minY + targetH;
      }
    } else {
      const targetW = curH * ratio;
      if (handle.includes('w')) {
        minX = maxX - targetW;
      } else {
        maxX = minX + targetW;
      }
    }
  }

  return { minX, minY, maxX, maxY };
}

export function computeNextPaperPosition(
  objects: Record<string, SceneObject>,
  camera: Camera,
  viewportWidth: number,
  viewportHeight: number
): { x: number; y: number } {
  const sheets = Object.values(objects).filter(
    (obj): obj is PaperObject | PdfPageObject | PhotoObject =>
      obj.type === 'paper' || obj.type === 'pdf-page' || obj.type === 'photo'
  );

  if (sheets.length === 0) {
    const center = screenToWorld(viewportWidth / 2, viewportHeight / 2, camera);
    return {
      x: Math.round(center.x - A4_WIDTH / 2),
      y: Math.round(center.y - A4_HEIGHT / 2),
    };
  }

  // Prefer placing directly to the right of the visible sheets (or overall rightmost sheet)
  const viewTopLeft = screenToWorld(0, 0, camera);
  const viewBottomRight = screenToWorld(viewportWidth, viewportHeight, camera);
  const viewBBox: BBox = {
    minX: viewTopLeft.x,
    minY: viewTopLeft.y,
    maxX: viewBottomRight.x,
    maxY: viewBottomRight.y,
  };

  const visibleSheets = sheets.filter((s) => rectsIntersect(getObjectBBox(s), viewBBox));
  const candidates = visibleSheets.length > 0 ? visibleSheets : sheets;

  let rightmost = candidates[0];
  for (const sheet of candidates) {
    if (sheet.x + sheet.width > rightmost.x + rightmost.width) {
      rightmost = sheet;
    }
  }

  return {
    x: Math.round(rightmost.x + rightmost.width + 44),
    y: Math.round(rightmost.y),
  };
}

export function getNextZIndex(objects: Record<string, SceneObject>): number {
  let maxZ = 0;
  for (const obj of Object.values(objects)) {
    if (obj.zIndex > maxZ) maxZ = obj.zIndex;
  }
  return maxZ + 1;
}
