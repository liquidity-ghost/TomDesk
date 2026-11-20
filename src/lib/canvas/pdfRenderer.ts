import { generateId } from '@/lib/utils';
import type { PdfPageObject } from '@/types/scene';

type PdfJsModule = typeof import('pdfjs-dist');
type PDFDocumentProxy = import('pdfjs-dist').PDFDocumentProxy;

let pdfjsPromise: Promise<PdfJsModule> | null = null;
const docCache = new Map<string, Promise<PDFDocumentProxy>>();
const pageCanvasCache = new Map<string, HTMLCanvasElement>();
const pendingPageRenders = new Set<string>();

const PDF_RENDER_SCALE = 2.5; // High-DPI Retina clarity (2x-3x)
const TARGET_PAGE_DISPLAY_WIDTH = 794; // Match A4 display scale on canvas

async function getPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return mod;
    });
  }
  return pdfjsPromise;
}

function getCacheKey(pdfUrl: string, pageNumber: number): string {
  return `${pdfUrl}#page=${pageNumber}`;
}

async function renderPageToOffscreenCanvas(
  doc: PDFDocumentProxy,
  pageNumber: number
): Promise<{ canvas: HTMLCanvasElement; displayWidth: number; displayHeight: number }> {
  const page = await doc.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const fitScale = TARGET_PAGE_DISPLAY_WIDTH / Math.max(1, baseViewport.width);
  const displayWidth = Math.round(baseViewport.width * fitScale);
  const displayHeight = Math.round(baseViewport.height * fitScale);

  const renderViewport = page.getViewport({ scale: fitScale * PDF_RENDER_SCALE });
  const offscreen = document.createElement('canvas');
  offscreen.width = Math.max(1, Math.floor(renderViewport.width));
  offscreen.height = Math.max(1, Math.floor(renderViewport.height));

  const ctx = offscreen.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize 2D context for PDF page rendering.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, offscreen.width, offscreen.height);

  await page.render({
    canvasContext: ctx,
    viewport: renderViewport,
  }).promise;

  return { canvas: offscreen, displayWidth, displayHeight };
}

export async function renderPdfFileToPages(
  file: File,
  pdfUrl: string,
  storagePath: string,
  startX: number,
  startY: number,
  startZIndex: number,
  onProgress?: (completed: number, total: number) => void
): Promise<PdfPageObject[]> {
  const pdfjs = await getPdfJs();
  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const doc = await loadingTask.promise;

  docCache.set(pdfUrl, Promise.resolve(doc));

  const totalPages = doc.numPages;
  const createdPages: PdfPageObject[] = [];
  let cursorY = startY;
  const now = Date.now();

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    const { canvas, displayWidth, displayHeight } = await renderPageToOffscreenCanvas(
      doc,
      pageNumber
    );
    pageCanvasCache.set(getCacheKey(pdfUrl, pageNumber), canvas);

    createdPages.push({
      id: generateId(),
      type: 'pdf-page',
      pdfUrl,
      storagePath,
      fileName: file.name,
      pageNumber,
      totalPages,
      x: startX,
      y: cursorY,
      width: displayWidth,
      height: displayHeight,
      locked: true,
      zIndex: startZIndex + pageNumber - 1,
      createdAt: now,
      updatedAt: now,
    });

    cursorY += displayHeight + 36;
    onProgress?.(pageNumber, totalPages);
  }

  return createdPages;
}

export function getCachedPdfPageCanvas(
  pdfUrl: string,
  pageNumber: number
): HTMLCanvasElement | null {
  return pageCanvasCache.get(getCacheKey(pdfUrl, pageNumber)) ?? null;
}

async function getDocumentForUrl(pdfUrl: string): Promise<PDFDocumentProxy> {
  const cached = docCache.get(pdfUrl);
  if (cached) return cached;

  const promise = getPdfJs().then((pdfjs) => {
    const task = pdfjs.getDocument({ url: pdfUrl, withCredentials: false });
    return task.promise;
  });
  docCache.set(pdfUrl, promise);
  return promise;
}

export function ensurePdfPageRendered(
  pdfUrl: string,
  pageNumber: number,
  onReady: () => void
): void {
  const key = getCacheKey(pdfUrl, pageNumber);
  if (pageCanvasCache.has(key) || pendingPageRenders.has(key)) {
    return;
  }

  pendingPageRenders.add(key);

  void getDocumentForUrl(pdfUrl)
    .then((doc) => renderPageToOffscreenCanvas(doc, pageNumber))
    .then(({ canvas }) => {
      pageCanvasCache.set(key, canvas);
      pendingPageRenders.delete(key);
      onReady();
    })
    .catch(() => {
      pendingPageRenders.delete(key);
    });
}
