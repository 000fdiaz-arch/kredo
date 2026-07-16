create extension if not exists pgcrypto;

create type public.client_status as enum (
  'current',
  'interest_pending',
  'late',
  'no_movements',
  'inactive'
);

create type public.cycle_status as enum (
  'open',
  'closed'
);

create type public.payment_method as enum (
  'cash',
  'bank_transfer',
  'yappy',
  'ach',
  'other'
);

create type public.adjustment_type as enum (
  'principal_increase',
  'principal_decrease',
  'interest_increase',
  'interest_decrease'
);

create type public.audit_action as enum (
  'create',
  'update',
  'void',
  'close_cycle',
  'generate_interest'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null default 'Kredo',
  currency text not null default 'USD',
  default_interest_rate_bps integer not null default 1000,
  payment_application_rule text not null default 'interest_first',
  capitalize_interest boolean not null default false,
  first_cycle_close_day integer not null default 15,
  second_cycle_close_rule text not null default 'last_day_of_month',
  payment_methods jsonb not null default '["cash","bank_transfer","yappy","ach","other"]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_settings_user_unique unique (user_id),
  constraint user_settings_interest_non_negative check (default_interest_rate_bps >= 0),
  constraint user_settings_first_close_valid check (first_cycle_close_day between 1 and 28)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_code text not null,
  full_name text not null,
  identification text,
  phone text,
  address text,
  reference_name text,
  reference_phone text,
  status public.client_status not null default 'no_movements',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_user_code_unique unique (user_id, client_code),
  constraint clients_id_user_unique unique (id, user_id)
);

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status public.cycle_status not null default 'open',
  capital_initial_cents bigint not null default 0,
  new_loans_cents bigint not null default 0,
  interest_generated_cents bigint not null default 0,
  payments_received_cents bigint not null default 0,
  interest_collected_cents bigint not null default 0,
  principal_recovered_cents bigint not null default 0,
  capital_final_cents bigint not null default 0,
  interest_pending_final_cents bigint not null default 0,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint cycles_date_order check (start_date <= end_date),
  constraint cycles_user_period_unique unique (user_id, start_date, end_date),
  constraint cycles_id_user_unique unique (id, user_id),
  constraint cycles_amounts_non_negative check (
    capital_initial_cents >= 0 and
    new_loans_cents >= 0 and
    interest_generated_cents >= 0 and
    payments_received_cents >= 0 and
    interest_collected_cents >= 0 and
    principal_recovered_cents >= 0 and
    capital_final_cents >= 0 and
    interest_pending_final_cents >= 0
  )
);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  cycle_id uuid not null,
  loan_date date not null,
  principal_amount_cents bigint not null,
  interest_rate_bps integer not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  constraint loans_client_user_fk foreign key (client_id, user_id) references public.clients(id, user_id) on delete restrict,
  constraint loans_cycle_user_fk foreign key (cycle_id, user_id) references public.cycles(id, user_id) on delete restrict,
  constraint loans_principal_positive check (principal_amount_cents > 0),
  constraint loans_interest_non_negative check (interest_rate_bps >= 0)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  cycle_id uuid not null,
  payment_date date not null,
  total_amount_cents bigint not null,
  interest_amount_cents bigint not null default 0,
  principal_amount_cents bigint not null default 0,
  payment_method public.payment_method not null,
  reference_number text,
  notes text,
  overpayment_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  constraint payments_client_user_fk foreign key (client_id, user_id) references public.clients(id, user_id) on delete restrict,
  constraint payments_cycle_user_fk foreign key (cycle_id, user_id) references public.cycles(id, user_id) on delete restrict,
  constraint payments_total_positive check (total_amount_cents > 0),
  constraint payments_parts_non_negative check (interest_amount_cents >= 0 and principal_amount_cents >= 0),
  constraint payments_parts_not_greater_than_total check (interest_amount_cents + principal_amount_cents <= total_amount_cents)
);

