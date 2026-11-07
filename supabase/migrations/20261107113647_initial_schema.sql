-- ControlaTusFinanzas — schema inicial (fase 1)
-- Principios: RLS por usuario, índices en user_id/FKs, funciones definer en schema privado.

create extension if not exists "pgcrypto";

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to postgres, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.account_type as enum ('bank', 'cash', 'card', 'other');
create type public.category_kind as enum ('income', 'expense');
create type public.transaction_type as enum ('income', 'expense');
create type public.goal_status as enum ('active', 'paused', 'completed');
create type public.debt_direction as enum ('owe', 'owed');
create type public.debt_status as enum ('pending', 'settled');
create type public.recurring_frequency as enum ('weekly', 'biweekly', 'monthly', 'yearly');

-- ---------------------------------------------------------------------------
-- updated_at helper (privado)
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  accent_color text not null default '#1DB954',
  currency text not null default 'EUR',
  locale text not null default 'es',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_accent_color_hex check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint profiles_currency_len check (char_length(currency) between 3 and 3)
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type public.account_type not null default 'bank',
  color text not null default '#1DB954',
  opening_balance numeric(14, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint accounts_name_len check (char_length(trim(name)) > 0)
);

create index accounts_user_id_idx on public.accounts (user_id);
create index accounts_user_id_active_idx on public.accounts (user_id) where is_active;

create trigger accounts_set_updated_at
before update on public.accounts
for each row execute function private.set_updated_at();

alter table public.accounts enable row level security;

create policy "accounts_select_own"
  on public.accounts for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "accounts_insert_own"
  on public.accounts for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "accounts_update_own"
  on public.accounts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "accounts_delete_own"
  on public.accounts for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  kind public.category_kind not null,
  color text not null default '#1DB954',
  icon text,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint categories_name_len check (char_length(trim(name)) > 0)
);

create index categories_user_id_idx on public.categories (user_id);
create index categories_user_id_kind_idx on public.categories (user_id, kind);
create index categories_user_id_active_idx on public.categories (user_id) where is_active;

create trigger categories_set_updated_at
before update on public.categories
for each row execute function private.set_updated_at();

alter table public.categories enable row level security;

create policy "categories_select_own"
  on public.categories for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "categories_insert_own"
  on public.categories for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "categories_update_own"
  on public.categories for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "categories_delete_own"
  on public.categories for delete to authenticated
  using ((select auth.uid()) = user_id and is_system = false);

-- ---------------------------------------------------------------------------
-- recurring_rules (stub for phase 3; referenced optionally by transactions)
-- ---------------------------------------------------------------------------
create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.transaction_type not null,
  amount numeric(14, 2) not null check (amount > 0),
  concept text not null,
  account_id uuid references public.accounts (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  frequency public.recurring_frequency not null default 'monthly',
  next_occurrence date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index recurring_rules_user_id_idx on public.recurring_rules (user_id);
create index recurring_rules_account_id_idx on public.recurring_rules (account_id);
create index recurring_rules_category_id_idx on public.recurring_rules (category_id);

create trigger recurring_rules_set_updated_at
before update on public.recurring_rules
for each row execute function private.set_updated_at();

alter table public.recurring_rules enable row level security;

create policy "recurring_rules_select_own"
  on public.recurring_rules for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "recurring_rules_insert_own"
  on public.recurring_rules for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "recurring_rules_update_own"
  on public.recurring_rules for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "recurring_rules_delete_own"
  on public.recurring_rules for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- debts (stub for phase 3)
-- ---------------------------------------------------------------------------
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  direction public.debt_direction not null,
  person_name text not null,
  principal numeric(14, 2) not null check (principal >= 0),
  remaining numeric(14, 2) not null check (remaining >= 0),
  status public.debt_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint debts_person_name_len check (char_length(trim(person_name)) > 0)
);

create index debts_user_id_idx on public.debts (user_id);
create index debts_user_id_status_idx on public.debts (user_id, status);

create trigger debts_set_updated_at
before update on public.debts
for each row execute function private.set_updated_at();

alter table public.debts enable row level security;

create policy "debts_select_own"
  on public.debts for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "debts_insert_own"
  on public.debts for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "debts_update_own"
  on public.debts for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "debts_delete_own"
  on public.debts for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  category_id uuid references public.categories (id) on delete set null,
  type public.transaction_type not null,
  amount numeric(14, 2) not null check (amount > 0),
  concept text not null,
  note text,
  occurred_at timestamptz not null default timezone('utc', now()),
  is_cleared boolean not null default true,
  recurring_id uuid references public.recurring_rules (id) on delete set null,
  debt_id uuid references public.debts (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint transactions_concept_len check (char_length(trim(concept)) > 0)
);

create index transactions_user_id_idx on public.transactions (user_id);
create index transactions_user_id_occurred_at_idx on public.transactions (user_id, occurred_at desc);
create index transactions_account_id_idx on public.transactions (account_id);
create index transactions_category_id_idx on public.transactions (category_id);
create index transactions_recurring_id_idx on public.transactions (recurring_id);
create index transactions_debt_id_idx on public.transactions (debt_id);

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function private.set_updated_at();

alter table public.transactions enable row level security;

create policy "transactions_select_own"
  on public.transactions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "transactions_insert_own"
  on public.transactions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "transactions_update_own"
  on public.transactions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "transactions_delete_own"
  on public.transactions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- transfers
-- ---------------------------------------------------------------------------
create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  from_account_id uuid not null references public.accounts (id) on delete restrict,
  to_account_id uuid not null references public.accounts (id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  concept text,
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint transfers_distinct_accounts check (from_account_id <> to_account_id)
);

