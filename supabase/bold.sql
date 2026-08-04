-- =============================================================================
-- Fincomer Digital · Integración Bold Checkout (RF-29 … RF-34)
-- Ejecutar en Supabase SQL Editor DESPUÉS de schema.sql
-- Patrón igual a Buscaninos: orderId + SHA-256(orderId||amount||currency||secret)
-- =============================================================================

create schema if not exists private;

-- Credenciales Bold (solo functions security definer pueden leer)
create table if not exists private.bold_credentials (
  id boolean primary key default true check (id),
  api_key text,
  secret_key text,
  updated_at timestamptz not null default now()
);

insert into private.bold_credentials (id, api_key, secret_key)
values (true, null, null)
on conflict (id) do nothing;

revoke all on table private.bold_credentials from public, anon, authenticated;
grant usage on schema private to postgres, service_role;

-- Extender pasarela para propósitos (recarga / factura / cuota)
alter table public.payment_gateway_transactions
  add column if not exists purpose text not null default 'topup'
    check (purpose in ('topup', 'bill', 'installment'));

alter table public.payment_gateway_transactions
  add column if not exists purpose_meta jsonb not null default '{}'::jsonb;

alter table public.payment_gateway_transactions
  add column if not exists integrity_signature text;

alter table public.payment_gateway_transactions
  add column if not exists bold_tx_status text;

alter table public.payment_gateway_transactions
  add column if not exists completed_at timestamptz;

alter table public.payment_gateway_transactions
  add column if not exists reconciled boolean not null default false;

-- Configurar keys (reemplaza los placeholders con tus keys reales de Bold)
-- update private.bold_credentials
-- set api_key = 'tu_BOLD_API_KEY',
--     secret_key = 'tu_BOLD_SECRET_KEY',
--     updated_at = now()
-- where id = true;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.map_bold_status(p_status text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_status, ''))
    when 'approved' then 'approved'
    when 'rejected' then 'rejected'
    when 'pending' then 'pending'
    when 'error' then 'error'
    when 'voided' then 'reversed'
    else 'pending'
  end;
$$;

create or replace function public.generate_bold_order_id()
returns text
language plpgsql
as $$
begin
  return 'BOLD-' || (extract(epoch from clock_timestamp()) * 1000)::bigint::text
    || '-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 8));
end;
$$;

