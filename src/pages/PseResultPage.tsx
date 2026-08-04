import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { parseBoldResultParams } from '@/lib/bold'
import { formatCOP, statusLabel } from '@/lib/format'
import { completeBoldPayment } from '@/services/bold'
import type { GatewayTransaction } from '@/types'
import { Alert, Badge, LoadingBlock, PageHeader, Panel } from '@/components/ui'

export function PseResultPage() {
  const location = useLocation()
  const [tx, setTx] = useState<GatewayTransaction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { orderId, boldTxId, status } = parseBoldResultParams(location.search)

    async function run() {
      if (!orderId) {
        setError('Bold no devolvió order-id. Verifica la URL de redirección.')
        setLoading(false)
        return
      }
      try {
        const result = await completeBoldPayment({
          orderId,
          status,
          boldTxId,
          payload: Object.fromEntries(new URLSearchParams(location.search)),
        })
        setTx(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo conciliar el pago')
      } finally {
        setLoading(false)
      }
    }

    void run()
  }, [location.search])

  if (loading) return <LoadingBlock />

  const tone =
    tx?.status === 'approved' ? 'ok' : tx?.status === 'rejected' || tx?.status === 'error' ? 'danger' : 'info'

  return (
    <div className="stack">
      <PageHeader
        eyebrow="Resultado Bold"
        title="Pago procesado"
        description="Fincomer recibió la respuesta de Bold y actualizó el estado financiero."
      />

      <Panel title="Detalle">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {tx ? (
          <>
            <Alert tone={tone === 'ok' ? 'ok' : tone === 'danger' ? 'danger' : 'info'}>
              Estado: <strong>{statusLabel(tx.status)}</strong>
              {tx.purpose ? ` · Propósito: ${tx.purpose}` : null}
            </Alert>
            <dl className="meta-list">
              <div>
                <dt>Referencia</dt>
                <dd className="mono">{tx.reference_code}</dd>
              </div>
              <div>
                <dt>Monto</dt>
                <dd>{formatCOP(tx.amount)}</dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <Badge tone={tone}>{statusLabel(tx.status)}</Badge>
                </dd>
              </div>
            </dl>
          </>
        ) : null}

        <div className="row-gap" style={{ marginTop: '1rem' }}>
          <Link to="/pse" className="btn btn--primary">
            Volver a PSE / Bold
          </Link>
          <Link to="/dashboard" className="btn btn--soft">
            Ir al inicio
          </Link>
          {tx?.purpose === 'installment' ? (
            <Link to="/creditos" className="btn btn--ghost">
              Ver créditos
            </Link>
          ) : null}
          {tx?.purpose === 'bill' ? (
            <Link to="/pagos" className="btn btn--ghost">
              Ver pagos
            </Link>
          ) : null}
        </div>
      </Panel>
    </div>
  )
}
