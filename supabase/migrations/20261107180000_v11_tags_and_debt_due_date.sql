-- v1.1 Fase A: etiquetas (tags + transaction_tags)
-- v1.1 Fase C: fecha de vencimiento en deudas

-- ---------------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------------
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#1DB954',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint tags_name_len check (char_length(trim(name)) > 0),
  constraint tags_color_hex check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint tags_user_name_unique unique (user_id, name)
);

create index tags_user_id_idx on public.tags (user_id);

create trigger tags_set_updated_at
before update on public.tags
for each row execute function private.set_updated_at();

alter table public.tags enable row level security;

create policy "tags_select_own"
  on public.tags for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "tags_insert_own"
  on public.tags for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "tags_update_own"
  on public.tags for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "tags_delete_own"
  on public.tags for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- transaction_tags (M2M)
-- ---------------------------------------------------------------------------
create table public.transaction_tags (
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (transaction_id, tag_id)
);

create index transaction_tags_user_id_idx on public.transaction_tags (user_id);
create index transaction_tags_tag_id_idx on public.transaction_tags (tag_id);
create index transaction_tags_transaction_id_idx on public.transaction_tags (transaction_id);

alter table public.transaction_tags enable row level security;

create policy "transaction_tags_select_own"
  on public.transaction_tags for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "transaction_tags_insert_own"
  on public.transaction_tags for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.transactions t
      where t.id = transaction_id and t.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.tags tg
      where tg.id = tag_id and tg.user_id = (select auth.uid())
    )
  );

create policy "transaction_tags_delete_own"
  on public.transaction_tags for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- debts.due_date (calendario)
-- ---------------------------------------------------------------------------
alter table public.debts
  add column if not exists due_date date;

create index if not exists debts_user_id_due_date_idx
  on public.debts (user_id, due_date)
  where due_date is not null and status = 'pending';
