import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { formatCOP, formatDate, statusLabel } from '@/lib/format'
import { listAccounts, listMovements } from '@/services/fincomer'
import type { Account, Movement } from '@/types'
import {
  Badge,
  EmptyState,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Panel,
} from '@/components/ui'

export function AccountsPage() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selected, setSelected] = useState('')
  const [movements, setMovements] = useState<Movement[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<Movement | null>(null)

  useEffect(() => {
    if (!user) return
    void listAccounts(user.id).then((data) => {
      setAccounts(data)
      if (data[0]) setSelected(data[0].id)
      setLoading(false)
    })
  }, [user])

  useEffect(() => {
    if (!selected) return
    void listMovements(
      selected,
      from ? new Date(from).toISOString() : undefined,
      to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    ).then(setMovements)
  }, [selected, from, to])

  if (loading) return <LoadingBlock />

  const current = accounts.find((a) => a.id === selected)

  return (
    <div className="stack">
      <PageHeader
        eyebrow="RF-11 · RF-12 · RF-13 · RF-14"
        title="Cuentas y ahorros"
        description="Consulta saldos, movimientos y el detalle de cada operación."
      />

      <div className="grid-2">
        <Panel title="Productos">
          <ul className="list">
            {accounts.map((account) => (
              <li key={account.id}>
                <button
                  type="button"
                  className={`account-pill ${selected === account.id ? 'active' : ''}`}
                  onClick={() => setSelected(account.id)}
                >
                  <span>
                    <strong>{account.product_name}</strong>
                    <small className="mono">{account.account_number}</small>
                  </span>
                  <strong>{formatCOP(account.balance)}</strong>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Extracto / filtros">
          {current ? (
            <>
              <p>
                Saldo actual: <strong>{formatCOP(current.balance)}</strong>
              </p>
              <div className="form-row">
                <Field label="Desde">
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </Field>
                <Field label="Hasta">
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </Field>
              </div>
              <p className="muted">
                Para extracto PDF (RF-13): imprime esta vista o exporta desde el navegador (Ctrl+P).
              </p>
            </>
          ) : (
            <EmptyState title="Sin cuentas" />
          )}
        </Panel>
      </div>

      <Panel title="Movimientos">
        {movements.length === 0 ? (
          <EmptyState title="Sin movimientos en el rango" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} onClick={() => setDetail(m)} className="clickable">
                    <td>{formatDate(m.created_at)}</td>
                    <td>{m.description}</td>
                    <td>
                      <Badge>{m.movement_type}</Badge>
                    </td>
                    <td>{formatCOP(m.amount)}</td>
                    <td>{formatCOP(m.balance_after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {detail ? (
        <Panel title="Detalle de transacción (RF-14)">
          <dl className="meta-list">
            <div>
              <dt>Referencia</dt>
              <dd className="mono">{detail.reference_code ?? detail.id}</dd>
            </div>
            <div>
              <dt>Tipo</dt>
              <dd>{statusLabel(detail.movement_type)}</dd>
            </div>
            <div>
              <dt>Monto</dt>
              <dd>{formatCOP(detail.amount)}</dd>
            </div>
            <div>
              <dt>Saldo posterior</dt>
              <dd>{formatCOP(detail.balance_after)}</dd>
            </div>
          </dl>
          <button type="button" className="text-link" onClick={() => setDetail(null)}>
            Cerrar detalle
          </button>
        </Panel>
      ) : null}

    </div>
  )
}
