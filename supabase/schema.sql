-- =============================================================================
-- FINCOMER DIGITAL — Esquema completo (Supabase / PostgreSQL)
-- Cooperativa Financiera Fincomer
-- Ejecutar en: Supabase → SQL Editor → Run
-- Cubre RF-01 … RF-45 (datos, seguridad RLS, auditoría, transferencias, PSE, etc.)
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Roles del sistema (RBAC) — RF-06, RF-09, RF-38
-- -----------------------------------------------------------------------------
create table if not exists public.app_roles (
  id smallserial primary key,
  code text not null unique,
  name text not null,
  description text
);

insert into public.app_roles (code, name, description) values
  ('asociado', 'Asociado', 'Cliente de la cooperativa'),
  ('asesor', 'Asesor de oficina', 'Personal de oficina'),
  ('admin', 'Administrador', 'Gestión de usuarios y parámetros'),
  ('riesgos', 'Riesgos y Cumplimiento', 'Supervisión de seguridad y fraude')
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- Perfiles / Asociados — RF-01, RF-08, RF-09
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  document_type text not null default 'CC'
    check (document_type in ('CC', 'CE', 'NIT', 'PA')),
  document_number text not null,
  full_name text not null,
  email text not null,
  phone text,
  address text,
  city text default 'Florencia',
  department text default 'Caquetá',
  status text not null default 'active'
    check (status in ('active', 'blocked', 'pending', 'inactive')),
  failed_login_attempts int not null default 0,
  locked_until timestamptz,
  mfa_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_type, document_number)
);

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id smallint not null references public.app_roles (id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

-- Preferencias de notificación — RF-10
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  push_enabled boolean not null default true,
  security_alerts boolean not null default true,
  operation_alerts boolean not null default true,
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Cuentas y ahorros — RF-11 … RF-14
-- -----------------------------------------------------------------------------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  account_number text not null unique,
  account_type text not null default 'ahorro'
    check (account_type in ('ahorro', 'corriente', 'credito')),
  product_name text not null default 'Cuenta de Ahorros Fincomer',
  balance numeric(16, 2) not null default 0 check (balance >= 0),
  currency text not null default 'COP',
  status text not null default 'active'
    check (status in ('active', 'blocked', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_accounts_user on public.accounts (user_id);

-- Movimientos / extractos — RF-12, RF-14
create table if not exists public.movements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts (id) on delete cascade,
  movement_type text not null
    check (movement_type in (
      'credit', 'debit', 'transfer_in', 'transfer_out',
      'payment', 'fee', 'interest', 'reversal'
    )),
  amount numeric(16, 2) not null check (amount > 0),
  balance_after numeric(16, 2) not null,
  description text not null,
  reference_code text,
  related_account_id uuid references public.accounts (id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_movements_account_date
  on public.movements (account_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Destinatarios frecuentes y transferencias — RF-15 … RF-20
-- -----------------------------------------------------------------------------
create table if not exists public.transfer_recipients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  alias text not null,
  account_number text not null,
  bank_code text,
  bank_name text not null default 'Fincomer',
  document_number text,
  is_internal boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  from_account_id uuid not null references public.accounts (id),
  to_account_id uuid references public.accounts (id),
  to_account_number text,
  to_bank_name text,
  transfer_kind text not null
    check (transfer_kind in ('own', 'internal', 'interbank')),
  amount numeric(16, 2) not null check (amount > 0),
  description text,
  status text not null default 'completed'
    check (status in ('pending', 'completed', 'rejected', 'reversed', 'scheduled')),
  receipt_code text not null unique default encode(gen_random_bytes(8), 'hex'),
  scheduled_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_transfers_user on public.transfers (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Pagos de servicios — RF-21 … RF-24
-- -----------------------------------------------------------------------------
create table if not exists public.service_providers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null
    check (category in ('agua', 'energia', 'gas', 'telecom', 'impuestos', 'otros')),
  active boolean not null default true
);

insert into public.service_providers (code, name, category) values
  ('AGUA_FLO', 'Acueducto Florencia', 'agua'),
  ('ENERGIA_CAQ', 'Energía del Caquetá', 'energia'),
  ('GAS_SUR', 'Gas Suroriente', 'gas'),
  ('CLARO', 'Claro Colombia', 'telecom'),
  ('MOVISTAR', 'Movistar', 'telecom'),
  ('IMPUESTO_PRED', 'Impuesto Predial', 'impuestos')
on conflict (code) do nothing;

create table if not exists public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  account_id uuid not null references public.accounts (id),
  provider_id uuid not null references public.service_providers (id),
  bill_reference text not null,
  amount numeric(16, 2) not null check (amount > 0),
  status text not null default 'completed'
    check (status in ('pending', 'completed', 'failed', 'reversed')),
  receipt_code text not null unique default encode(gen_random_bytes(8), 'hex'),
  is_recurring boolean not null default false,
  recurring_day int check (recurring_day between 1 and 28),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Créditos — RF-25 … RF-29
-- -----------------------------------------------------------------------------
create table if not exists public.credit_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  min_amount numeric(16, 2) not null,
  max_amount numeric(16, 2) not null,
  min_term_months int not null,
  max_term_months int not null,
  annual_rate numeric(8, 4) not null,
  active boolean not null default true
);

insert into public.credit_products
  (code, name, min_amount, max_amount, min_term_months, max_term_months, annual_rate)
values
  ('CONSUMO', 'Crédito de Consumo', 500000, 50000000, 6, 60, 0.1890),
  ('LIBRE_INV', 'Libre Inversión', 1000000, 80000000, 12, 72, 0.1650),
  ('VIVIENDA', 'Crédito de Vivienda', 10000000, 300000000, 60, 240, 0.1120)
on conflict (code) do nothing;

create table if not exists public.credit_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  product_id uuid not null references public.credit_products (id),
  requested_amount numeric(16, 2) not null check (requested_amount > 0),
  term_months int not null check (term_months > 0),
  monthly_payment numeric(16, 2),
  purpose text,
  status text not null default 'radicada'
    check (status in (
      'radicada', 'en_estudio', 'aprobada', 'rechazada',
      'desembolsada', 'cancelada'
    )),
  documents jsonb not null default '[]'::jsonb,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credits (
  id uuid primary key default gen_random_uuid(),
  application_id uuid unique references public.credit_applications (id),
  user_id uuid not null references public.profiles (id),
  product_id uuid not null references public.credit_products (id),
  principal numeric(16, 2) not null,
  annual_rate numeric(8, 4) not null,
  term_months int not null,
  outstanding_balance numeric(16, 2) not null,
  status text not null default 'active'
    check (status in ('active', 'paid', 'defaulted', 'restructured')),
  disbursed_at timestamptz not null default now()
);

create table if not exists public.credit_installments (
  id uuid primary key default gen_random_uuid(),
  credit_id uuid not null references public.credits (id) on delete cascade,
  installment_number int not null,
  due_date date not null,
  principal_amount numeric(16, 2) not null,
  interest_amount numeric(16, 2) not null,
  total_amount numeric(16, 2) not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'overdue', 'partial')),
  paid_at timestamptz,
  unique (credit_id, installment_number)
);

-- -----------------------------------------------------------------------------
-- Pasarela PSE/ACH / Bold — RF-30 … RF-34
-- -----------------------------------------------------------------------------
create table if not exists public.payment_gateway_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  account_id uuid references public.accounts (id),
  provider text not null default 'bold'
    check (provider in ('bold', 'pse', 'ach')),
  external_id text,
  reference_code text not null unique default encode(gen_random_bytes(10), 'hex'),
  amount numeric(16, 2) not null check (amount > 0),
  currency text not null default 'COP',
  description text,
  status text not null default 'created'
    check (status in (
      'created', 'redirected', 'pending', 'approved',
      'rejected', 'reversed', 'error'
    )),
  purpose text not null default 'topup'
    check (purpose in ('topup', 'bill', 'installment')),
  purpose_meta jsonb not null default '{}'::jsonb,
  integrity_signature text,
  bold_tx_status text,
  redirect_url text,
  webhook_payload jsonb,
  webhook_signature text,
  idempotency_key text unique,
  reconciled boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Integración completa Bold: ejecutar también supabase/bold.sql

-- -----------------------------------------------------------------------------
-- Notificaciones — RF-35 … RF-37
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'push', 'in_app')),
  category text not null check (category in ('security', 'operation', 'credit', 'marketing', 'system')),
  title text not null,
  body text not null,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user
  on public.notifications (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Administración — RF-38 … RF-42
-- -----------------------------------------------------------------------------
create table if not exists public.system_parameters (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

insert into public.system_parameters (key, value, description) values
  ('transfer_daily_limit', '5000000', 'Límite diario transferencias internas COP'),
  ('interbank_daily_limit', '20000000', 'Límite diario PSE/ACH COP'),
  ('office_hours', '{"from":"08:00","to":"17:00"}', 'Horario de oficinas'),
  ('mfa_required', 'true', 'Exigir MFA para operaciones sensibles')
on conflict (key) do nothing;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Auditoría — RF-43 … RF-45, RNF-06
-- -----------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id bigserial primary key,
  user_id uuid references public.profiles (id),
  action text not null,
  entity text not null,
  entity_id text,
  ip_address text,
  user_agent text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_created on public.audit_logs (created_at desc);
create index if not exists idx_audit_user on public.audit_logs (user_id, created_at desc);

-- =============================================================================
-- Funciones auxiliares
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_credit_app_updated on public.credit_applications;
create trigger trg_credit_app_updated
  before update on public.credit_applications
  for each row execute function public.set_updated_at();

drop trigger if exists trg_gateway_updated on public.payment_gateway_transactions;
create trigger trg_gateway_updated
  before update on public.payment_gateway_transactions
  for each row execute function public.set_updated_at();

-- ¿El usuario tiene un rol?
create or replace function public.has_role(role_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.app_roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code = role_code
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('admin')
      or public.has_role('asesor')
      or public.has_role('riesgos');
$$;

-- Generar número de cuenta
create or replace function public.generate_account_number()
returns text
language plpgsql
as $$
declare
  n text;
begin
  n := '80' || lpad((floor(random() * 1e10))::bigint::text, 10, '0');
  return n;
end;
$$;

-- Auditoría genérica
create or replace function public.write_audit(
  p_action text,
  p_entity text,
  p_entity_id text default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (user_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_details);
end;
$$;

-- Notificación in-app
create or replace function public.notify_user(
  p_user_id uuid,
  p_category text,
  p_title text,
  p_body text,
  p_channel text default 'in_app'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, channel, category, title, body)
  values (p_user_id, p_channel, p_category, p_title, p_body);
end;
$$;

-- Al registrarse: perfil + rol asociado + preferencias + cuenta de ahorro
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_doc text;
  v_role_id smallint;
  v_account_id uuid;
  v_account_number text;
begin
  v_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
  v_doc := coalesce(new.raw_user_meta_data->>'document_number', 'TMP' || substr(new.id::text, 1, 8));

  insert into public.profiles (id, document_number, full_name, email, phone)
  values (
    new.id,
    v_doc,
    v_name,
    new.email,
    new.raw_user_meta_data->>'phone'
  );

  select id into v_role_id from public.app_roles where code = 'asociado';
  insert into public.user_roles (user_id, role_id) values (new.id, v_role_id);

  insert into public.notification_preferences (user_id) values (new.id);

  v_account_number := public.generate_account_number();
  insert into public.accounts (user_id, account_number, account_type, balance, product_name)
  values (new.id, v_account_number, 'ahorro', 1000000.00, 'Cuenta de Ahorros Fincomer')
  returning id into v_account_id;

  insert into public.movements (account_id, movement_type, amount, balance_after, description, reference_code)
  values (
    v_account_id, 'credit', 1000000.00, 1000000.00,
    'Aporte inicial de bienvenida Fincomer',
    'WELCOME-' || substr(new.id::text, 1, 8)
  );

  -- Segunda cuenta para transferencias propias (RF-15)
  insert into public.accounts (user_id, account_number, account_type, balance, product_name)
  values (
    new.id,
    public.generate_account_number(),
    'corriente',
    0,
    'Cuenta Corriente Fincomer'
  );

  perform public.notify_user(
    new.id, 'system', 'Bienvenido a Fincomer Digital',
    'Tu cuenta de ahorros fue creada. Ya puedes operar en línea 24/7.'
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Transferencia atómica — RF-03, RF-15, RF-16
-- -----------------------------------------------------------------------------
create or replace function public.execute_transfer(
  p_from_account_id uuid,
  p_to_account_number text,
  p_amount numeric,
  p_description text default null,
  p_kind text default 'internal'
)
returns public.transfers
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_from public.accounts%rowtype;
  v_to public.accounts%rowtype;
  v_transfer public.transfers%rowtype;
  v_new_from numeric(16,2);
  v_new_to numeric(16,2);
  v_receipt text;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Monto inválido';
  end if;

  select * into v_from
  from public.accounts
  where id = p_from_account_id
    and user_id = auth.uid()
    and status = 'active'
  for update;

  if not found then
    raise exception 'Cuenta origen no encontrada o no autorizada';
  end if;

  if v_from.balance < p_amount then
    raise exception 'Saldo insuficiente';
  end if;

  select * into v_to
  from public.accounts
  where account_number = p_to_account_number
    and status = 'active'
  for update;

  if not found then
    raise exception 'Cuenta destino no encontrada';
  end if;

  if v_from.id = v_to.id then
    raise exception 'No puede transferir a la misma cuenta';
  end if;

  if p_kind = 'own' and v_to.user_id <> auth.uid() then
    raise exception 'La cuenta destino no es propia';
  end if;

  v_new_from := v_from.balance - p_amount;
  v_new_to := v_to.balance + p_amount;
  v_receipt := encode(gen_random_bytes(8), 'hex');

  update public.accounts set balance = v_new_from where id = v_from.id;
  update public.accounts set balance = v_new_to where id = v_to.id;

  insert into public.movements (account_id, movement_type, amount, balance_after, description, reference_code, related_account_id)
  values (
    v_from.id, 'transfer_out', p_amount, v_new_from,
    coalesce(p_description, 'Transferencia enviada'), v_receipt, v_to.id
  );

  insert into public.movements (account_id, movement_type, amount, balance_after, description, reference_code, related_account_id)
  values (
    v_to.id, 'transfer_in', p_amount, v_new_to,
    coalesce(p_description, 'Transferencia recibida'), v_receipt, v_from.id
  );

  insert into public.transfers (
    user_id, from_account_id, to_account_id, to_account_number, to_bank_name,
    transfer_kind, amount, description, status, receipt_code, executed_at
  ) values (
    auth.uid(), v_from.id, v_to.id, v_to.account_number, 'Fincomer',
    p_kind, p_amount, p_description, 'completed', v_receipt, now()
  )
  returning * into v_transfer;

  perform public.write_audit(
    'TRANSFER', 'transfers', v_transfer.id::text,
    jsonb_build_object('amount', p_amount, 'kind', p_kind, 'receipt', v_receipt)
  );

  perform public.notify_user(
    auth.uid(), 'operation', 'Transferencia exitosa',
    format('Se transfirieron $%s a la cuenta %s. Comprobante: %s', p_amount, p_to_account_number, v_receipt)
  );

  return v_transfer;
end;
$$;

-- -----------------------------------------------------------------------------
-- Pago de servicios — RF-21
-- -----------------------------------------------------------------------------
create or replace function public.execute_bill_payment(
  p_account_id uuid,
  p_provider_id uuid,
  p_bill_reference text,
  p_amount numeric
)
returns public.bill_payments
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_acc public.accounts%rowtype;
  v_pay public.bill_payments%rowtype;
  v_new numeric(16,2);
  v_receipt text;
  v_provider text;
begin
  select * into v_acc from public.accounts
  where id = p_account_id and user_id = auth.uid() and status = 'active'
  for update;

  if not found then
    raise exception 'Cuenta no autorizada';
  end if;

  if v_acc.balance < p_amount then
    raise exception 'Saldo insuficiente';
  end if;

  select name into v_provider from public.service_providers where id = p_provider_id and active;
  if v_provider is null then
    raise exception 'Proveedor no válido';
  end if;

  v_new := v_acc.balance - p_amount;
  v_receipt := encode(gen_random_bytes(8), 'hex');

  update public.accounts set balance = v_new where id = v_acc.id;

  insert into public.movements (account_id, movement_type, amount, balance_after, description, reference_code)
  values (v_acc.id, 'payment', p_amount, v_new, 'Pago de servicio: ' || v_provider, v_receipt);

  insert into public.bill_payments (
    user_id, account_id, provider_id, bill_reference, amount, status, receipt_code
  ) values (
    auth.uid(), v_acc.id, p_provider_id, p_bill_reference, p_amount, 'completed', v_receipt
  )
  returning * into v_pay;

  perform public.write_audit('BILL_PAYMENT', 'bill_payments', v_pay.id::text,
    jsonb_build_object('amount', p_amount, 'provider', v_provider));

  perform public.notify_user(
    auth.uid(), 'operation', 'Pago de servicio exitoso',
    format('Pagaste $%s a %s. Comprobante: %s', p_amount, v_provider, v_receipt)
  );

  return v_pay;
end;
$$;

-- -----------------------------------------------------------------------------
-- Simulación de crédito — RF-25
-- -----------------------------------------------------------------------------
create or replace function public.simulate_credit(
  p_product_id uuid,
  p_amount numeric,
  p_term_months int
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_prod public.credit_products%rowtype;
  v_monthly_rate numeric;
  v_payment numeric;
  v_total numeric;
begin
  select * into v_prod from public.credit_products where id = p_product_id and active;
  if not found then
    raise exception 'Producto de crédito no válido';
  end if;

  if p_amount < v_prod.min_amount or p_amount > v_prod.max_amount then
    raise exception 'Monto fuera del rango del producto';
  end if;

  if p_term_months < v_prod.min_term_months or p_term_months > v_prod.max_term_months then
    raise exception 'Plazo fuera del rango del producto';
  end if;

  v_monthly_rate := v_prod.annual_rate / 12.0;
  if v_monthly_rate = 0 then
    v_payment := p_amount / p_term_months;
  else
    v_payment := p_amount * (v_monthly_rate * power(1 + v_monthly_rate, p_term_months))
      / (power(1 + v_monthly_rate, p_term_months) - 1);
  end if;

  v_total := round(v_payment * p_term_months, 2);
  v_payment := round(v_payment, 2);

  return jsonb_build_object(
    'product_code', v_prod.code,
    'product_name', v_prod.name,
    'amount', p_amount,
    'term_months', p_term_months,
    'annual_rate', v_prod.annual_rate,
    'monthly_payment', v_payment,
    'total_payment', v_total,
    'total_interest', round(v_total - p_amount, 2)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Iniciar transacción pasarela (Bold/PSE) — RF-30
-- -----------------------------------------------------------------------------
create or replace function public.create_gateway_payment(
  p_account_id uuid,
  p_amount numeric,
  p_description text default 'Pago PSE Fincomer',
  p_provider text default 'bold'
)
returns public.payment_gateway_transactions
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tx public.payment_gateway_transactions%rowtype;
begin
  if not exists (
    select 1 from public.accounts
    where id = p_account_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'Cuenta no autorizada';
  end if;

  insert into public.payment_gateway_transactions (
    user_id, account_id, provider, amount, description, status, idempotency_key
  ) values (
    auth.uid(), p_account_id, p_provider, p_amount, p_description, 'created',
    encode(gen_random_bytes(16), 'hex')
  )
  returning * into v_tx;

  perform public.write_audit('GATEWAY_CREATE', 'payment_gateway_transactions', v_tx.id::text,
    jsonb_build_object('amount', p_amount, 'provider', p_provider));

  return v_tx;
end;
$$;

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.accounts enable row level security;
alter table public.movements enable row level security;
alter table public.transfer_recipients enable row level security;
alter table public.transfers enable row level security;
alter table public.service_providers enable row level security;
alter table public.bill_payments enable row level security;
alter table public.credit_products enable row level security;
alter table public.credit_applications enable row level security;
alter table public.credits enable row level security;
alter table public.credit_installments enable row level security;
alter table public.payment_gateway_transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.system_parameters enable row level security;
alter table public.announcements enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_roles enable row level security;

-- app_roles: lectura para autenticados
drop policy if exists "roles_read" on public.app_roles;
create policy "roles_read" on public.app_roles for select to authenticated using (true);

-- profiles
drop policy if exists "profiles_select_own_or_staff" on public.profiles;
create policy "profiles_select_own_or_staff" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.has_role('admin'))
  with check (id = auth.uid() or public.has_role('admin'));

-- user_roles
drop policy if exists "user_roles_select" on public.user_roles;
create policy "user_roles_select" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "user_roles_admin" on public.user_roles;
create policy "user_roles_admin" on public.user_roles
  for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- notification preferences
drop policy if exists "prefs_own" on public.notification_preferences;
create policy "prefs_own" on public.notification_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- accounts
drop policy if exists "accounts_select" on public.accounts;
create policy "accounts_select" on public.accounts
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- movements (vía cuenta propia)
drop policy if exists "movements_select" on public.movements;
create policy "movements_select" on public.movements
  for select to authenticated
  using (
    exists (
      select 1 from public.accounts a
      where a.id = movements.account_id
        and (a.user_id = auth.uid() or public.is_staff())
    )
  );

-- recipients
drop policy if exists "recipients_own" on public.transfer_recipients;
create policy "recipients_own" on public.transfer_recipients
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- transfers
drop policy if exists "transfers_select" on public.transfers;
create policy "transfers_select" on public.transfers
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- service providers (catálogo público autenticado)
drop policy if exists "providers_read" on public.service_providers;
create policy "providers_read" on public.service_providers
  for select to authenticated using (true);

-- bill payments
drop policy if exists "bills_select" on public.bill_payments;
create policy "bills_select" on public.bill_payments
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- credit products
drop policy if exists "credit_products_read" on public.credit_products;
create policy "credit_products_read" on public.credit_products
  for select to authenticated using (true);

-- credit applications
drop policy if exists "credit_apps" on public.credit_applications;
create policy "credit_apps" on public.credit_applications
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "credit_apps_insert" on public.credit_applications;
create policy "credit_apps_insert" on public.credit_applications
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "credit_apps_staff_update" on public.credit_applications;
create policy "credit_apps_staff_update" on public.credit_applications
  for update to authenticated
  using (public.is_staff());

-- credits / installments
drop policy if exists "credits_select" on public.credits;
create policy "credits_select" on public.credits
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

drop policy if exists "installments_select" on public.credit_installments;
create policy "installments_select" on public.credit_installments
  for select to authenticated
  using (
    exists (
      select 1 from public.credits c
      where c.id = credit_installments.credit_id
        and (c.user_id = auth.uid() or public.is_staff())
    )
  );

-- gateway
drop policy if exists "gateway_select" on public.payment_gateway_transactions;
create policy "gateway_select" on public.payment_gateway_transactions
  for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- notifications
drop policy if exists "notifications_own" on public.notifications;
create policy "notifications_own" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (user_id = auth.uid());

-- system parameters
drop policy if exists "params_read" on public.system_parameters;
create policy "params_read" on public.system_parameters
  for select to authenticated using (true);

drop policy if exists "params_admin" on public.system_parameters;
create policy "params_admin" on public.system_parameters
  for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- announcements
drop policy if exists "announcements_read" on public.announcements;
create policy "announcements_read" on public.announcements
  for select to authenticated
  using (published = true or public.is_staff());

drop policy if exists "announcements_admin" on public.announcements;
create policy "announcements_admin" on public.announcements
  for all to authenticated
  using (public.has_role('admin'))
  with check (public.has_role('admin'));

-- audit
drop policy if exists "audit_select" on public.audit_logs;
create policy "audit_select" on public.audit_logs
  for select to authenticated
  using (user_id = auth.uid() or public.has_role('admin') or public.has_role('riesgos'));

-- Grants para RPC
grant usage on schema public to authenticated;
grant execute on function public.execute_transfer(uuid, text, numeric, text, text) to authenticated;
grant execute on function public.execute_bill_payment(uuid, uuid, text, numeric) to authenticated;
grant execute on function public.simulate_credit(uuid, numeric, int) to authenticated;
grant execute on function public.create_gateway_payment(uuid, numeric, text, text) to authenticated;
grant execute on function public.has_role(text) to authenticated;
grant execute on function public.is_staff() to authenticated;

-- =============================================================================
-- Fin del esquema Fincomer Digital
-- =============================================================================