create or replace function public.bold_integrity_signature(
  p_order_id text,
  p_amount bigint,
  p_currency text
)
returns text
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_secret text;
begin
  select secret_key into v_secret from private.bold_credentials where id = true;
  if v_secret is null or length(trim(v_secret)) = 0 then
    raise exception 'BOLD_SECRET_KEY no configurada. Actualiza private.bold_credentials.';
  end if;
  return encode(
    digest(p_order_id || p_amount::text || p_currency || v_secret, 'sha256'),
    'hex'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RF-30: config pública (api key) — nunca el secret
-- -----------------------------------------------------------------------------
create or replace function public.get_bold_public_config()
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_api text;
begin
  select api_key into v_api from private.bold_credentials where id = true;
  return jsonb_build_object(
    'apiKey', nullif(trim(coalesce(v_api, '')), ''),
    'scriptUrl', 'https://checkout.bold.co/library/boldPaymentButton.js',
    'configured', coalesce(length(trim(v_api)) > 0, false)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RF-30 / RF-31: preparar checkout Bold (firma de integridad)
-- -----------------------------------------------------------------------------
create or replace function public.prepare_bold_checkout(
  p_account_id uuid,
  p_amount numeric,
  p_description text default 'Pago Fincomer via Bold',
  p_purpose text default 'topup',
  p_purpose_meta jsonb default '{}'::jsonb,
  p_redirection_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_api text;
  v_order text;
  v_amount_int bigint;
  v_sig text;
  v_tx public.payment_gateway_transactions%rowtype;
  v_profile public.profiles%rowtype;
  v_meta jsonb := coalesce(p_purpose_meta, '{}'::jsonb);
  v_inst public.credit_installments%rowtype;
  v_credit public.credits%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Monto inválido';
  end if;

  if p_purpose not in ('topup', 'bill', 'installment') then
    raise exception 'Propósito de pago no válido';
  end if;

  if not exists (
    select 1 from public.accounts
    where id = p_account_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'Cuenta no autorizada';
  end if;

  select api_key into v_api from private.bold_credentials where id = true;
  if v_api is null or length(trim(v_api)) = 0 then
    raise exception 'BOLD_API_KEY no configurada. Actualiza private.bold_credentials.';
  end if;

  -- Validaciones por propósito
  if p_purpose = 'bill' then
    if coalesce(v_meta->>'provider_id', '') = '' or coalesce(v_meta->>'bill_reference', '') = '' then
      raise exception 'Pago de factura requiere provider_id y bill_reference';
    end if;
    if not exists (
      select 1 from public.service_providers
      where id = (v_meta->>'provider_id')::uuid and active
    ) then
      raise exception 'Proveedor no válido';
    end if;
  end if;

  if p_purpose = 'installment' then
    if coalesce(v_meta->>'installment_id', '') = '' then
      raise exception 'Pago de cuota requiere installment_id';
    end if;
    select * into v_inst
    from public.credit_installments
    where id = (v_meta->>'installment_id')::uuid;
    if not found then
      raise exception 'Cuota no encontrada';
    end if;
    if v_inst.status = 'paid' then
      raise exception 'La cuota ya está pagada';
    end if;
    select * into v_credit from public.credits where id = v_inst.credit_id;
    if v_credit.user_id <> auth.uid() then
      raise exception 'Cuota no autorizada';
    end if;
    -- Forzar monto exacto de la cuota
    p_amount := v_inst.total_amount;
    v_meta := v_meta || jsonb_build_object('credit_id', v_credit.id);
  end if;

  select * into v_profile from public.profiles where id = auth.uid();

  v_order := public.generate_bold_order_id();
  v_amount_int := trunc(p_amount)::bigint;
  v_sig := public.bold_integrity_signature(v_order, v_amount_int, 'COP');

  insert into public.payment_gateway_transactions (
    user_id, account_id, provider, external_id, reference_code, amount, currency,
    description, status, redirect_url, integrity_signature, purpose, purpose_meta,
    idempotency_key
  ) values (
    auth.uid(), p_account_id, 'bold', null, v_order, v_amount_int, 'COP',
    coalesce(nullif(p_description, ''), 'Pago Fincomer via Bold'),
    'created', p_redirection_url, v_sig, p_purpose, v_meta,
    encode(gen_random_bytes(16), 'hex')
  )
  returning * into v_tx;

  perform public.write_audit('BOLD_PREPARE', 'payment_gateway_transactions', v_tx.id::text,
    jsonb_build_object('orderId', v_order, 'amount', v_amount_int, 'purpose', p_purpose));

  return jsonb_build_object(
    'payment', to_jsonb(v_tx),
    'boldCheckoutData', jsonb_build_object(
      'apiKey', v_api,
      'orderId', v_order,
      'amount', v_amount_int,
      'currency', 'COP',
      'description', v_tx.description,
      'integritySignature', v_sig,
      'redirectionUrl', coalesce(p_redirection_url, ''),
      'customerData', jsonb_build_object(
        'email', v_profile.email,
        'fullName', v_profile.full_name,
        'phone', coalesce(v_profile.phone, ''),
        'dialCode', '+57',
        'documentNumber', v_profile.document_number,
        'documentType', v_profile.document_type
      ),
      'billingAddress', jsonb_build_object(
        'address', coalesce(v_profile.address, ''),
        'zipCode', '',
        'city', coalesce(v_profile.city, ''),
        'state', coalesce(v_profile.department, ''),
        'country', 'CO'
      )
    )
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Conciliación financiera al aprobar (idempotente)
-- -----------------------------------------------------------------------------
create or replace function public.apply_bold_approval(p_tx_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.payment_gateway_transactions%rowtype;
  v_acc public.accounts%rowtype;
  v_new numeric;
  v_provider text;
  v_receipt text;
  v_inst public.credit_installments%rowtype;
  v_credit public.credits%rowtype;
  v_out numeric;
begin
  select * into v_tx from public.payment_gateway_transactions where id = p_tx_id for update;
  if not found then
    raise exception 'Transacción no encontrada';
  end if;

  if v_tx.reconciled then
    return;
  end if;

  if v_tx.status <> 'approved' then
    raise exception 'Solo se concilian transacciones approved';
  end if;

  if v_tx.purpose = 'topup' then
    select * into v_acc from public.accounts where id = v_tx.account_id for update;
    if not found then
      raise exception 'Cuenta destino no encontrada';
    end if;
    v_new := v_acc.balance + v_tx.amount;
    update public.accounts set balance = v_new where id = v_acc.id;
    insert into public.movements (account_id, movement_type, amount, balance_after, description, reference_code)
    values (
      v_acc.id, 'credit', v_tx.amount, v_new,
      'Recarga Bold: ' || coalesce(v_tx.description, v_tx.reference_code),
      v_tx.reference_code
    );
    perform public.notify_user(
      v_tx.user_id, 'operation', 'Recarga Bold aprobada',
      format('Se acreditaron $%s a tu cuenta. Ref: %s', v_tx.amount, v_tx.reference_code)
    );

  elsif v_tx.purpose = 'bill' then
    select name into v_provider
    from public.service_providers
    where id = (v_tx.purpose_meta->>'provider_id')::uuid;
    v_receipt := 'BOLD-' || substr(encode(gen_random_bytes(6), 'hex'), 1, 12);
    insert into public.bill_payments (
      user_id, account_id, provider_id, bill_reference, amount, status, receipt_code
    ) values (
      v_tx.user_id,
      v_tx.account_id,
      (v_tx.purpose_meta->>'provider_id')::uuid,
      v_tx.purpose_meta->>'bill_reference',
      v_tx.amount,
      'completed',
      v_receipt
    );
    -- No debita cuenta Fincomer: el dinero salió por Bold (tarjeta/PSE externo)
    perform public.notify_user(
      v_tx.user_id, 'operation', 'Pago de servicio vía Bold',
      format('Pagaste $%s a %s. Comprobante: %s', v_tx.amount, coalesce(v_provider, 'proveedor'), v_receipt)
    );

  elsif v_tx.purpose = 'installment' then
    select * into v_inst
    from public.credit_installments
    where id = (v_tx.purpose_meta->>'installment_id')::uuid
    for update;
    if not found then
      raise exception 'Cuota no encontrada para conciliar';
    end if;
    if v_inst.status <> 'paid' then
      update public.credit_installments
      set status = 'paid', paid_at = now()
      where id = v_inst.id;

      select * into v_credit from public.credits where id = v_inst.credit_id for update;
      v_out := greatest(v_credit.outstanding_balance - v_inst.total_amount, 0);
      update public.credits
      set outstanding_balance = v_out,
          status = case when v_out = 0 then 'paid' else status end
      where id = v_credit.id;
    end if;
    perform public.notify_user(
      v_tx.user_id, 'credit', 'Cuota pagada vía Bold',
      format('Cuota #%s pagada por $%s. Ref: %s',
        v_inst.installment_number, v_tx.amount, v_tx.reference_code)
    );
  end if;

  update public.payment_gateway_transactions
  set reconciled = true, completed_at = coalesce(completed_at, now()), updated_at = now()
  where id = v_tx.id;

  perform public.write_audit('BOLD_RECONCILE', 'payment_gateway_transactions', v_tx.id::text,
    jsonb_build_object('purpose', v_tx.purpose, 'amount', v_tx.amount));
end;
$$;

-- -----------------------------------------------------------------------------
-- RF-32 / RF-33 / RF-34: completar desde redirect o webhook
-- -----------------------------------------------------------------------------
create or replace function public.complete_bold_payment(
  p_order_id text,
  p_status text,
  p_bold_tx_id text default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.payment_gateway_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.payment_gateway_transactions%rowtype;
  v_mapped text;
begin
  if p_order_id is null or length(trim(p_order_id)) = 0 then
    raise exception 'order_id requerido';
  end if;

  select * into v_tx
  from public.payment_gateway_transactions
  where reference_code = p_order_id
  for update;

  if not found then
    raise exception 'Transacción Bold no encontrada: %', p_order_id;
  end if;

  -- Solo el dueño, staff, o service_role (webhook) pueden completar
  if auth.uid() is not null
     and v_tx.user_id <> auth.uid()
     and not public.is_staff() then
    raise exception 'No autorizado';
  end if;

  -- Idempotencia: ya terminal y reconciliada
  if v_tx.status in ('approved', 'rejected', 'reversed', 'error') and v_tx.reconciled then
    return v_tx;
  end if;

  v_mapped := public.map_bold_status(p_status);

  update public.payment_gateway_transactions
  set
    status = v_mapped,
    external_id = coalesce(p_bold_tx_id, external_id),
    bold_tx_status = p_status,
    webhook_payload = coalesce(p_payload, '{}'::jsonb),
    updated_at = now(),
    completed_at = case
      when v_mapped in ('approved', 'rejected', 'reversed', 'error') then now()
      else completed_at
    end
  where id = v_tx.id
  returning * into v_tx;

  if v_mapped = 'approved' then
    perform public.apply_bold_approval(v_tx.id);
    select * into v_tx from public.payment_gateway_transactions where id = v_tx.id;
  elsif v_mapped in ('rejected', 'reversed', 'error') then
    perform public.notify_user(
      v_tx.user_id, 'operation', 'Pago Bold no aprobado',
      format('Tu pago %s quedó en estado %s.', v_tx.reference_code, v_mapped)
    );
    perform public.write_audit('BOLD_REJECT', 'payment_gateway_transactions', v_tx.id::text,
      jsonb_build_object('status', v_mapped, 'payload', p_payload));
  end if;

  return v_tx;
end;
$$;

-- Webhook público (Bold no envía JWT). Valida order_id existente.
create or replace function public.bold_webhook(
  p_order_id text,
  p_status text,
  p_bold_tx_id text default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.payment_gateway_transactions%rowtype;
begin
  -- Misma lógica; sin exigir auth.uid (Bold llama sin sesión)
  select * into v_tx
  from public.payment_gateway_transactions
  where reference_code = p_order_id
  for update;

  if not found then
    raise exception 'Transacción Bold no encontrada: %', p_order_id;
  end if;

  -- Reutiliza complete forzando contexto: actualiza directo vía apply path
  update public.payment_gateway_transactions
  set
    status = public.map_bold_status(p_status),
    external_id = coalesce(p_bold_tx_id, external_id),
    bold_tx_status = p_status,
    webhook_payload = coalesce(p_payload, '{}'::jsonb),
    webhook_signature = coalesce(p_payload->>'signature', webhook_signature),
    updated_at = now()
  where id = v_tx.id
  returning * into v_tx;

  if v_tx.status = 'approved' and not v_tx.reconciled then
    perform public.apply_bold_approval(v_tx.id);
    select * into v_tx from public.payment_gateway_transactions where id = v_tx.id;
  end if;

  return jsonb_build_object('ok', true, 'status', v_tx.status, 'orderId', v_tx.reference_code);
end;
$$;

-- -----------------------------------------------------------------------------
-- RF-29: pagar cuota desde saldo Fincomer (sin Bold)
-- -----------------------------------------------------------------------------
create or replace function public.pay_credit_installment(
  p_account_id uuid,
  p_installment_id uuid
)
returns public.credit_installments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acc public.accounts%rowtype;
  v_inst public.credit_installments%rowtype;
  v_credit public.credits%rowtype;
  v_new numeric;
  v_out numeric;
  v_receipt text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select * into v_inst from public.credit_installments where id = p_installment_id for update;
  if not found then
    raise exception 'Cuota no encontrada';
  end if;
  if v_inst.status = 'paid' then
    raise exception 'La cuota ya está pagada';
  end if;

  select * into v_credit from public.credits where id = v_inst.credit_id for update;
  if v_credit.user_id <> auth.uid() then
    raise exception 'Crédito no autorizado';
  end if;

  select * into v_acc
  from public.accounts
  where id = p_account_id and user_id = auth.uid() and status = 'active'
  for update;
  if not found then
    raise exception 'Cuenta no autorizada';
  end if;

  if v_acc.balance < v_inst.total_amount then
    raise exception 'Saldo insuficiente';
  end if;

  v_new := v_acc.balance - v_inst.total_amount;
  v_receipt := encode(gen_random_bytes(8), 'hex');

  update public.accounts set balance = v_new where id = v_acc.id;
  insert into public.movements (account_id, movement_type, amount, balance_after, description, reference_code)
  values (
    v_acc.id, 'payment', v_inst.total_amount, v_new,
    format('Pago cuota #%s crédito', v_inst.installment_number),
    v_receipt
  );

  update public.credit_installments
  set status = 'paid', paid_at = now()
  where id = v_inst.id
  returning * into v_inst;

  v_out := greatest(v_credit.outstanding_balance - v_inst.total_amount, 0);
  update public.credits
  set outstanding_balance = v_out,
      status = case when v_out = 0 then 'paid' else status end
  where id = v_credit.id;

  perform public.write_audit('INSTALLMENT_PAY', 'credit_installments', v_inst.id::text,
    jsonb_build_object('amount', v_inst.total_amount, 'receipt', v_receipt));

  perform public.notify_user(
    auth.uid(), 'credit', 'Cuota de crédito pagada',
    format('Pagaste la cuota #%s por $%s. Comprobante: %s',
      v_inst.installment_number, v_inst.total_amount, v_receipt)
  );

  return v_inst;
end;
$$;

-- Grants
grant execute on function public.get_bold_public_config() to authenticated, anon;
grant execute on function public.prepare_bold_checkout(uuid, numeric, text, text, jsonb, text) to authenticated;
grant execute on function public.complete_bold_payment(text, text, text, jsonb) to authenticated;
grant execute on function public.bold_webhook(text, text, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.pay_credit_installment(uuid, uuid) to authenticated;
grant execute on function public.map_bold_status(text) to authenticated;
grant execute on function public.generate_bold_order_id() to authenticated;

-- Nota: bold_integrity_signature y apply_bold_approval NO se exponen a clientes