create table public.interest_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  cycle_id uuid not null,
  principal_base_cents bigint not null,
  interest_rate_bps integer not null,
  interest_amount_cents bigint not null,
  generated_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  constraint interest_client_user_fk foreign key (client_id, user_id) references public.clients(id, user_id) on delete restrict,
  constraint interest_cycle_user_fk foreign key (cycle_id, user_id) references public.cycles(id, user_id) on delete restrict,
  constraint interest_principal_base_non_negative check (principal_base_cents >= 0),
  constraint interest_rate_non_negative check (interest_rate_bps >= 0),
  constraint interest_amount_non_negative check (interest_amount_cents >= 0),
  constraint interest_unique_client_cycle unique (user_id, client_id, cycle_id)
);

create table public.adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  adjustment_date date not null,
  adjustment_type public.adjustment_type not null,
  principal_amount_cents bigint not null default 0,
  interest_amount_cents bigint not null default 0,
  reason text not null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  constraint adjustments_client_user_fk foreign key (client_id, user_id) references public.clients(id, user_id) on delete restrict,
  constraint adjustments_amounts_non_negative check (principal_amount_cents >= 0 and interest_amount_cents >= 0),
  constraint adjustments_has_amount check (principal_amount_cents > 0 or interest_amount_cents > 0)
);

create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null,
  note text not null,
  created_at timestamptz not null default now(),
  constraint client_notes_client_user_fk foreign key (client_id, user_id) references public.clients(id, user_id) on delete cascade
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action public.audit_action not null,
  previous_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create index profiles_email_idx on public.profiles (email);
create index user_settings_user_id_idx on public.user_settings (user_id);
create index clients_user_id_idx on public.clients (user_id);
create index clients_status_idx on public.clients (status);
create index clients_full_name_idx on public.clients (full_name);
create index clients_identification_idx on public.clients (identification);
create index clients_phone_idx on public.clients (phone);
create index cycles_user_id_idx on public.cycles (user_id);
create index cycles_dates_idx on public.cycles (start_date, end_date);
create index cycles_status_idx on public.cycles (status);
create index loans_user_id_idx on public.loans (user_id);
create index loans_client_id_idx on public.loans (client_id);
create index loans_cycle_id_idx on public.loans (cycle_id);
create index loans_loan_date_idx on public.loans (loan_date);
create index loans_voided_at_idx on public.loans (voided_at);
create index payments_user_id_idx on public.payments (user_id);
create index payments_client_id_idx on public.payments (client_id);
create index payments_cycle_id_idx on public.payments (cycle_id);
create index payments_payment_date_idx on public.payments (payment_date);
create index payments_voided_at_idx on public.payments (voided_at);
create index interest_user_id_idx on public.interest_charges (user_id);
create index interest_client_id_idx on public.interest_charges (client_id);
create index interest_cycle_id_idx on public.interest_charges (cycle_id);
create index interest_generated_at_idx on public.interest_charges (generated_at);
create index interest_voided_at_idx on public.interest_charges (voided_at);
create index adjustments_user_id_idx on public.adjustments (user_id);
create index adjustments_client_id_idx on public.adjustments (client_id);
create index adjustments_date_idx on public.adjustments (adjustment_date);
create index adjustments_voided_at_idx on public.adjustments (voided_at);
create index client_notes_user_id_idx on public.client_notes (user_id);
create index client_notes_client_id_idx on public.client_notes (client_id);
create index client_notes_created_at_idx on public.client_notes (created_at);
create index audit_logs_user_id_idx on public.audit_logs (user_id);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create trigger loans_set_updated_at
before update on public.loans
for each row execute function public.set_updated_at();

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));

  insert into public.user_settings (user_id)
  values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

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
  ) as total_balance_cents
from public.clients c
left join (
  select client_id, sum(principal_amount_cents) as total_loans_cents
  from public.loans
  where voided_at is null
  group by client_id
) l on l.client_id = c.id
left join (
  select
    client_id,
    sum(principal_amount_cents) as principal_paid_cents,
    sum(interest_amount_cents) as interest_paid_cents
  from public.payments
  where voided_at is null
  group by client_id
) p on p.client_id = c.id
left join (
  select client_id, sum(interest_amount_cents) as total_interest_cents
  from public.interest_charges
  where voided_at is null
  group by client_id
) i on i.client_id = c.id
left join (
  select
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
  group by client_id
) a on a.client_id = c.id;

