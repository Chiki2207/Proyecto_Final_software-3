# Fincomer Digital

Plataforma de **Servicios Financieros Digitales** de la Cooperativa Financiera Fincomer  
Universidad de la Amazonia · Ingeniería de Sistemas · 2026

## Stack

- React 19 + TypeScript + Vite
- Supabase (PostgreSQL + Auth JWT + RLS)
- Pasarela **Bold Checkout** (mismo patrón que Buscaninos: orderId + firma SHA-256 + botón oficial)

## Arranque

1. Copia `.env.example` → `.env` (URL y publishable key de Supabase).
2. En Supabase → **SQL Editor**, ejecuta en orden:

```text
supabase/schema.sql
supabase/bold.sql
supabase/admin.sql
```

3. Configura credenciales Bold (API key + secret key del panel Bold):

```sql
update private.bold_credentials
set api_key = 'TU_BOLD_API_KEY',
    secret_key = 'TU_BOLD_SECRET_KEY',
    updated_at = now()
where id = true;
```

4. Corre la app:

```bash
npm install
npm run dev
```

5. Regístrate en `/register`. El trigger crea perfil, rol `asociado`, preferencias y cuentas.

### Webhook Bold (opcional, RF-32)

```bash
supabase functions deploy bold-webhook
```

URL a registrar en Bold: `https://<project-ref>.supabase.co/functions/v1/bold-webhook`  
Si no despliegas el webhook, la conciliación ocurre al volver a `/pse/resultado` (igual que Buscaninos).

## Módulos (RF)

| Ruta | Cobertura |
|------|-----------|
| `/login` `/register` `/recuperar` `/seguridad` | RF-01…RF-07 (auth, MFA TOTP, recuperación) |
| `/perfil` | RF-08…RF-10 |
| `/cuentas` | RF-11…RF-14 |
| `/transferencias` | RF-15, RF-16, RF-18, RF-20 |
| `/pagos` | RF-21, RF-22, RF-24 (+ Bold para facturas) |
| `/creditos` | RF-25…RF-29 (incluye pago de cuota) |
| `/pse` `/pse/resultado` | RF-30…RF-34 (Bold prepare → checkout → conciliación) |
| `/notificaciones` | → campanita del header (popup) |
| `/admin` | RF-38…RF-42 (roles staff) |
| `/auditoria` | RF-43…RF-45 |

## Bold: qué hace al aprobarse

| Propósito | Efecto en Fincomer |
|-----------|--------------------|
| `topup` | Acredita saldo en la cuenta + movimiento |
| `bill` | Registra `bill_payments` (pago externo; no debita Fincomer) |
| `installment` | Marca cuota `paid` y reduce `outstanding_balance` |

## Estructura

```text
src/
  components/   UI + layout + BoldCheckoutButton
  contexts/     AuthContext (JWT + MFA + roles)
  lib/          supabase + formatters + bold helpers
  pages/        pantallas por módulo
  services/     fincomer + bold RPCs
  types/        dominio
supabase/
  schema.sql           tablas, RLS, transferencias/pagos
  bold.sql             pasarela Bold + conciliación + RF-29
  functions/bold-webhook/
```

## Notas de exposición

- Auth con **JWT** de Supabase (`access_token`).
- Transferencias y pagos usan **funciones SQL atómicas** + auditoría.
- Bold: `prepare_bold_checkout` firma con secret en `private.bold_credentials` (nunca expuesto al cliente).
- RLS: cada asociado solo ve sus datos; staff (`admin`/`asesor`/`riesgos`) ve paneles.
- Para promover un usuario a admin (SQL Editor):

```sql
insert into public.user_roles (user_id, role_id)
select '<UUID_DEL_USUARIO>', id from public.app_roles where code = 'admin';
```
