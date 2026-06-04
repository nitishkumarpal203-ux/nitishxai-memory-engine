create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  memory_text text not null,
  category text not null default 'general',
  importance integer not null default 5 check (importance between 1 and 5),
  confidence numeric not null default 0.7 check (confidence >= 0 and confidence <= 1),
  memory_type text not null default 'idea'
    check (memory_type in ('goal', 'learning', 'startup', 'productivity', 'idea')),
  source text not null default 'memory'
    check (source in ('memory', 'chat')),
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  is_temporary boolean not null default false,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

alter table public.memories
  add column if not exists embedding vector(1536);

alter table public.memories
  add column if not exists confidence numeric not null default 0.7
    check (confidence >= 0 and confidence <= 1),
  add column if not exists memory_type text not null default 'idea'
    check (memory_type in ('goal', 'learning', 'startup', 'productivity', 'idea')),
  add column if not exists source text not null default 'memory'
    check (source in ('memory', 'chat')),
  add column if not exists is_pinned boolean not null default false,
  add column if not exists is_archived boolean not null default false,
  add column if not exists is_temporary boolean not null default false;

update public.memories
set source = 'chat',
    is_temporary = true
where source = 'memory'
  and (
    memory_text in (
      'What are my goals?',
      'Suggest a project for me',
      'What should I focus on this week?',
      'Summarize my memories'
    )
    or memory_text ~* '^(what|when|where|why|how|who|can|could|should|would|do|does|did|is|are)([[:space:]]|$)'
  );

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

create index if not exists memories_user_active_created_at_idx
  on public.memories (user_id, is_pinned desc, created_at desc)
  where source = 'memory' and is_archived = false and is_temporary = false;

create index if not exists memories_user_type_idx
  on public.memories (user_id, memory_type, confidence desc)
  where source = 'memory' and is_archived = false and is_temporary = false;

create index if not exists memories_user_memory_text_idx
  on public.memories (user_id, memory_text);

create index if not exists memories_embedding_idx
  on public.memories
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

drop function if exists public.match_memories(text, vector, int);

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
  confidence numeric,
  memory_type text,
  source text,
  is_pinned boolean,
  is_archived boolean,
  is_temporary boolean,
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
    memories.confidence,
    memories.memory_type,
    memories.source,
    memories.is_pinned,
    memories.is_archived,
    memories.is_temporary,
    memories.created_at,
    1 - (memories.embedding <=> query_embedding) as similarity
  from public.memories
  where memories.user_id = match_user_id
    and memories.embedding is not null
    and memories.source = 'memory'
    and memories.is_archived = false
    and memories.is_temporary = false
  order by memories.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 50), 50));
$$;
