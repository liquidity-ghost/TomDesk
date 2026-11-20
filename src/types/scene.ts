export type ToolType =
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'select'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'snip';

export type ShapeKind = 'line' | 'arrow' | 'rect' | 'ellipse';
export type SnipMode = 'rect' | 'lasso';
export type PaperTemplateType = 'blank' | 'lined' | 'graph' | 'dot';

/** [worldX, worldY, pressure (0..1)] */
export type StrokePoint = [number, number, number];

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface BaseSceneObject {
  id: string;
  zIndex: number;
  locked?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface StrokeObject extends BaseSceneObject {
  type: 'stroke';
  tool: 'pen' | 'highlighter';
  color: string;
  size: number;
  opacity: number;
  points: StrokePoint[];
  bbox: BBox;
  simulatePressure?: boolean;
}

export interface PaperObject extends BaseSceneObject {
  type: 'paper';
  template: PaperTemplateType;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface PdfPageObject extends BaseSceneObject {
  type: 'pdf-page';
  pdfUrl: string;
  storagePath: string;
  fileName: string;
  pageNumber: number;
  totalPages: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnipObject extends BaseSceneObject {
  type: 'snip';
  imageUrl: string;
  storagePath: string;
  x: number;
  y: number;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
}

export interface ShapeObject extends BaseSceneObject {
  type: 'shape';
  shape: ShapeKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  strokeWidth: number;
}

export type SceneObject =
  | StrokeObject
  | PaperObject
  | PdfPageObject
  | SnipObject
  | ShapeObject;

export interface SceneData {
  version: 1;
  objects: Record<string, SceneObject>;
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface HistoryPatch {
  before: Record<string, SceneObject | null>;
  after: Record<string, SceneObject | null>;
}

export interface CursorPayload {
  clientId: string;
  x: number;
  y: number;
  color: string;
  tool: ToolType;
  isDrawing: boolean;
  ts: number;
}

export interface LiveStrokePayload {
  clientId: string;
  strokeId: string;
  tool: 'pen' | 'highlighter';
  color: string;
  size: number;
  opacity: number;
  points: StrokePoint[];
  simulatePressure: boolean;
}

export interface LiveStrokeEndPayload {
  clientId: string;
  strokeId: string;
}

export interface ScenePatchPayload {
  clientId: string;
  upserts: SceneObject[];
  deletes: string[];
}

export interface ColorPreset {
  name: string;
  value: string;
}

export const PEN_COLORS: ColorPreset[] = [
  { name: 'Black', value: '#111827' },
  { name: 'Navy', value: '#1e3a8a' },
  { name: 'Crimson', value: '#be123c' },
  { name: 'Emerald', value: '#047857' },
  { name: 'Royal Blue', value: '#2563eb' },
];

export const PEN_SIZES: number[] = [2.5, 4.5, 7.5, 12];

export const HIGHLIGHTER_COLORS: ColorPreset[] = [
  { name: 'Yellow', value: '#fde047' },
  { name: 'Mint', value: '#86efac' },
  { name: 'Sky', value: '#7dd3fc' },
  { name: 'Pink', value: '#f9a8d4' },
  { name: 'Orange', value: '#fdba74' },
];

export const HIGHLIGHTER_SIZES: number[] = [16, 24, 34];

export const A4_WIDTH = 794;
export const A4_HEIGHT = 1123;

export const PAPER_TEMPLATES: {
  id: PaperTemplateType;
  label: string;
  description: string;
}[] = [
  {
    id: 'blank',
    label: 'Blank Paper',
    description: 'Clean crisp A4 sheet',
  },
  {
    id: 'lined',
    label: 'Lined Paper',
    description: 'College-ruled with left margin',
  },
  {
    id: 'graph',
    label: 'Graph / Grid',
    description: 'Cartesian squares for algebra',
  },
  {
    id: 'dot',
    label: 'Dot Grid',
    description: 'Precision dot matrix',
  },
];
