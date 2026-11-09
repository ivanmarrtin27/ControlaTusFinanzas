-- Relabel existing accounts clearly named as savings (best-effort).
update public.accounts
set type = 'savings'
where type <> 'savings'
  and (
    name ilike '%ahorro%'
    or name ilike '%savings%'
  );
