import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  updateProfile,
} from '@/services/fincomer'
import type { NotificationPreferences } from '@/types'
import { Alert, Button, Field, Input, LoadingBlock, PageHeader, Panel } from '@/components/ui'

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth()
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || !profile) return
    setPhone(profile.phone ?? '')
    setAddress(profile.address ?? '')
    setCity(profile.city ?? '')
    void getNotificationPreferences(user.id)
      .then(setPrefs)
      .finally(() => setLoading(false))
  }, [user, profile])

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError(null)
    try {
      await updateProfile(user.id, { phone, address, city })
      await refreshProfile()
      setMsg('Datos de contacto actualizados.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    }
  }

  async function onSavePrefs(e: FormEvent) {
    e.preventDefault()
    if (!user || !prefs) return
    try {
      const next = await updateNotificationPreferences(user.id, prefs)
      setPrefs(next)
      setMsg('Preferencias de notificación guardadas.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar preferencias')
    }
  }

  if (loading || !profile) return <LoadingBlock />

  return (
    <div className="stack">
      <PageHeader
        eyebrow="RF-08 · RF-09 · RF-10"
        title="Mi perfil"
        description="Consulta tus datos y configura canales de notificación."
      />

      <div className="grid-2">
        <Panel title="Datos personales">
          <dl className="meta-list">
            <div>
              <dt>Nombre</dt>
              <dd>{profile.full_name}</dd>
            </div>
            <div>
              <dt>Documento</dt>
              <dd>
                {profile.document_type} {profile.document_number}
              </dd>
            </div>
            <div>
              <dt>Correo</dt>
              <dd>{profile.email}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>{profile.status}</dd>
            </div>
          </dl>

          <form className="form-stack" style={{ marginTop: '1rem' }} onSubmit={(e) => void onSaveProfile(e)}>
            <Field label="Teléfono">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Dirección">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </Field>
            <Field label="Ciudad">
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </Field>
            <Button type="submit">Guardar contacto</Button>
          </form>
        </Panel>

        <Panel title="Preferencias de notificación">
          {prefs ? (
            <form className="form-stack" onSubmit={(e) => void onSavePrefs(e)}>
              {(
                [
                  ['email_enabled', 'Correo'],
                  ['sms_enabled', 'SMS'],
                  ['push_enabled', 'Push'],
                  ['security_alerts', 'Alertas de seguridad'],
                  ['operation_alerts', 'Alertas de operaciones'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="check">
                  <input
                    type="checkbox"
                    checked={Boolean(prefs[key])}
                    onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
              <Button type="submit" variant="soft">
                Guardar preferencias
              </Button>
            </form>
          ) : null}
        </Panel>
      </div>

      {msg ? <Alert tone="ok">{msg}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  )
}
