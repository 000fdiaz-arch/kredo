# Kredo - Modelo de datos

## 1. Decisiones base

- Base de datos: PostgreSQL en Supabase.
- Llaves primarias: UUID generados con `gen_random_uuid()`.
- Autenticacion: Supabase Auth.
- Multiusuario: todas las tablas de negocio tendran `user_id`.
- Seguridad: RLS activado en todas las tablas de negocio.
- Dinero: montos como enteros en centavos.
- Tasas: puntos base (`interest_rate_bps`).
- Borrado: no se eliminan movimientos financieros; se anulan.

## 2. Extensiones

```sql
create extension if not exists pgcrypto;
```

## 3. Tipos enumerados propuestos

```sql
create type client_status as enum (
  'current',
  'interest_pending',
  'late',
  'no_movements',
  'inactive'
);

create type cycle_status as enum (
  'open',
  'closed'
);

create type payment_method as enum (
  'cash',
  'bank_transfer',
  'yappy',
  'ach',
  'other'
);

create type adjustment_type as enum (
  'principal_increase',
  'principal_decrease',
  'interest_increase',
  'interest_decrease'
);

create type audit_action as enum (
  'create',
  'update',
  'void',
  'close_cycle',
  'generate_interest'
);
```

Nota: tambien se puede usar `text` + `check` para facilitar cambios futuros sin migrar enums. La decision final se tomara antes de implementar migraciones.

## 4. Tablas

### profiles

Perfil asociado al usuario autenticado.

```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  created_at timestamptz not null default now()
);
```

Indices:

```sql
create index profiles_email_idx on profiles (email);
```

### user_settings

Configuracion por usuario.

```sql
create table user_settings (
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
```

Indices:

```sql
create index user_settings_user_id_idx on user_settings (user_id);
```

### clients

```sql
create table clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_code text not null,
  full_name text not null,
  identification text,
  phone text,
  address text,
  reference_name text,
  reference_phone text,
  status client_status not null default 'no_movements',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_user_code_unique unique (user_id, client_code)
);
```

Indices:

```sql
create index clients_user_id_idx on clients (user_id);
create index clients_status_idx on clients (status);
create index clients_full_name_idx on clients (full_name);
create index clients_identification_idx on clients (identification);
create index clients_phone_idx on clients (phone);
```

### cycles

```sql
create table cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status cycle_status not null default 'open',
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
```

Indices:

```sql
create index cycles_user_id_idx on cycles (user_id);
create index cycles_dates_idx on cycles (start_date, end_date);
create index cycles_status_idx on cycles (status);
```

### loans

```sql
create table loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete restrict,
  cycle_id uuid not null references cycles(id) on delete restrict,
  loan_date date not null,
  principal_amount_cents bigint not null,
  interest_rate_bps integer not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  constraint loans_principal_positive check (principal_amount_cents > 0),
  constraint loans_interest_non_negative check (interest_rate_bps >= 0)
);
```

Indices:

```sql
create index loans_user_id_idx on loans (user_id);
create index loans_client_id_idx on loans (client_id);
create index loans_cycle_id_idx on loans (cycle_id);
create index loans_loan_date_idx on loans (loan_date);
create index loans_voided_at_idx on loans (voided_at);
```

### payments

```sql
create table payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete restrict,
  cycle_id uuid not null references cycles(id) on delete restrict,
  payment_date date not null,
  total_amount_cents bigint not null,
  interest_amount_cents bigint not null default 0,
  principal_amount_cents bigint not null default 0,
  payment_method payment_method not null,
  reference_number text,
  notes text,
  overpayment_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  constraint payments_total_positive check (total_amount_cents > 0),
  constraint payments_parts_non_negative check (
    interest_amount_cents >= 0 and principal_amount_cents >= 0
  ),
  constraint payments_parts_not_greater_than_total check (
    interest_amount_cents + principal_amount_cents <= total_amount_cents
  )
);
```

Indices:

