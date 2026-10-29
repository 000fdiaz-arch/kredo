-- Keep voided charges for audit while allowing a corrected replacement.
-- Exactly one active charge per client and cycle remains enforced atomically.
begin;

alter table public.interest_charges
  drop constraint if exists interest_unique_client_cycle,
  drop constraint if exists interest_unique_client_cycle_organization;

create unique index if not exists interest_active_client_cycle_organization
  on public.interest_charges (organization_id, client_id, cycle_id)
  where voided_at is null;

commit;
