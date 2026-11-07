-- v1.2: plantillas rápidas + fotos de tickets

-- ---------------------------------------------------------------------------
-- transaction_templates
-- ---------------------------------------------------------------------------
create table if not exists public.transaction_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type public.transaction_type not null,
  amount numeric(14, 2) not null,
  account_id uuid references public.accounts (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  note text,
  sort_order int not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint transaction_templates_name_len check (char_length(trim(name)) > 0),
  constraint transaction_templates_amount_positive check (amount > 0)
);

create index if not exists transaction_templates_user_id_idx
  on public.transaction_templates (user_id, sort_order, created_at);

alter table public.transaction_templates enable row level security;

drop policy if exists "transaction_templates_select_own" on public.transaction_templates;
drop policy if exists "transaction_templates_insert_own" on public.transaction_templates;
drop policy if exists "transaction_templates_update_own" on public.transaction_templates;
drop policy if exists "transaction_templates_delete_own" on public.transaction_templates;

create policy "transaction_templates_select_own"
  on public.transaction_templates for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "transaction_templates_insert_own"
  on public.transaction_templates for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      account_id is null
      or exists (
        select 1 from public.accounts a
        where a.id = account_id and a.user_id = (select auth.uid())
      )
    )
    and (
      category_id is null
      or exists (
        select 1 from public.categories c
        where c.id = category_id and c.user_id = (select auth.uid())
      )
    )
  );

create policy "transaction_templates_update_own"
  on public.transaction_templates for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      account_id is null
      or exists (
        select 1 from public.accounts a
        where a.id = account_id and a.user_id = (select auth.uid())
      )
    )
    and (
      category_id is null
      or exists (
        select 1 from public.categories c
        where c.id = category_id and c.user_id = (select auth.uid())
      )
    )
  );

create policy "transaction_templates_delete_own"
  on public.transaction_templates for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- transactions.receipt_path
-- ---------------------------------------------------------------------------
alter table public.transactions
  add column if not exists receipt_path text;

comment on column public.transactions.receipt_path is
  'Ruta en bucket receipts: {user_id}/{transaction_id}/{filename}. No es URL pública.';

-- ---------------------------------------------------------------------------
-- Storage bucket receipts (privado)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  5242880,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "receipts_select_own_folder" on storage.objects;
drop policy if exists "receipts_insert_own_folder" on storage.objects;
drop policy if exists "receipts_update_own_folder" on storage.objects;
drop policy if exists "receipts_delete_own_folder" on storage.objects;

create policy "receipts_select_own_folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "receipts_insert_own_folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "receipts_update_own_folder"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  )
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