```sql
create index payments_user_id_idx on payments (user_id);
create index payments_client_id_idx on payments (client_id);
create index payments_cycle_id_idx on payments (cycle_id);
create index payments_payment_date_idx on payments (payment_date);
create index payments_voided_at_idx on payments (voided_at);
```

### interest_charges

```sql
create table interest_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete restrict,
  cycle_id uuid not null references cycles(id) on delete restrict,
  principal_base_cents bigint not null,
  interest_rate_bps integer not null,
  interest_amount_cents bigint not null,
  generated_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  constraint interest_principal_base_non_negative check (principal_base_cents >= 0),
  constraint interest_rate_non_negative check (interest_rate_bps >= 0),
  constraint interest_amount_non_negative check (interest_amount_cents >= 0),
  constraint interest_unique_client_cycle unique (user_id, client_id, cycle_id)
);
```

Indices:

```sql
create index interest_user_id_idx on interest_charges (user_id);
create index interest_client_id_idx on interest_charges (client_id);
create index interest_cycle_id_idx on interest_charges (cycle_id);
create index interest_generated_at_idx on interest_charges (generated_at);
create index interest_voided_at_idx on interest_charges (voided_at);
```

### adjustments

```sql
create table adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete restrict,
  adjustment_date date not null,
  adjustment_type adjustment_type not null,
  principal_amount_cents bigint not null default 0,
  interest_amount_cents bigint not null default 0,
  reason text not null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id),
  void_reason text,
  constraint adjustments_amounts_non_negative check (
    principal_amount_cents >= 0 and interest_amount_cents >= 0
  ),
  constraint adjustments_has_amount check (
    principal_amount_cents > 0 or interest_amount_cents > 0
  )
);
```

Indices:

```sql
create index adjustments_user_id_idx on adjustments (user_id);
create index adjustments_client_id_idx on adjustments (client_id);
create index adjustments_date_idx on adjustments (adjustment_date);
create index adjustments_voided_at_idx on adjustments (voided_at);
```

### client_notes

```sql
create table client_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);
```

Indices:

```sql
create index client_notes_user_id_idx on client_notes (user_id);
create index client_notes_client_id_idx on client_notes (client_id);
create index client_notes_created_at_idx on client_notes (created_at);
```

### audit_logs

```sql
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  action audit_action not null,
  previous_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
```

Indices:

```sql
create index audit_logs_user_id_idx on audit_logs (user_id);
create index audit_logs_entity_idx on audit_logs (entity_type, entity_id);
create index audit_logs_created_at_idx on audit_logs (created_at);
```

## 5. Vista de saldos

Vista propuesta: `client_balances`.

Responsabilidades:

- Sumar prestamos no anulados.
- Sumar intereses no anulados.
- Restar pagos no anulados.
- Aplicar ajustes no anulados.
- Exponer capital pendiente, interes pendiente y total.

Ejemplo conceptual:

```sql
create view client_balances as
select
  c.user_id,
  c.id as client_id,
  coalesce(l.total_loans_cents, 0)
    + coalesce(a.principal_adjustments_cents, 0)
    - coalesce(p.principal_paid_cents, 0) as principal_balance_cents,
  coalesce(i.total_interest_cents, 0)
    + coalesce(a.interest_adjustments_cents, 0)
    - coalesce(p.interest_paid_cents, 0) as interest_balance_cents,
  (
    coalesce(l.total_loans_cents, 0)
    + coalesce(a.principal_adjustments_cents, 0)
    - coalesce(p.principal_paid_cents, 0)
    + coalesce(i.total_interest_cents, 0)
    + coalesce(a.interest_adjustments_cents, 0)
    - coalesce(p.interest_paid_cents, 0)
  ) as total_balance_cents
from clients c
left join (
  select client_id, sum(principal_amount_cents) as total_loans_cents
  from loans
  where voided_at is null
  group by client_id
) l on l.client_id = c.id
left join (
  select
    client_id,
    sum(principal_amount_cents) as principal_paid_cents,
    sum(interest_amount_cents) as interest_paid_cents
  from payments
  where voided_at is null
  group by client_id
) p on p.client_id = c.id
left join (
  select client_id, sum(interest_amount_cents) as total_interest_cents
  from interest_charges
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
  from adjustments
  where voided_at is null
  group by client_id
) a on a.client_id = c.id;
```

