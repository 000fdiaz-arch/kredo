create type public.organization_role as enum (
  'owner',
  'admin',
  'operator',
  'viewer'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_not_blank check (length(trim(name)) > 0)
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organizations_owner_id_idx on public.organizations (owner_id);
create index organization_members_user_id_idx on public.organization_members (user_id);
create index organization_members_organization_id_idx on public.organization_members (organization_id);

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

alter table public.user_settings add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.clients add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.cycles add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.loans add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.payments add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.interest_charges add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.adjustments add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.client_notes add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.audit_logs add column organization_id uuid references public.organizations(id) on delete cascade;

alter table public.financial_movements add column organization_id uuid references public.organizations(id) on delete cascade;

with created_organizations as (
  insert into public.organizations (owner_id, name)
  select
    u.id,
    coalesce(nullif(trim(us.business_name), ''), 'Kredo')
  from auth.users u
  left join public.user_settings us on us.user_id = u.id
  where not exists (
    select 1
    from public.organization_members existing
    where existing.user_id = u.id
  )
  returning id, owner_id
)
insert into public.organization_members (organization_id, user_id, role)
select id, owner_id, 'owner'
from created_organizations
on conflict do nothing;

update public.user_settings target
set organization_id = member.organization_id
from public.organization_members member
where target.user_id = member.user_id
  and target.organization_id is null;

update public.clients target
set organization_id = member.organization_id
from public.organization_members member
where target.user_id = member.user_id
  and target.organization_id is null;

update public.cycles target
set organization_id = member.organization_id
from public.organization_members member
where target.user_id = member.user_id
  and target.organization_id is null;

update public.loans target
set organization_id = member.organization_id
from public.organization_members member
where target.user_id = member.user_id
  and target.organization_id is null;

update public.payments target
set organization_id = member.organization_id
from public.organization_members member
where target.user_id = member.user_id
  and target.organization_id is null;

update public.interest_charges target
set organization_id = member.organization_id
from public.organization_members member
where target.user_id = member.user_id
  and target.organization_id is null;

update public.adjustments target
set organization_id = member.organization_id
from public.organization_members member
where target.user_id = member.user_id
  and target.organization_id is null;

update public.client_notes target
set organization_id = member.organization_id
from public.organization_members member
where target.user_id = member.user_id
  and target.organization_id is null;

update public.audit_logs target
set organization_id = member.organization_id
from public.organization_members member
where target.user_id = member.user_id
  and target.organization_id is null;

update public.financial_movements target
set organization_id = member.organization_id
from public.organization_members member
where target.user_id = member.user_id
  and target.organization_id is null;

alter table public.user_settings alter column organization_id set not null;
alter table public.clients alter column organization_id set not null;
alter table public.cycles alter column organization_id set not null;
alter table public.loans alter column organization_id set not null;
alter table public.payments alter column organization_id set not null;
alter table public.interest_charges alter column organization_id set not null;
alter table public.adjustments alter column organization_id set not null;
alter table public.client_notes alter column organization_id set not null;
alter table public.audit_logs alter column organization_id set not null;
alter table public.financial_movements alter column organization_id set not null;

alter table public.user_settings drop constraint if exists user_settings_user_unique;
alter table public.user_settings add constraint user_settings_organization_unique unique (organization_id);
alter table public.clients add constraint clients_id_organization_unique unique (id, organization_id);
alter table public.cycles add constraint cycles_id_organization_unique unique (id, organization_id);
alter table public.cycles add constraint cycles_organization_period_unique unique (organization_id, start_date, end_date);
alter table public.clients add constraint clients_organization_code_unique unique (organization_id, client_code);
alter table public.loans add constraint loans_client_organization_fk foreign key (client_id, organization_id) references public.clients(id, organization_id) on delete restrict;
alter table public.loans add constraint loans_cycle_organization_fk foreign key (cycle_id, organization_id) references public.cycles(id, organization_id) on delete restrict;
alter table public.payments add constraint payments_client_organization_fk foreign key (client_id, organization_id) references public.clients(id, organization_id) on delete restrict;
alter table public.payments add constraint payments_cycle_organization_fk foreign key (cycle_id, organization_id) references public.cycles(id, organization_id) on delete restrict;
alter table public.interest_charges add constraint interest_client_organization_fk foreign key (client_id, organization_id) references public.clients(id, organization_id) on delete restrict;
alter table public.interest_charges add constraint interest_cycle_organization_fk foreign key (cycle_id, organization_id) references public.cycles(id, organization_id) on delete restrict;
alter table public.interest_charges add constraint interest_unique_client_cycle_organization unique (organization_id, client_id, cycle_id);
alter table public.adjustments add constraint adjustments_client_organization_fk foreign key (client_id, organization_id) references public.clients(id, organization_id) on delete restrict;
alter table public.client_notes add constraint client_notes_client_organization_fk foreign key (client_id, organization_id) references public.clients(id, organization_id) on delete cascade;

create index user_settings_organization_id_idx on public.user_settings (organization_id);
create index clients_organization_id_idx on public.clients (organization_id);
create index cycles_organization_id_idx on public.cycles (organization_id);
create index loans_organization_id_idx on public.loans (organization_id);
create index payments_organization_id_idx on public.payments (organization_id);
create index interest_organization_id_idx on public.interest_charges (organization_id);
create index adjustments_organization_id_idx on public.adjustments (organization_id);
create index client_notes_organization_id_idx on public.client_notes (organization_id);
create index audit_logs_organization_id_idx on public.audit_logs (organization_id);
create index financial_movements_organization_id_idx on public.financial_movements (organization_id);

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = target_organization_id
      and member.user_id = auth.uid()
  );
