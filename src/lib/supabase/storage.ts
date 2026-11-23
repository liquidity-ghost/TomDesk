import { getSupabaseClient } from './client';
import { generateId } from '@/lib/utils';
import type { SceneData } from '@/types/scene';

export const STORAGE_BUCKET = 'board-assets';

export interface UploadedAsset {
  url: string;
  storagePath: string;
}

export async function uploadPdfAsset(
  boardId: string,
  file: File
): Promise<UploadedAsset> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured. Add environment variables to upload PDFs.');
  }

  const storagePath = `pdfs/${boardId}/${generateId()}.pdf`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      contentType: 'application/pdf',
      cacheControl: '31536000',
      upsert: false,
    });

  if (error) {
    throw new Error(`PDF upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return {
    url: data.publicUrl,
    storagePath,
  };
}

export async function uploadSnipAsset(
  boardId: string,
  blob: Blob,
  snipId: string
): Promise<UploadedAsset> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured. Cannot upload snip cutout.');
  }

  const storagePath = `snips/${boardId}/${snipId}.png`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, blob, {
      contentType: 'image/png',
      cacheControl: '31536000',
      upsert: true,
    });

  if (error) {
    throw new Error(`Snip upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return {
    url: data.publicUrl,
    storagePath,
  };
}

function extensionForMimeType(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg';
  if (normalized === 'image/webp') return 'webp';
  return 'png';
}

export async function uploadPhotoAsset(
  boardId: string,
  blob: Blob,
  photoId: string,
  mimeType: string
): Promise<UploadedAsset> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured. Cannot upload photo.');
  }

  const ext = extensionForMimeType(mimeType);
  const contentType =
    ext === 'jpg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png';
  const storagePath = `photos/${boardId}/${photoId}.${ext}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, blob, {
      contentType,
      cacheControl: '31536000',
      upsert: true,
    });

  if (error) {
    throw new Error(`Photo upload failed: ${error.message}`);
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return {
    url: data.publicUrl,
    storagePath,
  };
}

export async function deleteBoardStorageAssets(
  boardId: string,
  sceneData?: SceneData
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const paths = new Set<string>();

  if (sceneData) {
    for (const obj of Object.values(sceneData.objects)) {
      if (
        (obj.type === 'pdf-page' || obj.type === 'snip' || obj.type === 'photo') &&
        obj.storagePath
      ) {
        paths.add(obj.storagePath);
      }
    }
  }

  for (const prefix of [`pdfs/${boardId}`, `snips/${boardId}`, `photos/${boardId}`]) {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(prefix, { limit: 1000 });
    if (!error && data) {
      for (const item of data) {
        if (item.name) {
          paths.add(`${prefix}/${item.name}`);
        }
      }
    }
  }

  const allPaths = Array.from(paths);
  if (allPaths.length === 0) return;

  const chunkSize = 100;
  for (let i = 0; i < allPaths.length; i += chunkSize) {
    const batch = allPaths.slice(i, i + chunkSize);
    await supabase.storage.from(STORAGE_BUCKET).remove(batch);
  }
}