La vista final debe evitar saldos negativos inesperados o reportarlos como error de datos, segun la regla aprobada para sobrepagos.

## 6. Vista de historial

Vista propuesta: `client_movements`.

Debe unir:

- `loans`
- `payments`
- `interest_charges`
- `adjustments`
- `client_notes`

Columnas normalizadas:

- `user_id`
- `client_id`
- `movement_id`
- `movement_date`
- `movement_type`
- `amount_cents`
- `principal_amount_cents`
- `interest_amount_cents`
- `cycle_id`
- `notes`
- `voided_at`
- `created_at`

Para "saldo despues del movimiento" se puede usar una funcion SQL con ventanas acumuladas o calcularlo en una consulta especializada por cliente.

## 7. Funciones RPC propuestas

### `register_payment`

Objetivo:

- Registrar un pago de forma atomica.
- Leer saldo vigente.
- Aplicar interes primero y capital despues.
- Validar sobrepago.
- Insertar pago con desglose.
- Insertar auditoria.

### `close_cycle`

Objetivo:

- Cerrar ciclo.
- Calcular intereses por cliente.
- Insertar `interest_charges`.
- Guardar resumen del ciclo.
- Evitar duplicados.
- Insertar auditoria.

### `void_movement`

Objetivo:

- Anular prestamo, pago, interes o ajuste.
- Guardar `voided_at`, `voided_by`, `void_reason`.
- Insertar auditoria.

## 8. RLS

Todas las tablas de negocio deben tener RLS activado.

Politica base para lectura:

```sql
create policy "Users can read own rows"
on clients
for select
using (auth.uid() = user_id);
```

Politica base para insercion:

```sql
create policy "Users can insert own rows"
on clients
for insert
with check (auth.uid() = user_id);
```

Politica base para actualizacion:

```sql
create policy "Users can update own rows"
on clients
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

No se permitira delete en movimientos financieros desde la aplicacion.

Estas politicas se replicaran para:

- `clients`
- `cycles`
- `loans`
- `payments`
- `interest_charges`
- `adjustments`
- `client_notes`
- `audit_logs`
- `user_settings`

`profiles` usara `id = auth.uid()`.

## 9. Triggers propuestos

### `set_updated_at`

Actualizar `updated_at` en:

- `clients`
- `loans`
- `payments`
- `user_settings`

### `create_profile_on_signup`

Crear fila en `profiles` despues de crear usuario en `auth.users`.

### Auditoria

Se puede iniciar con auditoria explicita desde servicios/RPC. Si se vuelve repetitiva, se agregaran triggers especificos.

## 10. Restricciones importantes

- No montos negativos.
- Prestamos y pagos deben tener monto mayor que cero.
- Pagos deben tener desglose no negativo.
- El desglose de pago no debe superar el total pagado.
- No duplicar ciclo por usuario y rango de fechas.
- No duplicar interes por usuario, cliente y ciclo.
- Cliente debe pertenecer al mismo `user_id` que el movimiento. Esta regla puede reforzarse con triggers porque PostgreSQL no puede expresar facilmente FK compuesta si `clients` no tiene unique `(id, user_id)`.

## 11. Migraciones iniciales previstas

Orden sugerido:

1. Extensiones y tipos.
2. Tablas base: `profiles`, `user_settings`, `clients`.
3. Ciclos.
4. Movimientos: `loans`, `payments`, `interest_charges`, `adjustments`, `client_notes`.
5. Auditoria.
6. Indices.
7. Vistas.
8. Funciones RPC.
9. Triggers.
10. RLS y politicas.

## 12. Datos semilla opcionales para desarrollo

Solo en ambiente local:

- Cliente sin movimientos.
- Cliente al dia.
- Cliente con interes pendiente.
- Cliente atrasado.
- Prestamo con pago parcial.
- Ciclo abierto y ciclo cerrado.

No se incluiran datos reales en el repositorio.