$$;

create or replace function public.is_organization_admin(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members member
    where member.organization_id = target_organization_id
      and member.user_id = auth.uid()
      and member.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_organization_owner(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organizations organization
    where organization.id = target_organization_id
      and organization.owner_id = auth.uid()
  );
$$;

grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.is_organization_admin(uuid) to authenticated;
grant execute on function public.is_organization_owner(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy "Members can read organizations" on public.organizations
for select using (public.is_organization_member(id));

create policy "Users can create owned organizations" on public.organizations
for insert with check (auth.uid() = owner_id);

create policy "Admins can update organizations" on public.organizations
for update using (public.is_organization_admin(id)) with check (public.is_organization_admin(id));

create policy "Members can read organization members" on public.organization_members
for select using (public.is_organization_member(organization_id));

create policy "Users can create their first owner membership" on public.organization_members
for insert with check (auth.uid() = user_id and role = 'owner' and public.is_organization_owner(organization_id));

create policy "Admins can manage organization members" on public.organization_members
for update using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id));

drop policy if exists "Users can read own settings" on public.user_settings;
drop policy if exists "Users can insert own settings" on public.user_settings;
drop policy if exists "Users can update own settings" on public.user_settings;
drop policy if exists "Users can read own clients" on public.clients;
drop policy if exists "Users can insert own clients" on public.clients;
drop policy if exists "Users can update own clients" on public.clients;
drop policy if exists "Users can read own cycles" on public.cycles;
drop policy if exists "Users can insert own cycles" on public.cycles;
drop policy if exists "Users can update own cycles" on public.cycles;
drop policy if exists "Users can read own loans" on public.loans;
drop policy if exists "Users can insert own loans" on public.loans;
drop policy if exists "Users can update own loans" on public.loans;
drop policy if exists "Users can read own payments" on public.payments;
drop policy if exists "Users can insert own payments" on public.payments;
drop policy if exists "Users can update own payments" on public.payments;
drop policy if exists "Users can read own interest charges" on public.interest_charges;
drop policy if exists "Users can insert own interest charges" on public.interest_charges;
drop policy if exists "Users can update own interest charges" on public.interest_charges;
drop policy if exists "Users can read own adjustments" on public.adjustments;
drop policy if exists "Users can insert own adjustments" on public.adjustments;
drop policy if exists "Users can update own adjustments" on public.adjustments;
drop policy if exists "Users can read own notes" on public.client_notes;
drop policy if exists "Users can insert own notes" on public.client_notes;
drop policy if exists "Users can update own notes" on public.client_notes;
drop policy if exists "Users can read own audit logs" on public.audit_logs;
drop policy if exists "Users can insert own audit logs" on public.audit_logs;
drop policy if exists "Users can read own financial movements" on public.financial_movements;
drop policy if exists "Users can insert own financial movements" on public.financial_movements;
drop policy if exists "Users can update own financial movements" on public.financial_movements;

create policy "Members can read organization settings" on public.user_settings for select using (public.is_organization_member(organization_id));
create policy "Admins can insert organization settings" on public.user_settings for insert with check (public.is_organization_admin(organization_id));
create policy "Admins can update organization settings" on public.user_settings for update using (public.is_organization_admin(organization_id)) with check (public.is_organization_admin(organization_id));