create or replace view public.client_movements
with (security_invoker = true)
as
select user_id, client_id, id as movement_id, loan_date as movement_date, 'loan'::text as movement_type,
  principal_amount_cents as amount_cents, principal_amount_cents, 0::bigint as interest_amount_cents,
  cycle_id, notes, voided_at, created_at
from public.loans
union all
select user_id, client_id, id as movement_id, payment_date as movement_date, 'payment'::text as movement_type,
  total_amount_cents as amount_cents, principal_amount_cents, interest_amount_cents,
  cycle_id, notes, voided_at, created_at
from public.payments
union all
select user_id, client_id, id as movement_id, generated_at::date as movement_date, 'interest_charge'::text as movement_type,
  interest_amount_cents as amount_cents, 0::bigint as principal_amount_cents, interest_amount_cents,
  cycle_id, null::text as notes, voided_at, generated_at as created_at
from public.interest_charges
union all
select user_id, client_id, id as movement_id, adjustment_date as movement_date, 'adjustment'::text as movement_type,
  principal_amount_cents + interest_amount_cents as amount_cents, principal_amount_cents, interest_amount_cents,
  null::uuid as cycle_id, reason as notes, voided_at, created_at
from public.adjustments
union all
select user_id, client_id, id as movement_id, created_at::date as movement_date, 'note'::text as movement_type,
  0::bigint as amount_cents, 0::bigint as principal_amount_cents, 0::bigint as interest_amount_cents,
  null::uuid as cycle_id, note as notes, null::timestamptz as voided_at, created_at
from public.client_notes;

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.clients enable row level security;
alter table public.cycles enable row level security;
alter table public.loans enable row level security;
alter table public.payments enable row level security;
alter table public.interest_charges enable row level security;
alter table public.adjustments enable row level security;
alter table public.client_notes enable row level security;
alter table public.audit_logs enable row level security;

create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Users can read own settings" on public.user_settings for select using (auth.uid() = user_id);
create policy "Users can insert own settings" on public.user_settings for insert with check (auth.uid() = user_id);
create policy "Users can update own settings" on public.user_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can read own clients" on public.clients for select using (auth.uid() = user_id);
create policy "Users can insert own clients" on public.clients for insert with check (auth.uid() = user_id);
create policy "Users can update own clients" on public.clients for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can read own cycles" on public.cycles for select using (auth.uid() = user_id);
create policy "Users can insert own cycles" on public.cycles for insert with check (auth.uid() = user_id);
create policy "Users can update own cycles" on public.cycles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can read own loans" on public.loans for select using (auth.uid() = user_id);
create policy "Users can insert own loans" on public.loans for insert with check (auth.uid() = user_id);
create policy "Users can update own loans" on public.loans for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can read own payments" on public.payments for select using (auth.uid() = user_id);
create policy "Users can insert own payments" on public.payments for insert with check (auth.uid() = user_id);
create policy "Users can update own payments" on public.payments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can read own interest charges" on public.interest_charges for select using (auth.uid() = user_id);
create policy "Users can insert own interest charges" on public.interest_charges for insert with check (auth.uid() = user_id);
create policy "Users can update own interest charges" on public.interest_charges for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can read own adjustments" on public.adjustments for select using (auth.uid() = user_id);
create policy "Users can insert own adjustments" on public.adjustments for insert with check (auth.uid() = user_id);
create policy "Users can update own adjustments" on public.adjustments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can read own notes" on public.client_notes for select using (auth.uid() = user_id);
create policy "Users can insert own notes" on public.client_notes for insert with check (auth.uid() = user_id);
create policy "Users can update own notes" on public.client_notes for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can read own audit logs" on public.audit_logs for select using (auth.uid() = user_id);
create policy "Users can insert own audit logs" on public.audit_logs for insert with check (auth.uid() = user_id);

insert into public.profiles (id, email, full_name)
select id, email, coalesce(raw_user_meta_data->>'full_name', '')
from auth.users
on conflict (id) do nothing;

insert into public.user_settings (user_id)
select id
from auth.users
on conflict (user_id) do nothing;
