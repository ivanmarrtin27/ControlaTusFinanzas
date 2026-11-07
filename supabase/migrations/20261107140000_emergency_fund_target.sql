-- Phase 4: emergency fund target on profiles
alter table public.profiles
  add column if not exists emergency_fund_target numeric(14, 2);

comment on column public.profiles.emergency_fund_target is
  'Optional user-defined emergency fund target in profile currency; null → suggest avg monthly expense × 3';