create policy "receipts_delete_own_folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- ---------------------------------------------------------------------------
-- replace_user_backup v3: receipt_path + transaction_templates
-- ---------------------------------------------------------------------------
create or replace function public.replace_user_backup(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_version int;
  v_profile jsonb;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Payload de copia inválido';
  end if;

  v_version := coalesce((p_payload ->> 'version')::int, 0);
  if v_version not in (1, 2, 3) then
    raise exception 'Versión de copia no soportada: %', v_version;
  end if;

  delete from public.debt_payments where user_id = v_uid;
  delete from public.goal_contributions where user_id = v_uid;
  delete from public.transaction_tags where user_id = v_uid;
  delete from public.transactions where user_id = v_uid;
  delete from public.transfers where user_id = v_uid;
  delete from public.budgets where user_id = v_uid;
  delete from public.recurring_rules where user_id = v_uid;
  delete from public.goals where user_id = v_uid;
  delete from public.debts where user_id = v_uid;
  delete from public.transaction_templates where user_id = v_uid;
  delete from public.tags where user_id = v_uid;
  delete from public.accounts where user_id = v_uid;
  delete from public.categories where user_id = v_uid;

  insert into public.accounts (
    id, user_id, name, type, color, opening_balance, is_active, created_at, updated_at
  )
  select
    (row ->> 'id')::uuid,
    v_uid,
    row ->> 'name',
    coalesce((row ->> 'type')::public.account_type, 'bank'),
    coalesce(row ->> 'color', '#1DB954'),
    coalesce((row ->> 'opening_balance')::numeric, 0),
    coalesce((row ->> 'is_active')::boolean, true),
    coalesce((row ->> 'created_at')::timestamptz, timezone('utc', now())),
    coalesce((row ->> 'updated_at')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(coalesce(p_payload -> 'accounts', '[]'::jsonb)) as row;

  insert into public.categories (
    id, user_id, name, kind, color, icon, is_active, is_system, created_at, updated_at
  )
  select
    (row ->> 'id')::uuid,
    v_uid,
    row ->> 'name',
    (row ->> 'kind')::public.category_kind,
    coalesce(row ->> 'color', '#1DB954'),
    row ->> 'icon',
    coalesce((row ->> 'is_active')::boolean, true),
    coalesce((row ->> 'is_system')::boolean, false),
    coalesce((row ->> 'created_at')::timestamptz, timezone('utc', now())),
    coalesce((row ->> 'updated_at')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(coalesce(p_payload -> 'categories', '[]'::jsonb)) as row;

  insert into public.tags (
    id, user_id, name, color, created_at, updated_at
  )
  select
    (row ->> 'id')::uuid,
    v_uid,
    row ->> 'name',
    coalesce(row ->> 'color', '#1DB954'),
    coalesce((row ->> 'created_at')::timestamptz, timezone('utc', now())),
    coalesce((row ->> 'updated_at')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(coalesce(p_payload -> 'tags', '[]'::jsonb)) as row;

  insert into public.transaction_templates (
    id, user_id, name, type, amount, account_id, category_id, note, sort_order, created_at
  )
  select
    (row ->> 'id')::uuid,
    v_uid,
    row ->> 'name',
    (row ->> 'type')::public.transaction_type,
    (row ->> 'amount')::numeric,
    nullif(row ->> 'account_id', '')::uuid,
    nullif(row ->> 'category_id', '')::uuid,
    row ->> 'note',
    coalesce((row ->> 'sort_order')::int, 0),
    coalesce((row ->> 'created_at')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(coalesce(p_payload -> 'transaction_templates', '[]'::jsonb)) as row;

  insert into public.debts (
    id, user_id, direction, person_name, principal, remaining, status, due_date, created_at, updated_at
  )
  select
    (row ->> 'id')::uuid,
    v_uid,
    (row ->> 'direction')::public.debt_direction,
    row ->> 'person_name',
    (row ->> 'principal')::numeric,
    (row ->> 'remaining')::numeric,
    coalesce((row ->> 'status')::public.debt_status, 'pending'),
    nullif(row ->> 'due_date', '')::date,
    coalesce((row ->> 'created_at')::timestamptz, timezone('utc', now())),
    coalesce((row ->> 'updated_at')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(coalesce(p_payload -> 'debts', '[]'::jsonb)) as row;

  insert into public.goals (
    id, user_id, name, target_amount, current_amount, status, color, deadline, created_at, updated_at
  )
  select
    (row ->> 'id')::uuid,
    v_uid,
    row ->> 'name',
    (row ->> 'target_amount')::numeric,
    coalesce((row ->> 'current_amount')::numeric, 0),
    coalesce((row ->> 'status')::public.goal_status, 'active'),
    coalesce(row ->> 'color', '#1DB954'),
    nullif(row ->> 'deadline', '')::date,
    coalesce((row ->> 'created_at')::timestamptz, timezone('utc', now())),
    coalesce((row ->> 'updated_at')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(coalesce(p_payload -> 'goals', '[]'::jsonb)) as row;

  insert into public.recurring_rules (
    id, user_id, type, amount, concept, account_id, category_id, frequency,
    next_occurrence, is_active, created_at, updated_at
  )
  select
    (row ->> 'id')::uuid,
    v_uid,
    (row ->> 'type')::public.transaction_type,
    (row ->> 'amount')::numeric,
    row ->> 'concept',
    nullif(row ->> 'account_id', '')::uuid,
    nullif(row ->> 'category_id', '')::uuid,
    coalesce((row ->> 'frequency')::public.recurring_frequency, 'monthly'),
    (row ->> 'next_occurrence')::date,
    coalesce((row ->> 'is_active')::boolean, true),
    coalesce((row ->> 'created_at')::timestamptz, timezone('utc', now())),
    coalesce((row ->> 'updated_at')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(coalesce(p_payload -> 'recurring_rules', '[]'::jsonb)) as row;

  insert into public.budgets (
    id, user_id, category_id, amount_limit, period_month, created_at, updated_at
  )
  select
    (row ->> 'id')::uuid,
    v_uid,
    (row ->> 'category_id')::uuid,
    (row ->> 'amount_limit')::numeric,
    (row ->> 'period_month')::date,
    coalesce((row ->> 'created_at')::timestamptz, timezone('utc', now())),
    coalesce((row ->> 'updated_at')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(coalesce(p_payload -> 'budgets', '[]'::jsonb)) as row;

  insert into public.transactions (
    id, user_id, account_id, category_id, type, amount, concept, note, occurred_at,
    is_cleared, recurring_id, debt_id, receipt_path, created_at, updated_at
  )
  select
    (row ->> 'id')::uuid,
    v_uid,
    (row ->> 'account_id')::uuid,
    nullif(row ->> 'category_id', '')::uuid,
    (row ->> 'type')::public.transaction_type,
    (row ->> 'amount')::numeric,
    row ->> 'concept',
    row ->> 'note',
    coalesce((row ->> 'occurred_at')::timestamptz, timezone('utc', now())),
    coalesce((row ->> 'is_cleared')::boolean, true),
    nullif(row ->> 'recurring_id', '')::uuid,
    nullif(row ->> 'debt_id', '')::uuid,
    nullif(row ->> 'receipt_path', ''),
    coalesce((row ->> 'created_at')::timestamptz, timezone('utc', now())),
    coalesce((row ->> 'updated_at')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(coalesce(p_payload -> 'transactions', '[]'::jsonb)) as row;

  insert into public.transfers (
    id, user_id, from_account_id, to_account_id, amount, concept, occurred_at, created_at, updated_at
  )
  select
    (row ->> 'id')::uuid,
    v_uid,
    (row ->> 'from_account_id')::uuid,
    (row ->> 'to_account_id')::uuid,
    (row ->> 'amount')::numeric,
    row ->> 'concept',
    coalesce((row ->> 'occurred_at')::timestamptz, timezone('utc', now())),
    coalesce((row ->> 'created_at')::timestamptz, timezone('utc', now())),
    coalesce((row ->> 'updated_at')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(coalesce(p_payload -> 'transfers', '[]'::jsonb)) as row;

  insert into public.transaction_tags (
    transaction_id, tag_id, user_id, created_at
  )
  select
    (row ->> 'transaction_id')::uuid,
    (row ->> 'tag_id')::uuid,
    v_uid,
    coalesce((row ->> 'created_at')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(coalesce(p_payload -> 'transaction_tags', '[]'::jsonb)) as row;

  insert into public.goal_contributions (
    id, user_id, goal_id, account_id, amount, occurred_at, transaction_id, created_at
  )
  select
    (row ->> 'id')::uuid,
    v_uid,
    (row ->> 'goal_id')::uuid,
    (row ->> 'account_id')::uuid,
    (row ->> 'amount')::numeric,
    coalesce((row ->> 'occurred_at')::timestamptz, timezone('utc', now())),
    nullif(row ->> 'transaction_id', '')::uuid,
    coalesce((row ->> 'created_at')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(coalesce(p_payload -> 'goal_contributions', '[]'::jsonb)) as row;

  insert into public.debt_payments (
    id, user_id, debt_id, amount, occurred_at, transaction_id, created_at
  )
  select
    (row ->> 'id')::uuid,
    v_uid,
    (row ->> 'debt_id')::uuid,
    (row ->> 'amount')::numeric,
    coalesce((row ->> 'occurred_at')::timestamptz, timezone('utc', now())),
    nullif(row ->> 'transaction_id', '')::uuid,
    coalesce((row ->> 'created_at')::timestamptz, timezone('utc', now()))
  from jsonb_array_elements(coalesce(p_payload -> 'debt_payments', '[]'::jsonb)) as row;

  v_profile := p_payload -> 'profile';
  if v_profile is not null and jsonb_typeof(v_profile) = 'object' then
    update public.profiles
    set
      display_name = coalesce(v_profile ->> 'display_name', display_name),
      accent_color = coalesce(v_profile ->> 'accent_color', accent_color),
      currency = coalesce(v_profile ->> 'currency', currency),
      locale = coalesce(v_profile ->> 'locale', locale),
      emergency_fund_target = case
        when v_profile ? 'emergency_fund_target' then
          nullif(v_profile ->> 'emergency_fund_target', '')::numeric
        else emergency_fund_target
      end,
      updated_at = timezone('utc', now())
    where id = v_uid;
  end if;
end;
$$;

revoke all on function public.replace_user_backup(jsonb) from public;
revoke all on function public.replace_user_backup(jsonb) from anon;
grant execute on function public.replace_user_backup(jsonb) to authenticated;

comment on function public.replace_user_backup(jsonb) is
  'Atomic replace import for ControlaTusFinanzas JSON backups (schema versions 1–3). Includes tags, templates, receipt_path (paths only; binary images not in JSON).';