create policy "Members can read organization clients" on public.clients for select using (public.is_organization_member(organization_id));
create policy "Members can insert organization clients" on public.clients for insert with check (public.is_organization_member(organization_id));
create policy "Members can update organization clients" on public.clients for update using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));

create policy "Members can read organization cycles" on public.cycles for select using (public.is_organization_member(organization_id));
create policy "Members can insert organization cycles" on public.cycles for insert with check (public.is_organization_member(organization_id));
create policy "Members can update organization cycles" on public.cycles for update using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));

create policy "Members can read organization loans" on public.loans for select using (public.is_organization_member(organization_id));
create policy "Members can insert organization loans" on public.loans for insert with check (public.is_organization_member(organization_id));
create policy "Members can update organization loans" on public.loans for update using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));

create policy "Members can read organization payments" on public.payments for select using (public.is_organization_member(organization_id));
create policy "Members can insert organization payments" on public.payments for insert with check (public.is_organization_member(organization_id));
create policy "Members can update organization payments" on public.payments for update using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));

create policy "Members can read organization interest charges" on public.interest_charges for select using (public.is_organization_member(organization_id));
create policy "Members can insert organization interest charges" on public.interest_charges for insert with check (public.is_organization_member(organization_id));
create policy "Members can update organization interest charges" on public.interest_charges for update using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));

create policy "Members can read organization adjustments" on public.adjustments for select using (public.is_organization_member(organization_id));
create policy "Members can insert organization adjustments" on public.adjustments for insert with check (public.is_organization_member(organization_id));
create policy "Members can update organization adjustments" on public.adjustments for update using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));

create policy "Members can read organization notes" on public.client_notes for select using (public.is_organization_member(organization_id));
create policy "Members can insert organization notes" on public.client_notes for insert with check (public.is_organization_member(organization_id));
create policy "Members can update organization notes" on public.client_notes for update using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));

create policy "Members can read organization audit logs" on public.audit_logs for select using (public.is_organization_member(organization_id));
create policy "Members can insert organization audit logs" on public.audit_logs for insert with check (public.is_organization_member(organization_id));

create policy "Members can read organization financial movements" on public.financial_movements for select using (public.is_organization_member(organization_id));
create policy "Members can insert organization financial movements" on public.financial_movements for insert with check (public.is_organization_member(organization_id));
create policy "Members can update organization financial movements" on public.financial_movements for update using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  created_organization_id uuid;
  business_name text;
begin
  business_name := coalesce(nullif(trim(new.raw_user_meta_data->>'business_name'), ''), 'Kredo');

  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));

  insert into public.organizations (owner_id, name)
  values (new.id, business_name)
  returning id into created_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (created_organization_id, new.id, 'owner');

  insert into public.user_settings (user_id, organization_id, business_name)
  values (new.id, created_organization_id, business_name);

  return new;
end;
$$;

create or replace view public.client_balances
with (security_invoker = true)
as
select
  c.user_id,
  c.id as client_id,
  greatest(
    coalesce(l.total_loans_cents, 0)
      + coalesce(a.principal_adjustments_cents, 0)
      - coalesce(p.principal_paid_cents, 0),
    0
  ) as principal_balance_cents,
  greatest(
    coalesce(i.total_interest_cents, 0)
      + coalesce(a.interest_adjustments_cents, 0)
      - coalesce(p.interest_paid_cents, 0),
    0
  ) as interest_balance_cents,
  greatest(
    coalesce(l.total_loans_cents, 0)
      + coalesce(a.principal_adjustments_cents, 0)
      - coalesce(p.principal_paid_cents, 0),
    0
  ) + greatest(
    coalesce(i.total_interest_cents, 0)
      + coalesce(a.interest_adjustments_cents, 0)
      - coalesce(p.interest_paid_cents, 0),
    0
  ) as total_balance_cents,
  c.organization_id
from public.clients c
left join (
  select organization_id, client_id, sum(principal_amount_cents) as total_loans_cents
  from public.loans
  where voided_at is null
  group by organization_id, client_id
) l on l.client_id = c.id and l.organization_id = c.organization_id
left join (
  select
    organization_id,
    client_id,
    sum(principal_amount_cents) as principal_paid_cents,
    sum(interest_amount_cents) as interest_paid_cents
  from public.payments
  where voided_at is null
  group by organization_id, client_id
) p on p.client_id = c.id and p.organization_id = c.organization_id
left join (
  select organization_id, client_id, sum(interest_amount_cents) as total_interest_cents
  from public.interest_charges
  where voided_at is null
  group by organization_id, client_id
) i on i.client_id = c.id and i.organization_id = c.organization_id
left join (
  select
    organization_id,
    client_id,
    sum(case
      when adjustment_type = 'principal_increase' then principal_amount_cents
      when adjustment_type = 'principal_decrease' then -principal_amount_cents
      else 0
    end) as principal_adjustments_cents,
    sum(case
      when adjustment_type = 'interest_increase' then interest_amount_cents
      when adjustment_type = 'interest_decrease' then -interest_amount_cents
      else 0
    end) as interest_adjustments_cents
  from public.adjustments
  where voided_at is null
  group by organization_id, client_id
) a on a.client_id = c.id and a.organization_id = c.organization_id;

