import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { formatCOP, formatDate, statusLabel } from '@/lib/format'
import {
  executeTransfer,
  listAccounts,
  listRecipients,
  listTransferDirectory,
  listTransfers,
  saveRecipient,
  type TransferDirectoryItem,
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
  const [directory, setDirectory] = useState<TransferDirectoryItem[]>([])
  const [fromAccountId, setFromAccountId] = useState('')
  const [toAccountNumber, setToAccountNumber] = useState('')
  const [amount, setAmount] = useState('50000')
  const [description, setDescription] = useState('Transferencia demo Fincomer')
  const [kind, setKind] = useState<'own' | 'internal'>('internal')
  const [alias, setAlias] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const destinationOptions = useMemo(() => {
    if (kind === 'own') {
      return directory.filter((d) => d.is_own && d.account_number !== accounts.find((a) => a.id === fromAccountId)?.account_number)
    }
    return directory.filter((d) => !d.is_own)
  }, [directory, kind, fromAccountId, accounts])

  async function reload() {
    if (!user) return
    const [a, t, r, d] = await Promise.all([
      listAccounts(user.id),
      listTransfers(user.id),
      listRecipients(user.id),
      listTransferDirectory(),
    ])
    setAccounts(a)
    setTransfers(t)
    setRecipients(r)
    setDirectory(d)
    if (!fromAccountId && a[0]) setFromAccountId(a[0].id)
    const opts =
      kind === 'own'
        ? d.filter((x) => x.is_own)
        : d.filter((x) => !x.is_own)
    if ((!toAccountNumber || !opts.some((o) => o.account_number === toAccountNumber)) && opts[0]) {
      setToAccountNumber(opts[0].account_number)
    }
  }

  useEffect(() => {
    void reload().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    const opts = destinationOptions
    if (opts[0] && !opts.some((o) => o.account_number === toAccountNumber)) {
      setToAccountNumber(opts[0].account_number)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, destinationOptions.length])

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
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en la transferencia')
    } finally {
      setBusy(false)
    }
  }

  async function onSaveRecipient(e: FormEvent) {
    e.preventDefault()
    if (!user || !toAccountNumber) return
    try {
      const dest = directory.find((d) => d.account_number === toAccountNumber)
      await saveRecipient({
        ownerId: user.id,
        alias: alias || dest?.owner_name || toAccountNumber,
        accountNumber: toAccountNumber,
      })
      setAlias('')
      setMessage('Destinatario guardado')
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
        description="Elige origen, destino y monto. Las cuentas demo ya están en la lista."
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
                    {a.product_name} · {a.account_number} — {formatCOP(a.balance)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo">
              <Select value={kind} onChange={(e) => setKind(e.target.value as 'own' | 'internal')}>
                <option value="own">Entre mis cuentas</option>
                <option value="internal">A otro asociado Fincomer</option>
              </Select>
            </Field>
            <Field
              label="Cuenta destino"
              hint={
                kind === 'own'
                  ? 'Selecciona otra de tus cuentas'
                  : 'Selecciona un asociado de la lista demo'
              }
            >
              <Select
                required
                value={toAccountNumber}
                onChange={(e) => setToAccountNumber(e.target.value)}
              >
                {destinationOptions.length === 0 ? (
                  <option value="">Sin destinos disponibles</option>
                ) : (
                  destinationOptions.map((d) => (
                    <option key={d.account_number} value={d.account_number}>
                      {d.owner_name} · {d.account_type} · {d.account_number}
                    </option>
                  ))
                )}
              </Select>
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
            <Button type="submit" disabled={busy || !toAccountNumber}>
              {busy ? 'Procesando…' : 'Transferir'}
            </Button>
          </form>
        </Panel>

        <Panel title="Destinatarios frecuentes">
          <form className="form-stack" onSubmit={(e) => void onSaveRecipient(e)}>
            <Field label="Alias (opcional)">
              <Input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Ej. Mamá" />
            </Field>
            <p className="muted" style={{ fontSize: '0.72rem' }}>
              Se guardará la cuenta destino seleccionada arriba.
            </p>
            <Button type="submit" variant="soft">
              Guardar destinatario actual
            </Button>
          </form>
          <ul className="list" style={{ marginTop: '1rem' }}>
            {recipients.length === 0 ? (
              <EmptyState title="Aún no hay favoritos" />
            ) : (
              recipients.map((r) => (
                <li key={r.id} className="list__row">
                  <div>
                    <strong>{r.alias}</strong>
                    <p className="muted mono">{r.account_number}</p>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setKind('internal')
                      setToAccountNumber(r.account_number)
                    }}
                  >
                    Usar
                  </Button>
                </li>
              ))
            )}
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
