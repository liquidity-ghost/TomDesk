import { getSupabaseClient } from './client';
import { deleteBoardStorageAssets } from './storage';
import { createEmptySceneData, normalizeSceneData } from '@/lib/utils';
import type { BoardRecord, BoardSummary, StudentName } from '@/types/board';
import type { SceneData } from '@/types/scene';

export async function listBoardsByStudent(
  student: StudentName
): Promise<BoardSummary[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('boards')
    .select('id, student_name, title, created_at, updated_at')
    .eq('student_name', student)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load boards: ${error.message}`);
  }

  return (data ?? []) as BoardSummary[];
}

export async function getBoardById(boardId: string): Promise<BoardRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('boards')
    .select('id, student_name, title, scene_data, created_at, updated_at')
    .eq('id', boardId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch board: ${error.message}`);
  }

  if (!data) return null;

  return {
    id: data.id as string,
    student_name: data.student_name as StudentName,
    title: data.title as string,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
    scene_data: normalizeSceneData(data.scene_data),
  };
}

export async function createBoard(
  student: StudentName,
  title = 'Untitled Board'
): Promise<BoardRecord> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const initialScene = createEmptySceneData();
  const { data, error } = await supabase
    .from('boards')
    .insert({
      student_name: student,
      title: title.trim() || 'Untitled Board',
      scene_data: initialScene,
    })
    .select('id, student_name, title, scene_data, created_at, updated_at')
    .single();

  if (error || !data) {
    throw new Error(`Failed to create board: ${error?.message ?? 'Unknown error'}`);
  }

  return {
    id: data.id as string,
    student_name: data.student_name as StudentName,
    title: data.title as string,
    created_at: data.created_at as string,
    updated_at: data.updated_at as string,
    scene_data: normalizeSceneData(data.scene_data),
  };
}

export async function renameBoard(boardId: string, title: string): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const cleanTitle = title.trim() || 'Untitled Board';
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('boards')
    .update({ title: cleanTitle, updated_at: nowIso })
    .eq('id', boardId)
    .select('updated_at')
    .single();

  if (error) {
    throw new Error(`Failed to rename board: ${error.message}`);
  }

  return (data?.updated_at as string | undefined) ?? nowIso;
}

export async function saveBoardScene(
  boardId: string,
  sceneData: SceneData
): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('boards')
    .update({
      scene_data: sceneData,
      updated_at: nowIso,
    })
    .eq('id', boardId)
    .select('updated_at')
    .single();

  if (error) {
    throw new Error(`Failed to save board: ${error.message}`);
  }

  return (data?.updated_at as string | undefined) ?? nowIso;
}

export async function deleteBoardWithAssets(boardId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const board = await getBoardById(boardId);
  await deleteBoardStorageAssets(boardId, board?.scene_data);

  const { error } = await supabase.from('boards').delete().eq('id', boardId);
  if (error) {
    throw new Error(`Failed to delete board: ${error.message}`);
  }
}
