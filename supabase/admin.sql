-- =============================================================================
-- Fincomer · Administración de asociados (RF-38 … RF-42)
-- Ejecutar en SQL Editor DESPUÉS de schema.sql
-- =============================================================================

create or replace function public.assert_admin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_role('admin') then
    raise exception 'Solo administradores pueden realizar esta acción';
  end if;
end;
$$;

-- Cambiar estado: active | blocked | pending | inactive (dar de baja)
create or replace function public.admin_set_profile_status(
  p_user_id uuid,
  p_status text
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_profile public.profiles%rowtype;
begin
  perform public.assert_admin();

  if p_status not in ('active', 'blocked', 'pending', 'inactive') then
    raise exception 'Estado no válido';
  end if;

  if p_user_id = auth.uid() and p_status <> 'active' then
    raise exception 'No puedes desactivar tu propia cuenta de administrador';
  end if;

  update public.profiles
  set status = p_status, updated_at = now()
  where id = p_user_id
  returning * into v_profile;

  if not found then
    raise exception 'Usuario no encontrado';
  end if;

  -- Bloqueo a nivel Auth: no podrá autenticarse
  if p_status = 'active' then
    update auth.users set banned_until = null where id = p_user_id;
  else
    update auth.users set banned_until = 'infinity'::timestamptz where id = p_user_id;
  end if;

  perform public.write_audit(
    'ADMIN_STATUS',
    'profiles',
    p_user_id::text,
    jsonb_build_object('status', p_status)
  );

  perform public.notify_user(
    p_user_id,
    'security',
    'Estado de cuenta actualizado',
    format('Tu cuenta Fincomer quedó en estado: %s.', p_status)
  );

  return v_profile;
end;
$$;

-- Crear asociado (Auth + perfil + rol). El trigger handle_new_user completa cuentas.
create or replace function public.admin_create_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_document_number text,
  p_phone text default null,
  p_document_type text default 'CC',
  p_role_code text default 'asociado'
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_id uuid := gen_random_uuid();
  v_role_id smallint;
  v_profile public.profiles%rowtype;
  v_email text := lower(trim(p_email));
begin
  perform public.assert_admin();

  if v_email is null or position('@' in v_email) = 0 then
    raise exception 'Correo inválido';
  end if;
  if p_password is null or length(p_password) < 6 then
    raise exception 'La contraseña debe tener al menos 6 caracteres';
  end if;
  if coalesce(trim(p_full_name), '') = '' then
    raise exception 'Nombre requerido';
  end if;
  if coalesce(trim(p_document_number), '') = '' then
    raise exception 'Documento requerido';
  end if;
  if p_document_type not in ('CC', 'CE', 'NIT', 'PA') then
    raise exception 'Tipo de documento inválido';
  end if;
  if p_role_code not in ('asociado', 'asesor', 'admin', 'riesgos') then
    raise exception 'Rol inválido';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Ya existe un usuario con ese correo';
  end if;
  if exists (select 1 from public.profiles where document_number = p_document_number) then
    raise exception 'Ya existe un asociado con ese documento';
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    is_super_admin, is_sso_user
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'full_name', p_full_name,
      'document_number', p_document_number,
      'phone', p_phone
    ),
    now(), now(),
    '', '', '', '',
    false, false
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email',
    v_id::text,
    now(), now(), now()
  );

  -- Ajuste de perfil (el trigger ya insertó fila básica)
  update public.profiles
  set
    full_name = p_full_name,
    document_number = p_document_number,
    document_type = p_document_type,
    phone = p_phone,
    email = v_email,
    status = 'active',
    updated_at = now()
  where id = v_id
  returning * into v_profile;

  if p_role_code <> 'asociado' then
    select id into v_role_id from public.app_roles where code = p_role_code;
    insert into public.user_roles (user_id, role_id)
    values (v_id, v_role_id)
    on conflict do nothing;
  end if;

  perform public.write_audit(
    'ADMIN_CREATE_USER',
    'profiles',
    v_id::text,
    jsonb_build_object('email', v_email, 'role', p_role_code)
  );

  return v_profile;
end;
$$;

-- Dar de baja (inactive) — atajo
create or replace function public.admin_deactivate_user(p_user_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.admin_set_profile_status(p_user_id, 'inactive');
end;
$$;

-- Eliminar definitivamente (borra Auth → cascade a profiles)
create or replace function public.admin_delete_user(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_email text;
begin
  perform public.assert_admin();

  if p_user_id = auth.uid() then
    raise exception 'No puedes eliminar tu propia cuenta';
  end if;

  select email into v_email from public.profiles where id = p_user_id;
  if v_email is null then
    raise exception 'Usuario no encontrado';
  end if;

  perform public.write_audit(
    'ADMIN_DELETE_USER',
    'profiles',
    p_user_id::text,
    jsonb_build_object('email', v_email)
  );

  delete from auth.users where id = p_user_id;

  return jsonb_build_object('ok', true, 'email', v_email);
end;
$$;

grant execute on function public.assert_admin() to authenticated;
grant execute on function public.admin_set_profile_status(uuid, text) to authenticated;
grant execute on function public.admin_create_user(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_deactivate_user(uuid) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