create index transfers_user_id_idx on public.transfers (user_id);
create index transfers_user_id_occurred_at_idx on public.transfers (user_id, occurred_at desc);
create index transfers_from_account_id_idx on public.transfers (from_account_id);
create index transfers_to_account_id_idx on public.transfers (to_account_id);

create trigger transfers_set_updated_at
before update on public.transfers
for each row execute function private.set_updated_at();

alter table public.transfers enable row level security;

create policy "transfers_select_own"
  on public.transfers for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "transfers_insert_own"
  on public.transfers for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "transfers_update_own"
  on public.transfers for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "transfers_delete_own"
  on public.transfers for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- budgets (stub phase 3)
-- ---------------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  amount_limit numeric(14, 2) not null check (amount_limit >= 0),
  period_month date not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint budgets_period_month_first_day check (extract(day from period_month) = 1),
  constraint budgets_user_category_month unique (user_id, category_id, period_month)
);

create index budgets_user_id_idx on public.budgets (user_id);
create index budgets_category_id_idx on public.budgets (category_id);
create index budgets_user_id_period_idx on public.budgets (user_id, period_month);

create trigger budgets_set_updated_at
before update on public.budgets
for each row execute function private.set_updated_at();

alter table public.budgets enable row level security;

create policy "budgets_select_own"
  on public.budgets for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "budgets_insert_own"
  on public.budgets for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "budgets_update_own"
  on public.budgets for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "budgets_delete_own"
  on public.budgets for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- goals + contributions (stub phase 3)
-- ---------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  target_amount numeric(14, 2) not null check (target_amount > 0),
  current_amount numeric(14, 2) not null default 0 check (current_amount >= 0),
  status public.goal_status not null default 'active',
  color text not null default '#1DB954',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint goals_name_len check (char_length(trim(name)) > 0)
);

create index goals_user_id_idx on public.goals (user_id);
create index goals_user_id_status_idx on public.goals (user_id, status);

create trigger goals_set_updated_at
before update on public.goals
for each row execute function private.set_updated_at();

alter table public.goals enable row level security;

create policy "goals_select_own"
  on public.goals for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "goals_insert_own"
  on public.goals for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "goals_update_own"
  on public.goals for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "goals_delete_own"
  on public.goals for delete to authenticated
  using ((select auth.uid()) = user_id);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  account_id uuid not null references public.accounts (id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  occurred_at timestamptz not null default timezone('utc', now()),
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index goal_contributions_user_id_idx on public.goal_contributions (user_id);
create index goal_contributions_goal_id_idx on public.goal_contributions (goal_id);
create index goal_contributions_account_id_idx on public.goal_contributions (account_id);
create index goal_contributions_transaction_id_idx on public.goal_contributions (transaction_id);

alter table public.goal_contributions enable row level security;

create policy "goal_contributions_select_own"
  on public.goal_contributions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "goal_contributions_insert_own"
  on public.goal_contributions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "goal_contributions_update_own"
  on public.goal_contributions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "goal_contributions_delete_own"
  on public.goal_contributions for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- debt_payments (stub phase 3)
-- ---------------------------------------------------------------------------
create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  debt_id uuid not null references public.debts (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  occurred_at timestamptz not null default timezone('utc', now()),
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index debt_payments_user_id_idx on public.debt_payments (user_id);
create index debt_payments_debt_id_idx on public.debt_payments (debt_id);
create index debt_payments_transaction_id_idx on public.debt_payments (transaction_id);

alter table public.debt_payments enable row level security;

create policy "debt_payments_select_own"
  on public.debt_payments for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "debt_payments_insert_own"
  on public.debt_payments for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "debt_payments_update_own"
  on public.debt_payments for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "debt_payments_delete_own"
  on public.debt_payments for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Bootstrap: profile + categorías semilla en español
-- ---------------------------------------------------------------------------
create or replace function private.seed_default_categories(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories (user_id, name, kind, color, icon, is_system)
  values
    (p_user_id, 'Alimentación', 'expense', '#1DB954', 'food', true),
    (p_user_id, 'Transporte', 'expense', '#0E7490', 'transport', true),
    (p_user_id, 'Vivienda', 'expense', '#C2410C', 'home', true),
    (p_user_id, 'Ocio', 'expense', '#7C3AED', 'leisure', true),
    (p_user_id, 'Salud', 'expense', '#059669', 'health', true),
    (p_user_id, 'Educación', 'expense', '#64748B', 'education', true),
    (p_user_id, 'Compras', 'expense', '#B45309', 'shopping', true),
    (p_user_id, 'Suscripciones', 'expense', '#581C87', 'subscriptions', true),
    (p_user_id, 'Facturas', 'expense', '#991B1B', 'bills', true),
    (p_user_id, 'Otros gastos', 'expense', '#535353', 'other', true),
    (p_user_id, 'Nómina', 'income', '#22C55E', 'salary', true),
    (p_user_id, 'Freelance', 'income', '#0E7490', 'freelance', true),
    (p_user_id, 'Inversiones', 'income', '#1DB954', 'invest', true),
    (p_user_id, 'Regalos', 'income', '#7C3AED', 'gift', true),
    (p_user_id, 'Otros ingresos', 'income', '#64748B', 'other', true);
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
begin
  v_display_name := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );

  insert into public.profiles (id, display_name, accent_color, currency, locale)
  values (new.id, v_display_name, '#1DB954', 'EUR', 'es');

  perform private.seed_default_categories(new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
