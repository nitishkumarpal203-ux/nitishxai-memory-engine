create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  memory_text text not null,
  category text not null default 'general',
  importance integer not null default 5 check (importance between 1 and 5),
  embedding vector(1536),
  created_at timestamptz not null default now()
);

alter table public.memories
  add column if not exists embedding vector(1536);

alter table public.memories enable row level security;

drop policy if exists "Users can read own memories" on public.memories;
drop policy if exists "Users can insert own memories" on public.memories;
drop policy if exists "Users can update own memories" on public.memories;
drop policy if exists "Users can delete own memories" on public.memories;

create policy "Users can read own memories"
  on public.memories
  for select
  to authenticated
  using (auth.uid()::text = user_id);

create policy "Users can insert own memories"
  on public.memories
  for insert
  to authenticated
  with check (auth.uid()::text = user_id);

create policy "Users can update own memories"
  on public.memories
  for update
  to authenticated
  using (auth.uid()::text = user_id)
  with check (auth.uid()::text = user_id);

create policy "Users can delete own memories"
  on public.memories
  for delete
  to authenticated
  using (auth.uid()::text = user_id);

create index if not exists memories_user_created_at_idx
  on public.memories (user_id, created_at desc);

create index if not exists memories_user_memory_text_idx
  on public.memories (user_id, memory_text);

create index if not exists memories_embedding_idx
  on public.memories
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

create or replace function public.match_memories(
  match_user_id text,
  query_embedding vector(1536),
  match_count int default 50
)
returns table (
  id uuid,
  user_id text,
  memory_text text,
  category text,
  importance integer,
  created_at timestamptz,
  similarity double precision
)
language sql
stable
as $$
  select
    memories.id,
    memories.user_id,
    memories.memory_text,
    memories.category,
    memories.importance,
    memories.created_at,
    1 - (memories.embedding <=> query_embedding) as similarity
  from public.memories
  where memories.user_id = match_user_id
    and memories.embedding is not null
  order by memories.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 50), 50));
$$;
