import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate, statusLabel } from '@/lib/format'
import {
  adminCreateUser,
  adminDeleteUser,
  adminDeactivateUser,
  adminSetProfileStatus,
  listAllProfiles,
  listSystemParameters,
} from '@/services/fincomer'
import type { AppRoleCode, Profile, SystemParameter } from '@/types'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Panel,
  Select,
} from '@/components/ui'

const STATUSES: Profile['status'][] = ['active', 'blocked', 'pending', 'inactive']

function statusTone(status: string): 'ok' | 'danger' | 'warn' | 'info' | 'neutral' {
  if (status === 'active') return 'ok'
  if (status === 'blocked' || status === 'inactive') return 'danger'
  if (status === 'pending') return 'warn'
  return 'neutral'
}

export function AdminPage() {
  const { user } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [params, setParams] = useState<SystemParameter[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [documentType, setDocumentType] = useState<Profile['document_type']>('CC')
  const [roleCode, setRoleCode] = useState<AppRoleCode>('asociado')

  async function reload() {
    const [p, s] = await Promise.all([listAllProfiles(), listSystemParameters()])
    setProfiles(p)
    setParams(s)
  }

  useEffect(() => {
    void (async () => {
      try {
        await reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sin permisos de administración')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    setOk(null)
    try {
      const created = await adminCreateUser({
        email,
        password,
        fullName,
        documentNumber,
        phone: phone || undefined,
        documentType,
        roleCode,
      })
      setOk(`Cuenta creada: ${created.email}`)
      setEmail('')
      setPassword('')
      setFullName('')
      setDocumentNumber('')
      setPhone('')
      setRoleCode('asociado')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la cuenta')
    } finally {
      setCreating(false)
    }
  }

  async function onStatus(id: string, status: Profile['status']) {
    setBusyId(id)
    setError(null)
    setOk(null)
    try {
      await adminSetProfileStatus(id, status)
      setOk(`Estado actualizado a ${statusLabel(status)}`)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado')
    } finally {
      setBusyId(null)
    }
  }

  async function onDeactivate(id: string) {
    if (!confirm('¿Dar de baja este asociado? No podrá iniciar sesión.')) return
    setBusyId(id)
    setError(null)
    setOk(null)
    try {
      await adminDeactivateUser(id)
      setOk('Asociado dado de baja')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo dar de baja')
    } finally {
      setBusyId(null)
    }
  }

  async function onDelete(id: string, name: string) {
    if (
      !confirm(
        `¿Eliminar definitivamente a ${name}? Esta acción no se puede deshacer.`,
      )
    ) {
      return
    }
    setBusyId(id)
    setError(null)
    setOk(null)
    try {
      await adminDeleteUser(id)
      setOk('Cuenta eliminada')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <LoadingBlock />

  return (
    <div className="stack">
      <PageHeader
        eyebrow="RF-38 · RF-39 · RF-40 · RF-41 · RF-42"
        title="Administración"
        description="Crea asociados, cambia estados, da de baja o elimina cuentas. Si no están activas, no pueden ingresar."
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {ok ? <Alert tone="ok">{ok}</Alert> : null}

      {error && profiles.length === 0 ? (
        <Panel>
          <EmptyState title="Acceso restringido" description={error} />
        </Panel>
      ) : (
        <>
          <div className="stats-row">
            <article className="stat">
              <p className="stat__label">Asociados</p>
              <p className="stat__value">{profiles.length}</p>
            </article>
            <article className="stat">
              <p className="stat__label">Activos</p>
              <p className="stat__value">
                {profiles.filter((p) => p.status === 'active').length}
              </p>
            </article>
            <article className="stat">
              <p className="stat__label">Baja / bloqueados</p>
              <p className="stat__value">
                {
                  profiles.filter(
                    (p) => p.status === 'inactive' || p.status === 'blocked',
                  ).length
                }
              </p>
            </article>
          </div>

          <Panel title="Crear cuenta">
            <form className="form-stack" onSubmit={(e) => void onCreate(e)}>
              <div className="form-row">
                <Field label="Nombre completo">
                  <Input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </Field>
                <Field label="Correo">
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
              </div>
              <div className="form-row">
                <Field label="Tipo doc.">
                  <Select
                    value={documentType}
                    onChange={(e) =>
                      setDocumentType(e.target.value as Profile['document_type'])
                    }
                  >
                    <option value="CC">CC</option>
                    <option value="CE">CE</option>
                    <option value="NIT">NIT</option>
                    <option value="PA">PA</option>
                  </Select>
                </Field>
                <Field label="Documento">
                  <Input
                    required
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                  />
                </Field>
              </div>
              <div className="form-row">
                <Field label="Teléfono">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </Field>
                <Field label="Contraseña temporal">
                  <Input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Rol inicial">
                <Select
                  value={roleCode}
                  onChange={(e) => setRoleCode(e.target.value as AppRoleCode)}
                >
                  <option value="asociado">Asociado</option>
                  <option value="asesor">Asesor</option>
                  <option value="admin">Administrador</option>
                  <option value="riesgos">Riesgos</option>
                </Select>
              </Field>
              <Button type="submit" disabled={creating}>
                {creating ? 'Creando…' : 'Crear cuenta'}
              </Button>
            </form>
          </Panel>

          <Panel title="Gestión de usuarios">
            {profiles.length === 0 ? (
              <EmptyState title="Sin usuarios" />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Documento</th>
                      <th>Correo</th>
                      <th>Estado</th>
                      <th>Alta</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((p) => {
                      const isSelf = p.id === user?.id
                      const busy = busyId === p.id
                      return (
                        <tr key={p.id}>
                          <td>{p.full_name}</td>
                          <td>
                            {p.document_type} {p.document_number}
                          </td>
                          <td>{p.email}</td>
                          <td>
                            <Badge tone={statusTone(p.status)}>
                              {statusLabel(p.status)}
                            </Badge>
                          </td>
                          <td>{formatDate(p.created_at)}</td>
                          <td>
                            <div className="admin-actions">
                              <Select
                                value={p.status}
                                disabled={busy || isSelf}
                                onChange={(e) =>
                                  void onStatus(p.id, e.target.value as Profile['status'])
                                }
                                aria-label={`Estado de ${p.full_name}`}
                              >
                                {STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {statusLabel(s)}
                                  </option>
                                ))}
                              </Select>
                              <button
                                type="button"
                                className="btn btn--soft"
                                disabled={busy || isSelf || p.status === 'inactive'}
                                onClick={() => void onDeactivate(p.id)}
                              >
                                Dar de baja
                              </button>
                              <button
                                type="button"
                                className="btn btn--danger"
                                disabled={busy || isSelf}
                                onClick={() => void onDelete(p.id, p.full_name)}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="muted" style={{ marginTop: '0.75rem', fontSize: '0.72rem' }}>
              Estados <strong>bloqueada</strong>, <strong>pendiente</strong> o{' '}
              <strong>inactiva</strong> impiden el inicio de sesión. No puedes dar de baja ni
              eliminar tu propia sesión de admin.
            </p>
          </Panel>

          <Panel title="Parametrización">
            <ul className="list">
              {params.map((param) => (
                <li key={param.key} className="list__row">
                  <div>
                    <strong className="mono">{param.key}</strong>
                    <p className="muted">{param.description}</p>
                  </div>
                  <code>{JSON.stringify(param.value)}</code>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}
    </div>
  )
}
