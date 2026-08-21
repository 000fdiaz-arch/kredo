create table public.client_interest_freeze_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  action text not null,
  effective_date date not null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint client_interest_freeze_action_valid check (action in ('freeze', 'resume')),
  constraint client_interest_freeze_reason_required check (length(trim(reason)) > 0),
  constraint client_interest_freeze_client_fk foreign key (client_id, organization_id)
    references public.clients(id, organization_id) on delete restrict
);

create table public.loan_interest_rate_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null,
  loan_id uuid not null references public.loans(id) on delete restrict,
  effective_date date not null,
  interest_rate_bps integer not null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint loan_interest_rate_non_negative check (interest_rate_bps >= 0 and interest_rate_bps <= 10000),
  constraint loan_interest_rate_reason_required check (length(trim(reason)) > 0),
  constraint loan_interest_rate_client_fk foreign key (client_id, organization_id)
    references public.clients(id, organization_id) on delete restrict
);

create index client_interest_freeze_lookup_idx
  on public.client_interest_freeze_events (organization_id, client_id, effective_date, created_at);
create index loan_interest_rate_lookup_idx
  on public.loan_interest_rate_changes (organization_id, client_id, loan_id, effective_date, created_at);

alter table public.client_interest_freeze_events enable row level security;
alter table public.loan_interest_rate_changes enable row level security;

create policy "Members can read organization interest freeze events"
on public.client_interest_freeze_events for select
using (public.is_organization_member(organization_id));

create policy "Members can insert organization interest freeze events"
on public.client_interest_freeze_events for insert
with check (public.is_organization_member(organization_id) and auth.uid() = user_id);

create policy "Members can read organization interest rate changes"
on public.loan_interest_rate_changes for select
using (public.is_organization_member(organization_id));

create policy "Members can insert organization interest rate changes"
on public.loan_interest_rate_changes for insert
with check (public.is_organization_member(organization_id) and auth.uid() = user_id);

