create type public.financial_movement_type as enum (
  'capital_contribution',
  'capital_withdrawal',
  'loan_disbursement',
  'principal_recovery',
  'interest_income',
  'late_fee_income',
  'expense',
  'loan_loss',
  'adjustment'
);

create table if not exists public.financial_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  movement_date date not null,
  movement_type public.financial_movement_type not null,
  amount_cents bigint not null,
  loan_id uuid references public.loans(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  cycle_id uuid references public.cycles(id) on delete set null,
  source text not null default 'manual',
  description text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  constraint financial_movements_amount_positive check (amount_cents > 0),
  constraint financial_movements_linked_payment_type check (
    payment_id is null or movement_type in ('principal_recovery', 'interest_income', 'late_fee_income')
  ),
  constraint financial_movements_linked_loan_type check (
    loan_id is null or movement_type in ('loan_disbursement', 'principal_recovery', 'interest_income', 'late_fee_income', 'loan_loss')
  )
);

create unique index if not exists financial_movements_loan_disbursement_unique
  on public.financial_movements (loan_id, movement_type)
  where loan_id is not null and movement_type = 'loan_disbursement';

create unique index if not exists financial_movements_payment_component_unique
  on public.financial_movements (payment_id, movement_type)
  where payment_id is not null and movement_type in ('principal_recovery', 'interest_income', 'late_fee_income');

create index if not exists financial_movements_user_id_idx on public.financial_movements (user_id);
create index if not exists financial_movements_date_idx on public.financial_movements (movement_date);
create index if not exists financial_movements_type_idx on public.financial_movements (movement_type);
create index if not exists financial_movements_cycle_idx on public.financial_movements (cycle_id);
create index if not exists financial_movements_client_idx on public.financial_movements (client_id);

alter table public.financial_movements enable row level security;

drop policy if exists "Users can read own financial movements" on public.financial_movements;
drop policy if exists "Users can insert own financial movements" on public.financial_movements;
drop policy if exists "Users can update own financial movements" on public.financial_movements;

create policy "Users can read own financial movements" on public.financial_movements
for select using (auth.uid() = user_id);

create policy "Users can insert own financial movements" on public.financial_movements
for insert with check (auth.uid() = user_id);

create policy "Users can update own financial movements" on public.financial_movements
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
  where l.user_id = new.user_id
    and l.client_id = new.client_id
    and l.voided_at is null
  order by l.loan_date asc, l.created_at asc
  limit 1;

  if new.principal_amount_cents > 0 then
    insert into public.financial_movements (
      user_id,
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

drop trigger if exists loans_create_financial_movements on public.loans;
create trigger loans_create_financial_movements
after insert on public.loans
for each row execute function public.create_financial_movements_for_loan();

drop trigger if exists payments_create_financial_movements on public.payments;
create trigger payments_create_financial_movements
after insert on public.payments
for each row execute function public.create_financial_movements_for_payment();

create or replace function public.void_financial_movements_for_loan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.voided_at is null and new.voided_at is not null then
    update public.financial_movements
    set
      voided_at = new.voided_at,
      voided_by = new.voided_by,
      void_reason = new.void_reason
    where loan_id = new.id
      and voided_at is null;
  end if;

  return new;
end;
$$;

create or replace function public.void_financial_movements_for_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.voided_at is null and new.voided_at is not null then
    update public.financial_movements
    set
      voided_at = new.voided_at,
      voided_by = new.voided_by,
      void_reason = new.void_reason
    where payment_id = new.id
      and voided_at is null;
  end if;

  return new;
end;
$$;

drop trigger if exists loans_void_financial_movements on public.loans;
create trigger loans_void_financial_movements
after update on public.loans
for each row execute function public.void_financial_movements_for_loan();

drop trigger if exists payments_void_financial_movements on public.payments;
create trigger payments_void_financial_movements
after update on public.payments
for each row execute function public.void_financial_movements_for_payment();

insert into public.financial_movements (
  user_id,
  movement_date,
  movement_type,
  amount_cents,
  loan_id,
  client_id,
  cycle_id,
  source,
  description,
  created_by,
  created_at,
  voided_at,
  voided_by,
  void_reason
)
select
  l.user_id,
  l.loan_date,
  'loan_disbursement',
  l.principal_amount_cents,
  l.id,
  l.client_id,
  l.cycle_id,
  'history_rebuild',
  'Movimiento reconstruido desde prestamo historico',
  l.user_id,
  l.created_at,
  l.voided_at,
  l.voided_by,
  l.void_reason
from public.loans l
where l.principal_amount_cents > 0
on conflict do nothing;

insert into public.financial_movements (
  user_id,
  movement_date,
  movement_type,
  amount_cents,
  payment_id,
  client_id,
  cycle_id,
  source,
  description,
  created_by,
  created_at,
  voided_at,
  voided_by,
  void_reason
)
select
  p.user_id,
  p.payment_date,
  'principal_recovery',
  p.principal_amount_cents,
  p.id,
  p.client_id,
  p.cycle_id,
  'history_rebuild',
  'Capital recuperado reconstruido desde pago historico',
  p.user_id,
  p.created_at,
  p.voided_at,
  p.voided_by,
  p.void_reason
from public.payments p
where p.principal_amount_cents > 0
on conflict do nothing;

insert into public.financial_movements (
  user_id,
  movement_date,
  movement_type,
  amount_cents,
  payment_id,
  client_id,
  cycle_id,
  source,
  description,
  created_by,
  created_at,
  voided_at,
  voided_by,
  void_reason
)
select
  p.user_id,
  p.payment_date,
  'interest_income',
  p.interest_amount_cents,
  p.id,
  p.client_id,
  p.cycle_id,
  'history_rebuild',
  'Interes cobrado reconstruido desde pago historico',
  p.user_id,
  p.created_at,
  p.voided_at,
  p.voided_by,
  p.void_reason
from public.payments p
where p.interest_amount_cents > 0
on conflict do nothing;

with ordered_movements as (
  select
    user_id,
    movement_date,
    created_at,
    movement_type,
    amount_cents,
    case
      when movement_type in ('capital_contribution', 'principal_recovery', 'interest_income', 'late_fee_income') then amount_cents
      when movement_type in ('loan_disbursement', 'capital_withdrawal', 'expense') then -amount_cents
      else 0
    end as cash_delta
  from public.financial_movements
  where source = 'history_rebuild'
    and voided_at is null
),
running_cash as (
  select
    user_id,
    min(movement_date) as first_date,
    min(cash_balance) as minimum_cash
  from (
    select
      user_id,
      movement_date,
      sum(cash_delta) over (
        partition by user_id
        order by movement_date, created_at, movement_type
        rows between unbounded preceding and current row
      ) as cash_balance
    from ordered_movements
  ) balances
  group by user_id
),
needed_contributions as (
  select
    user_id,
    coalesce(first_date, current_date) as movement_date,
    greatest(-minimum_cash, 0) as amount_cents
  from running_cash
  where greatest(-minimum_cash, 0) > 0
)
insert into public.financial_movements (
  user_id,
  movement_date,
  movement_type,
  amount_cents,
  source,
  description,
  created_by
)
select
  user_id,
  movement_date,
  'capital_contribution',
  amount_cents,
  'system_rebuild',
  'Aporte inicial estimado para reconstruir caja historica sin saldo negativo',
  user_id
from needed_contributions
where not exists (
  select 1
  from public.financial_movements existing
  where existing.user_id = needed_contributions.user_id
    and existing.source = 'system_rebuild'
    and existing.movement_type = 'capital_contribution'
);