create or replace view public.client_movements
with (security_invoker = true)
as
select user_id, client_id, id as movement_id, loan_date as movement_date, 'loan'::text as movement_type,
  principal_amount_cents as amount_cents, principal_amount_cents, 0::bigint as interest_amount_cents,
  cycle_id, notes, voided_at, created_at, organization_id
from public.loans
union all
select user_id, client_id, id as movement_id, payment_date as movement_date, 'payment'::text as movement_type,
  total_amount_cents as amount_cents, principal_amount_cents, interest_amount_cents,
  cycle_id, notes, voided_at, created_at, organization_id
from public.payments
union all
select user_id, client_id, id as movement_id, generated_at::date as movement_date, 'interest_charge'::text as movement_type,
  interest_amount_cents as amount_cents, 0::bigint as principal_amount_cents, interest_amount_cents,
  cycle_id, null::text as notes, voided_at, generated_at as created_at, organization_id
from public.interest_charges
union all
select user_id, client_id, id as movement_id, adjustment_date as movement_date, 'adjustment'::text as movement_type,
  principal_amount_cents + interest_amount_cents as amount_cents, principal_amount_cents, interest_amount_cents,
  null::uuid as cycle_id, reason as notes, voided_at, created_at, organization_id
from public.adjustments
union all
select user_id, client_id, id as movement_id, created_at::date as movement_date, 'note'::text as movement_type,
  0::bigint as amount_cents, 0::bigint as principal_amount_cents, 0::bigint as interest_amount_cents,
  null::uuid as cycle_id, note as notes, null::timestamptz as voided_at, created_at, organization_id
from public.client_notes;

create or replace function public.create_financial_movements_for_loan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.voided_at is not null then
    return new;
  end if;

  insert into public.financial_movements (
    user_id,
    organization_id,
    movement_date,
    movement_type,
    amount_cents,
    loan_id,
    client_id,
    cycle_id,
    source,
    description,
    created_by
  )
  values (
    new.user_id,
    new.organization_id,
    new.loan_date,
    'loan_disbursement',
    new.principal_amount_cents,
    new.id,
    new.client_id,
    new.cycle_id,
    'loan_trigger',
    'Desembolso de prestamo',
    new.user_id
  )
  on conflict do nothing;

  return new;
end;
$$;

create or replace function public.create_financial_movements_for_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  related_loan_id uuid;
begin
  if new.voided_at is not null then
    return new;
  end if;

  select l.id into related_loan_id
  from public.loans l
  where l.organization_id = new.organization_id
    and l.client_id = new.client_id
    and l.voided_at is null
  order by l.loan_date asc, l.created_at asc
  limit 1;

  if new.principal_amount_cents > 0 then
    insert into public.financial_movements (
      user_id,
      organization_id,
      movement_date,
      movement_type,
      amount_cents,
      loan_id,
      payment_id,
      client_id,
      cycle_id,
      source,
      description,
      created_by
    )
    values (
      new.user_id,
      new.organization_id,
      new.payment_date,
      'principal_recovery',
      new.principal_amount_cents,
      related_loan_id,
      new.id,
      new.client_id,
      new.cycle_id,
      'payment_trigger',
      'Capital recuperado por pago',
      new.user_id
    )
    on conflict do nothing;
  end if;

  if new.interest_amount_cents > 0 then
    insert into public.financial_movements (
      user_id,
      organization_id,
      movement_date,
      movement_type,
      amount_cents,
      loan_id,
      payment_id,
      client_id,
      cycle_id,
      source,
      description,
      created_by
    )
    values (
      new.user_id,
      new.organization_id,
      new.payment_date,
      'interest_income',
      new.interest_amount_cents,
      related_loan_id,
      new.id,
      new.client_id,
      new.cycle_id,
      'payment_trigger',
      'Interes cobrado por pago',
      new.user_id
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;
