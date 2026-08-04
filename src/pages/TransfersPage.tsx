import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { formatCOP, formatDate, statusLabel } from '@/lib/format'
import {
  executeTransfer,
  listAccounts,
  listRecipients,
  listTransfers,
  saveRecipient,
} from '@/services/fincomer'
import type { Account, Transfer, TransferRecipient } from '@/types'
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

export function TransfersPage() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [recipients, setRecipients] = useState<TransferRecipient[]>([])
  const [fromAccountId, setFromAccountId] = useState('')
  const [toAccountNumber, setToAccountNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [kind, setKind] = useState<'own' | 'internal'>('internal')
  const [alias, setAlias] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  async function reload() {
    if (!user) return
    const [a, t, r] = await Promise.all([
      listAccounts(user.id),
      listTransfers(user.id),
      listRecipients(user.id),
    ])
    setAccounts(a)
    setTransfers(t)
    setRecipients(r)
    if (!fromAccountId && a[0]) setFromAccountId(a[0].id)
  }

  useEffect(() => {
    void reload().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function onTransfer(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await executeTransfer({
        fromAccountId,
        toAccountNumber,
        amount: Number(amount),
        description,
        kind,
      })
      setMessage(`Transferencia OK. Comprobante: ${result.receipt_code}`)
      setAmount('')
      setDescription('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en la transferencia')
    } finally {
      setBusy(false)
    }
  }

  async function onSaveRecipient(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    try {
      await saveRecipient({
        ownerId: user.id,
        alias,
        accountNumber: toAccountNumber,
      })
      setAlias('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se guardó el destinatario')
    }
  }

  if (loading) return <LoadingBlock />

  return (
    <div className="stack">
      <PageHeader
        eyebrow="RF-15 · RF-16 · RF-18 · RF-20"
        title="Transferencias"
        description="Mueve fondos entre tus cuentas o hacia otros asociados Fincomer."
      />

      <div className="grid-2">
        <Panel title="Nueva transferencia">
          <form className="form-stack" onSubmit={(e) => void onTransfer(e)}>
            <Field label="Cuenta origen">
              <Select
                required
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_number} — {formatCOP(a.balance)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo">
              <Select value={kind} onChange={(e) => setKind(e.target.value as 'own' | 'internal')}>
                <option value="own">Entre cuentas propias</option>
                <option value="internal">A otro asociado Fincomer</option>
              </Select>
            </Field>
            <Field label="Cuenta destino">
              <Input
                required
                value={toAccountNumber}
                onChange={(e) => setToAccountNumber(e.target.value)}
                placeholder="Número de cuenta"
              />
            </Field>
            <Field label="Monto (COP)">
              <Input
                required
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field label="Descripción">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            {message ? <Alert tone="ok">{message}</Alert> : null}
            <Button type="submit" disabled={busy}>
              {busy ? 'Procesando…' : 'Transferir'}
            </Button>
          </form>
        </Panel>

        <Panel title="Destinatarios frecuentes (RF-18)">
          <form className="form-stack" onSubmit={(e) => void onSaveRecipient(e)}>
            <Field label="Alias">
              <Input required value={alias} onChange={(e) => setAlias(e.target.value)} />
            </Field>
            <Field label="Cuenta a guardar">
              <Input
                required
                value={toAccountNumber}
                onChange={(e) => setToAccountNumber(e.target.value)}
              />
            </Field>
            <Button type="submit" variant="soft">
              Guardar destinatario
            </Button>
          </form>
          <ul className="list" style={{ marginTop: '1rem' }}>
            {recipients.map((r) => (
              <li key={r.id} className="list__row">
                <div>
                  <strong>{r.alias}</strong>
                  <p className="muted mono">{r.account_number}</p>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setToAccountNumber(r.account_number)}
                >
                  Usar
                </Button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="Historial y comprobantes">
        {transfers.length === 0 ? (
          <EmptyState title="Sin transferencias" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Destino</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id}>
                    <td>{formatDate(t.created_at)}</td>
                    <td className="mono">{t.to_account_number}</td>
                    <td>{formatCOP(t.amount)}</td>
                    <td>
                      <Badge tone="ok">{statusLabel(t.status)}</Badge>
                    </td>
                    <td className="mono">{t.receipt_code}</td>
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
