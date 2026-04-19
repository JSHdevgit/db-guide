-- Run this in Supabase SQL Editor to set up the comments system

create table if not exists public.comments (
  id            uuid primary key default gen_random_uuid(),
  chapter_slug  text not null,
  parent_id     uuid references public.comments(id) on delete cascade,
  nickname      text not null check (char_length(nickname) between 1 and 40),
  body          text not null check (char_length(body) between 1 and 2000),
  password_hash text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  edited        boolean not null default false
);

create index if not exists comments_chapter_created_idx on public.comments (chapter_slug, created_at);
create index if not exists comments_parent_idx on public.comments (parent_id);

-- Public view that never exposes password_hash
create or replace view public.comments_public as
  select id, chapter_slug, parent_id, nickname, body,
         created_at, updated_at, edited
  from public.comments;

-- Enable RLS on the base table
alter table public.comments enable row level security;

-- Block direct access to comments table from anon/authenticated roles
-- All writes go through server-side API routes using the service role key
revoke all on public.comments from anon, authenticated;

-- Allow anon reads from the public view only
grant select on public.comments_public to anon, authenticated;
