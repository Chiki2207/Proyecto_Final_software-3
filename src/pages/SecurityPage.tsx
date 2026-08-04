import { useState, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Alert, Button, Field, Input, PageHeader, Panel } from '@/components/ui'

export function SecurityPage() {
  const { enrollMfa, challengeAndVerifyMfa, profile, refreshProfile } = useAuth()
  const [qr, setQr] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function startEnroll() {
    setBusy(true)
    setError(null)
    const result = await enrollMfa()
    setBusy(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setQr(result.qrCode)
    setSecret(result.secret)
    setFactorId(result.factorId)
  }

  async function confirmMfa(e: FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setBusy(true)
    const { error: verifyError } = await challengeAndVerifyMfa(factorId, code)
    setBusy(false)
    if (verifyError) {
      setError(verifyError)
      return
    }
    setOk('MFA activado correctamente.')
    setQr(null)
    setSecret(null)
    setFactorId(null)
    setCode('')
    await refreshProfile()
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setOk('Contraseña actualizada.')
    setPassword('')
  }

  return (
    <div className="stack">
      <PageHeader
        eyebrow="RF-03 · RF-04 · RF-05 · RF-07"
        title="Seguridad"
        description="Autenticación multifactor, cambio de contraseña y control de sesión."
      />

      <div className="grid-2">
        <Panel title="Autenticación multifactor (MFA)">
          <p className="muted">
            Estado actual:{' '}
            <strong>{profile?.mfa_enabled ? 'MFA activo' : 'MFA pendiente de activar'}</strong>
          </p>
          {!qr ? (
            <Button onClick={() => void startEnroll()} disabled={busy}>
              Configurar MFA (TOTP)
            </Button>
          ) : (
            <form className="form-stack" onSubmit={(e) => void confirmMfa(e)}>
              <p className="muted">Escanea el QR con Google Authenticator / Authy.</p>
              <div
                className="qr-box"
                dangerouslySetInnerHTML={{ __html: qr.startsWith('<svg') || qr.startsWith('<?xml') ? qr : '' }}
              />
              {!qr.includes('<svg') ? (
                <img src={qr} alt="Código QR MFA" className="qr-img" />
              ) : null}
              <p className="mono muted">Secret: {secret}</p>
              <Field label="Código de verificación">
                <Input
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="000000"
                />
              </Field>
              <Button type="submit" disabled={busy}>
                Confirmar MFA
              </Button>
            </form>
          )}
        </Panel>

        <Panel title="Cambiar contraseña">
          <form className="form-stack" onSubmit={(e) => void changePassword(e)}>
            <Field label="Nueva contraseña">
              <Input
                type="password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            <Button type="submit" variant="soft" disabled={busy}>
              Actualizar contraseña
            </Button>
          </form>
          <p className="muted" style={{ marginTop: '1rem' }}>
            El bloqueo por intentos fallidos (RF-05) y la expiración de sesión (RF-07) se gestionan
            con Supabase Auth + políticas del perfil (`failed_login_attempts`, JWT refresh).
          </p>
        </Panel>
      </div>

      {ok ? <Alert tone="ok">{ok}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  )
}
