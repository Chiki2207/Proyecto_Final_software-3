import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/format'
import { listAuditLogs } from '@/services/fincomer'
import type { AuditLog } from '@/types'
import { EmptyState, LoadingBlock, PageHeader, Panel } from '@/components/ui'

export function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void listAuditLogs(80)
      .then(setLogs)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'No se pudo cargar auditoría')
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingBlock />

  return (
    <div className="stack">
      <PageHeader
        eyebrow="RF-43 · RF-44 · RF-45"
        title="Auditoría y trazabilidad"
        description="Registro de operaciones críticas con marca de tiempo y usuario."
      />

      <Panel>
        {error ? (
          <EmptyState title="Sin acceso" description={error} />
        ) : logs.length === 0 ? (
          <EmptyState title="Sin eventos aún" description="Las transferencias y pagos generan logs." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th>ID</th>
                  <th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.created_at)}</td>
                    <td>{log.action}</td>
                    <td>{log.entity}</td>
                    <td className="mono">{log.entity_id ?? '—'}</td>
                    <td className="mono">{JSON.stringify(log.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
