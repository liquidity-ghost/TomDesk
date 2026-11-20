import type { SceneData } from './scene';

export const STUDENTS = ['Isla', 'India', 'Ivy'] as const;

export type StudentName = (typeof STUDENTS)[number];
export type StudentSlug = 'isla' | 'india' | 'ivy';

export interface StudentMeta {
  name: StudentName;
  slug: StudentSlug;
  href: `/${StudentSlug}`;
  accentHex: string;
  badgeBgClass: string;
  badgeTextClass: string;
  activeNavClass: string;
  dotClass: string;
  cardBorderHoverClass: string;
}

export const STUDENT_META: Record<StudentName, StudentMeta> = {
  Isla: {
    name: 'Isla',
    slug: 'isla',
    href: '/isla',
    accentHex: '#4f46e5',
    badgeBgClass: 'bg-indigo-50',
    badgeTextClass: 'text-indigo-700',
    activeNavClass: 'bg-indigo-600 text-white shadow-sm',
    dotClass: 'bg-indigo-500',
    cardBorderHoverClass: 'hover:border-indigo-300 hover:shadow-indigo-100/60',
  },
  India: {
    name: 'India',
    slug: 'india',
    href: '/india',
    accentHex: '#059669',
    badgeBgClass: 'bg-emerald-50',
    badgeTextClass: 'text-emerald-700',
    activeNavClass: 'bg-emerald-600 text-white shadow-sm',
    dotClass: 'bg-emerald-500',
    cardBorderHoverClass: 'hover:border-emerald-300 hover:shadow-emerald-100/60',
  },
  Ivy: {
    name: 'Ivy',
    slug: 'ivy',
    href: '/ivy',
    accentHex: '#7c3aed',
    badgeBgClass: 'bg-violet-50',
    badgeTextClass: 'text-violet-700',
    activeNavClass: 'bg-violet-600 text-white shadow-sm',
    dotClass: 'bg-violet-500',
    cardBorderHoverClass: 'hover:border-violet-300 hover:shadow-violet-100/60',
  },
};

export interface BoardSummary {
  id: string;
  student_name: StudentName;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface BoardRecord extends BoardSummary {
  scene_data: SceneData;
}

export type SyncStatus = 'saved' | 'saving' | 'offline' | 'error';
