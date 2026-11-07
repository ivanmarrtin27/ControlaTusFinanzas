-- Phase 3: optional deadline on savings goals
alter table public.goals
  add column if not exists deadline date;

comment on column public.goals.deadline is 'Optional target date for the savings goal';
