import { getObjectBBox, pointInBBox } from './geometry';
import { canvasToPngBlob, renderRegionToCanvas } from './renderer';
import { downloadBlob, sanitizeFilename } from '@/lib/utils';
import type {
  BBox,
  PaperObject,
  PdfPageObject,
  PhotoObject,
  SceneObject,
} from '@/types/scene';

function computeAllObjectsBBox(objects: SceneObject[]): BBox | null {
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

  return {
    minX: minX - 48,
    minY: minY - 48,
    maxX: maxX + 48,
    maxY: maxY + 48,
  };
}

export async function exportBoardAsPng(
  objects: Record<string, SceneObject>,
  boardTitle: string
): Promise<void> {
  const list = Object.values(objects);
  const bounds = computeAllObjectsBBox(list) ?? {
    minX: 0,
    minY: 0,
    maxX: 1200,
    maxY: 850,
  };

  const canvas = renderRegionToCanvas(bounds, objects, {
    scale: 2,
    backgroundColor: '#FDF2F8',
  });
  const blob = await canvasToPngBlob(canvas);
  downloadBlob(blob, `${sanitizeFilename(boardTitle)}.png`);
}

function sortSheetsForPdfExport(
  sheets: Array<PaperObject | PdfPageObject | PhotoObject>
): Array<PaperObject | PdfPageObject | PhotoObject> {
  return [...sheets].sort((a, b) => {
    const rowDiff = Math.round(a.y / 250) - Math.round(b.y / 250);
    if (rowDiff !== 0) return rowDiff;
    return a.x - b.x;
  });
}

export async function exportBoardAsPdf(
  objects: Record<string, SceneObject>,
  boardTitle: string
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const list = Object.values(objects);

  const baseSheets = list.filter(
    (obj): obj is PaperObject | PdfPageObject =>
      obj.type === 'paper' || obj.type === 'pdf-page'
  );
  const baseSheetBoxes = baseSheets.map((s) => getObjectBBox(s));

  const standalonePhotos = list.filter((obj): obj is PhotoObject => {
    if (obj.type !== 'photo') return false;
    const cx = obj.x + obj.width / 2;
    const cy = obj.y + obj.height / 2;
    return !baseSheetBoxes.some((box) => pointInBBox(cx, cy, box));
  });

  const sheets = sortSheetsForPdfExport([...baseSheets, ...standalonePhotos]);

  const regions: Array<{ bbox: BBox; bg: string }> =
    sheets.length > 0
      ? sheets.map((s) => ({
          bbox: getObjectBBox(s),
          bg: '#ffffff',
        }))
      : [
          {
            bbox: computeAllObjectsBBox(list) ?? {
              minX: 0,
              minY: 0,
              maxX: 794,
              maxY: 1123,
            },
            bg: '#FDF2F8',
          },
        ];

  let pdf: InstanceType<typeof jsPDF> | null = null;

  for (let i = 0; i < regions.length; i += 1) {
    const { bbox, bg } = regions[i];
    const width = Math.max(100, bbox.maxX - bbox.minX);
    const height = Math.max(100, bbox.maxY - bbox.minY);
    const orientation = width > height ? 'landscape' : 'portrait';

    const canvas = renderRegionToCanvas(bbox, objects, {
      scale: 2,
      backgroundColor: bg,
    });
    const imgData = canvas.toDataURL('image/png', 1.0);

    if (!pdf) {
      pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [width, height],
        hotfixes: ['px_scaling'],
      });
    } else {
      pdf.addPage([width, height], orientation);
    }

    pdf.addImage(imgData, 'PNG', 0, 0, width, height, undefined, 'FAST');
  }

  if (pdf) {
    pdf.save(`${sanitizeFilename(boardTitle)}.pdf`);
  }
}
