import type { SceneData } from './scene';

export const STUDENTS = ['Isla', 'India', 'Ivy'] as const;

export type StudentName = (typeof STUDENTS)[number];
export type StudentSlug = 'isla' | 'india' | 'ivy';

export interface StudentMeta {
  name: StudentName;
  slug: StudentSlug;
  href: `/${StudentSlug}`;
  description: string;
  initial: string;
}

export const STUDENT_META: Record<StudentName, StudentMeta> = {
  Isla: {
    name: 'Isla',
    slug: 'isla',
    href: '/isla',
    description: "Isla's notes, practice sheets, and saved lessons.",
    initial: 'Is',
  },
  India: {
    name: 'India',
    slug: 'india',
    href: '/india',
    description: "India's notes, practice sheets, and saved lessons.",
    initial: 'In',
  },
  Ivy: {
    name: 'Ivy',
    slug: 'ivy',
    href: '/ivy',
    description: "Ivy's notes, practice sheets, and saved lessons.",
    initial: 'Iv',
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
