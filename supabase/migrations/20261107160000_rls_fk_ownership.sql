-- Phase 6: harden RLS so child rows can only reference the caller's own parents.
-- Prevents attaching another user's account/category/goal/debt via known UUIDs
-- while still setting user_id = auth.uid().

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
drop policy if exists "transactions_insert_own" on public.transactions;
drop policy if exists "transactions_update_own" on public.transactions;

create policy "transactions_insert_own"
  on public.transactions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = (select auth.uid())
    )
    and (
      category_id is null
      or exists (
        select 1 from public.categories c
        where c.id = category_id and c.user_id = (select auth.uid())
      )
    )
    and (
      recurring_id is null
      or exists (
        select 1 from public.recurring_rules r
        where r.id = recurring_id and r.user_id = (select auth.uid())
      )
    )
    and (
      debt_id is null
      or exists (
        select 1 from public.debts d
        where d.id = debt_id and d.user_id = (select auth.uid())
      )
    )
  );

create policy "transactions_update_own"
  on public.transactions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = (select auth.uid())
    )
    and (
      category_id is null
      or exists (
        select 1 from public.categories c
        where c.id = category_id and c.user_id = (select auth.uid())
      )
    )
    and (
      recurring_id is null
      or exists (
        select 1 from public.recurring_rules r
        where r.id = recurring_id and r.user_id = (select auth.uid())
      )
    )
    and (
      debt_id is null
      or exists (
        select 1 from public.debts d
        where d.id = debt_id and d.user_id = (select auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- transfers
-- ---------------------------------------------------------------------------
drop policy if exists "transfers_insert_own" on public.transfers;
drop policy if exists "transfers_update_own" on public.transfers;

create policy "transfers_insert_own"
  on public.transfers for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = from_account_id and a.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.accounts a
      where a.id = to_account_id and a.user_id = (select auth.uid())
    )
  );

create policy "transfers_update_own"
  on public.transfers for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.accounts a
      where a.id = from_account_id and a.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.accounts a
      where a.id = to_account_id and a.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- budgets
-- ---------------------------------------------------------------------------
drop policy if exists "budgets_insert_own" on public.budgets;
drop policy if exists "budgets_update_own" on public.budgets;

create policy "budgets_insert_own"
  on public.budgets for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.categories c
      where c.id = category_id and c.user_id = (select auth.uid())
    )
  );

create policy "budgets_update_own"
  on public.budgets for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.categories c
      where c.id = category_id and c.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- recurring_rules
-- ---------------------------------------------------------------------------
drop policy if exists "recurring_rules_insert_own" on public.recurring_rules;
drop policy if exists "recurring_rules_update_own" on public.recurring_rules;

create policy "recurring_rules_insert_own"
  on public.recurring_rules for insert to authenticated
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

create policy "recurring_rules_update_own"
  on public.recurring_rules for update to authenticated
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

-- ---------------------------------------------------------------------------
-- goal_contributions
-- ---------------------------------------------------------------------------
drop policy if exists "goal_contributions_insert_own" on public.goal_contributions;
drop policy if exists "goal_contributions_update_own" on public.goal_contributions;

create policy "goal_contributions_insert_own"
  on public.goal_contributions for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.goals g
      where g.id = goal_id and g.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = (select auth.uid())
    )
    and (
      transaction_id is null
      or exists (
        select 1 from public.transactions t
        where t.id = transaction_id and t.user_id = (select auth.uid())
      )
    )
  );

create policy "goal_contributions_update_own"
  on public.goal_contributions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.goals g
      where g.id = goal_id and g.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.accounts a
      where a.id = account_id and a.user_id = (select auth.uid())
    )
    and (
      transaction_id is null
      or exists (
        select 1 from public.transactions t
        where t.id = transaction_id and t.user_id = (select auth.uid())
      )
    )
  );

-- ---------------------------------------------------------------------------
-- debt_payments
-- ---------------------------------------------------------------------------
drop policy if exists "debt_payments_insert_own" on public.debt_payments;
drop policy if exists "debt_payments_update_own" on public.debt_payments;

create policy "debt_payments_insert_own"
  on public.debt_payments for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.debts d
      where d.id = debt_id and d.user_id = (select auth.uid())
    )
    and (
      transaction_id is null
      or exists (
        select 1 from public.transactions t
        where t.id = transaction_id and t.user_id = (select auth.uid())
      )
    )
  );

create policy "debt_payments_update_own"
  on public.debt_payments for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.debts d
      where d.id = debt_id and d.user_id = (select auth.uid())
    )
    and (
      transaction_id is null
      or exists (
        select 1 from public.transactions t
        where t.id = transaction_id and t.user_id = (select auth.uid())
      )
    )
  );

comment on policy "transactions_insert_own" on public.transactions is
  'Own row + own account/category/recurring/debt FKs (phase 6)';
