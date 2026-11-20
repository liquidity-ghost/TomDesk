import type { SceneData, SceneObject } from '@/types/scene';

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatRelativeTime(isoDate: string): string {
  const timestamp = Date.parse(isoDate);
  if (Number.isNaN(timestamp)) return 'Just now';

  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeconds < 45) return 'Just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function createEmptySceneData(): SceneData {
  return {
    version: 1,
    objects: {},
  };
}

export function normalizeSceneData(raw: unknown): SceneData {
  if (!raw || typeof raw !== 'object') {
    return createEmptySceneData();
  }
  const candidate = raw as { version?: unknown; objects?: unknown };
  const rawObjects = candidate.objects;
  if (!rawObjects || typeof rawObjects !== 'object' || Array.isArray(rawObjects)) {
    return createEmptySceneData();
  }

  const normalized: Record<string, SceneObject> = {};
  for (const [id, value] of Object.entries(rawObjects as Record<string, unknown>)) {
    if (value && typeof value === 'object' && 'type' in value && 'id' in value) {
      normalized[id] = value as SceneObject;
    }
  }

  return {
    version: 1,
    objects: normalized,
  };
}

export function getSafeRedirectPath(raw: string | null): string {
  if (!raw) return '/isla';
  const trimmed = raw.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return '/isla';
  }
  if (trimmed === '/pin' || trimmed.startsWith('/pin?')) {
    return '/isla';
  }
  return trimmed;
}

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'whiteboard-export';
}
