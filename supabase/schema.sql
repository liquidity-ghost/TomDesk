-- TomDesk Collaborative Tutoring Whiteboard Schema
-- Run this script in the Supabase SQL Editor (idempotent).

create extension if not exists "pgcrypto";

-- 1. Boards table
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  student_name text not null check (student_name in ('Isla', 'India', 'Ivy')),
  title text not null default 'Untitled Board',
  scene_data jsonb not null default '{"version":1,"objects":{}}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists boards_student_updated_idx
  on public.boards (student_name, updated_at desc);

-- Keep updated_at current automatically on updates
create or replace function public.set_boards_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists boards_set_updated_at on public.boards;
create trigger boards_set_updated_at
  before update on public.boards
  for each row
  execute function public.set_boards_updated_at();

-- Explicit table privileges required alongside RLS policies
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.boards to anon, authenticated;
grant execute on function public.set_boards_updated_at() to anon, authenticated;

-- Enable Row Level Security.
-- Note: Access to the TomDesk app is gated at the Next.js edge by the server-verified
-- HUB_PIN session cookie; once unlocked on a device, tutor and students share full
-- equal collaborative read/write access via the Supabase anon key.
alter table public.boards enable row level security;

drop policy if exists "boards_select_all" on public.boards;
create policy "boards_select_all"
  on public.boards
  for select
  to anon, authenticated
  using (true);

drop policy if exists "boards_insert_all" on public.boards;
create policy "boards_insert_all"
  on public.boards
  for insert
  to anon, authenticated
  with check (student_name in ('Isla', 'India', 'Ivy'));

drop policy if exists "boards_update_all" on public.boards;
create policy "boards_update_all"
  on public.boards
  for update
  to anon, authenticated
  using (true)
  with check (student_name in ('Isla', 'India', 'Ivy'));

drop policy if exists "boards_delete_all" on public.boards;
create policy "boards_delete_all"
  on public.boards
  for delete
  to anon, authenticated
  using (true);

-- 2. Storage bucket for PDFs and snipped PNG cutouts
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'board-assets',
  'board-assets',
  true,
  52428800,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "board_assets_select" on storage.objects;
create policy "board_assets_select"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'board-assets');

drop policy if exists "board_assets_insert" on storage.objects;
create policy "board_assets_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'board-assets');

drop policy if exists "board_assets_update" on storage.objects;
create policy "board_assets_update"
  on storage.objects
  for update
  to anon, authenticated
  using (bucket_id = 'board-assets')
  with check (bucket_id = 'board-assets');

drop policy if exists "board_assets_delete" on storage.objects;
create policy "board_assets_delete"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'board-assets');

notify pgrst, 'reload schema';
