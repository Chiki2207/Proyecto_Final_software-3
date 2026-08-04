-- =============================================================================
-- Fix crítico: gen_random_bytes vive en schema extensions (Supabase)
-- + Directorio de transferencias y facturas demo para UI educativa
-- =============================================================================

-- Recrear funciones críticas con search_path que incluye extensions
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
  v_to_number text := trim(p_to_account_number);
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;
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
  where account_number = v_to_number
    and status = 'active'
  for update;

  if not found then
    raise exception 'Cuenta destino no encontrada. Elige una de la lista.';
  end if;

  if v_from.id = v_to.id then
    raise exception 'No puede transferir a la misma cuenta';
  end if;

  if p_kind = 'own' and v_to.user_id <> auth.uid() then
    raise exception 'La cuenta destino no es propia';
  end if;

  if p_kind = 'internal' and v_to.user_id = auth.uid() then
    -- permitir pero marcar como own implícitamente
    p_kind := 'own';
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
    format('Se transfirieron $%s a la cuenta %s. Comprobante: %s', p_amount, v_to_number, v_receipt)
  );

  if v_to.user_id <> auth.uid() then
    perform public.notify_user(
      v_to.user_id, 'operation', 'Transferencia recibida',
      format('Recibiste $%s en tu cuenta %s.', p_amount, v_to.account_number)
    );
  end if;

  return v_transfer;
end;
$$;

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
  v_provider text;
  v_new numeric;
  v_receipt text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Monto inválido';
  end if;

  select * into v_acc
  from public.accounts
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
    auth.uid(), v_acc.id, p_provider_id, trim(p_bill_reference), p_amount, 'completed', v_receipt
  )
  returning * into v_pay;

  -- Marcar factura demo como pagada si existe
  update public.demo_invoices
  set status = 'paid', paid_at = now()
  where bill_reference = trim(p_bill_reference)
    and provider_id = p_provider_id
    and status = 'pending';

  perform public.write_audit('BILL_PAYMENT', 'bill_payments', v_pay.id::text,
    jsonb_build_object('amount', p_amount, 'provider', v_provider));

  perform public.notify_user(
    auth.uid(), 'operation', 'Pago de servicio exitoso',
    format('Pagaste $%s a %s. Comprobante: %s', p_amount, v_provider, v_receipt)
  );

  return v_pay;
end;
$$;

-- Directorio de cuentas Fincomer (para selector de transferencias)
create or replace function public.list_transfer_directory()
returns table (
  account_number text,
  account_type text,
  owner_name text,
  owner_email text,
  is_own boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.account_number,
    a.account_type,
    p.full_name,
    p.email,
    (a.user_id = auth.uid()) as is_own
  from public.accounts a
  join public.profiles p on p.id = a.user_id
  where a.status = 'active'
    and p.status = 'active'
  order by is_own desc, p.full_name, a.account_type;
$$;

-- Facturas demo pendientes
create table if not exists public.demo_invoices (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.service_providers (id),
  bill_reference text not null unique,
  amount numeric(16,2) not null check (amount > 0),
  description text,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  due_date date not null default (current_date + 10),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.demo_invoices enable row level security;

drop policy if exists "demo_invoices_read" on public.demo_invoices;
create policy "demo_invoices_read" on public.demo_invoices
  for select to authenticated using (true);

create or replace function public.list_demo_invoices()
returns table (
  id uuid,
  provider_id uuid,
  provider_name text,
  category text,
  bill_reference text,
  amount numeric,
  description text,
  status text,
  due_date date
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.id,
    d.provider_id,
    sp.name,
    sp.category,
    d.bill_reference,
    d.amount,
    d.description,
    d.status,
    d.due_date
  from public.demo_invoices d
  join public.service_providers sp on sp.id = d.provider_id
  where d.status = 'pending'
  order by d.due_date, sp.name;
$$;

-- Semilla de facturas demo (idempotente)
insert into public.demo_invoices (provider_id, bill_reference, amount, description, due_date)
select sp.id, v.ref, v.amount, v.descr, current_date + v.days
from public.service_providers sp
join (
  values
    ('AGUA_FLO', 'FAC-AGUA-1001', 48500::numeric, 'Factura acueducto marzo', 5),
    ('AGUA_FLO', 'FAC-AGUA-1002', 52300::numeric, 'Factura acueducto abril', 12),
    ('ENERGIA_CAQ', 'FAC-LUZ-2001', 128900::numeric, 'Energía residencial', 7),
    ('ENERGIA_CAQ', 'FAC-LUZ-2002', 156200::numeric, 'Energía comercial pequeña', 15),
    ('GAS_SUR', 'FAC-GAS-3001', 61200::numeric, 'Gas natural', 8),
    ('CLARO', 'FAC-CLARO-4001', 79900::numeric, 'Plan móvil Claro', 3),
    ('MOVISTAR', 'FAC-MOV-5001', 65900::numeric, 'Plan Movistar hogar', 9),
    ('IMPUESTO_PRED', 'FAC-PRED-6001', 245000::numeric, 'Predial vigencia actual', 20)
) as v(code, ref, amount, descr, days) on sp.code = v.code
on conflict (bill_reference) do update
set amount = excluded.amount,
    description = excluded.description,
    status = case when public.demo_invoices.status = 'paid' then 'paid' else 'pending' end;

-- Destinatarios frecuentes para cada usuario demo
insert into public.transfer_recipients (owner_id, alias, account_number, bank_name, is_internal)
select p.id, r.alias, r.account_number, 'Fincomer', true
from public.profiles p
cross join (
  values
    ('Admin Ahorros', '802278265419'),
    ('Asesor Ahorros', '805919081288'),
    ('Asociado Ahorros', '807382798955'),
    ('Riesgos Ahorros', '809670376919')
) as r(alias, account_number)
where p.email like '%@fincomer.co'
  and not exists (
    select 1 from public.transfer_recipients tr
    where tr.owner_id = p.id and tr.account_number = r.account_number
  );

-- Boost saldos demo para operar cómodo
update public.accounts
set balance = greatest(balance, 5000000)
where account_type = 'ahorro'
  and user_id in (select id from public.profiles where email like '%@fincomer.co');

update public.accounts
set balance = greatest(balance, 1500000)
where account_type = 'corriente'
  and user_id in (select id from public.profiles where email like '%@fincomer.co');

grant execute on function public.execute_transfer(uuid, text, numeric, text, text) to authenticated;
grant execute on function public.execute_bill_payment(uuid, uuid, text, numeric) to authenticated;
grant execute on function public.list_transfer_directory() to authenticated;
grant execute on function public.list_demo_invoices() to authenticated;

notify pgrst, 'reload schema';
