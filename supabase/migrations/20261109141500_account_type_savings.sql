-- Add first-class savings ("ahorro") account type.
-- NOTE: data backfill lives in a following migration — new enum values
-- must be committed before they can be referenced in the same transaction.
alter type public.account_type add value if not exists 'savings';

comment on type public.account_type is 'bank | cash | card | savings | other';
