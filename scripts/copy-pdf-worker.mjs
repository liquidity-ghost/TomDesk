import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const sourceWorker = resolve(
  projectRoot,
  'node_modules',
  'pdfjs-dist',
  'build',
  'pdf.worker.min.mjs'
);
const publicDir = resolve(projectRoot, 'public');
const targetWorker = resolve(publicDir, 'pdf.worker.min.mjs');

if (!existsSync(sourceWorker)) {
  console.warn(
    `[copy-pdf-worker] Source worker not found at ${sourceWorker}. Skipping copy.`
  );
  process.exit(0);
}

mkdirSync(publicDir, { recursive: true });
copyFileSync(sourceWorker, targetWorker);
console.log(`[copy-pdf-worker] Copied pdf.worker.min.mjs -> ${targetWorker}`);
