import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { BoldCheckoutButton } from '@/components/payments/BoldCheckoutButton'
import type { BoldCheckoutData } from '@/lib/bold'
import { formatCOP, formatDate, statusLabel } from '@/lib/format'
import { getBoldPublicConfig, prepareBoldCheckout } from '@/services/bold'
import { listAccounts, listBillPayments, listProviders, payBill } from '@/services/fincomer'
import type { Account, BillPayment, ServiceProvider } from '@/types'
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

type PayMethod = 'account' | 'bold'

export function PaymentsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [providers, setProviders] = useState<ServiceProvider[]>([])
  const [payments, setPayments] = useState<BillPayment[]>([])
  const [accountId, setAccountId] = useState('')
  const [providerId, setProviderId] = useState('')
  const [reference, setReference] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PayMethod>('account')
  const [checkout, setCheckout] = useState<BoldCheckoutData | null>(null)
  const [boldReady, setBoldReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  async function reload() {
    if (!user) return
    const [a, p, b, cfg] = await Promise.all([
      listAccounts(user.id),
      listProviders(),
      listBillPayments(user.id),
      getBoldPublicConfig().catch(() => ({ configured: false, scriptUrl: '', apiKey: null })),
    ])
    setAccounts(a)
    setProviders(p)
    setPayments(b)
    setBoldReady(Boolean(cfg.configured))
    if (!accountId && a[0]) setAccountId(a[0].id)
    if (!providerId && p[0]) setProviderId(p[0].id)
  }

  useEffect(() => {
    void reload().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setOk(null)
    setCheckout(null)
    try {
      if (method === 'account') {
        const pay = await payBill({
          accountId,
          providerId,
          billReference: reference,
          amount: Number(amount),
        })
        setOk(`Pago exitoso desde tu cuenta. Comprobante: ${pay.receipt_code}`)
        setReference('')
        setAmount('')
        await reload()
      } else {
        const result = await prepareBoldCheckout({
          accountId,
          amount: Number(amount),
          description: `Pago servicio ref ${reference}`,
          purpose: 'bill',
          purposeMeta: { provider_id: providerId, bill_reference: reference },
          redirectionUrl: `${window.location.origin}/pse/resultado`,
        })
        setCheckout(result.boldCheckoutData)
        setOk(`Orden Bold ${result.boldCheckoutData.orderId} lista. Completa el pago abajo.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo pagar')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingBlock />

  return (
    <div className="stack">
      <PageHeader
        eyebrow="RF-21 · RF-22 · RF-24 · Bold"
        title="Pago de servicios"
        description="Paga servicios y obligaciones con saldo Fincomer o con Bold (tarjeta/PSE)."
      />

      <div className="grid-2">
        <Panel title="Nuevo pago">
          <form className="form-stack" onSubmit={(e) => void onSubmit(e)}>
            <Field label="Medio de pago">
              <Select
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value as PayMethod)
                  setCheckout(null)
                }}
              >
                <option value="account">Debitar cuenta Fincomer</option>
                <option value="bold" disabled={!boldReady}>
                  Bold (tarjeta / PSE){!boldReady ? ' — no configurado' : ''}
                </option>
              </Select>
            </Field>
            <Field label="Cuenta asociada">
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} required>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.account_number} — {formatCOP(a.balance)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Proveedor">
              <Select value={providerId} onChange={(e) => setProviderId(e.target.value)} required>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Referencia / número de factura">
              <Input required value={reference} onChange={(e) => setReference(e.target.value)} />
            </Field>
            <Field label="Valor">
              <Input
                type="number"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            {ok ? <Alert tone="ok">{ok}</Alert> : null}
            <Button type="submit" disabled={busy}>
              {busy
                ? 'Procesando…'
                : method === 'bold'
                  ? 'Preparar pago Bold'
                  : 'Pagar ahora'}
            </Button>
            {method === 'bold' ? (
              <button type="button" className="btn btn--ghost" onClick={() => navigate('/pse')}>
                Ir a pasarela completa
              </button>
            ) : null}
          </form>

          {checkout ? (
            <div style={{ marginTop: '1rem' }}>
              <BoldCheckoutButton checkout={checkout} />
            </div>
          ) : null}
        </Panel>

        <Panel title="Historial de pagos">
          {payments.length === 0 ? (
            <EmptyState title="Sin pagos registrados" />
          ) : (
            <ul className="list">
              {payments.map((p) => (
                <li key={p.id} className="list__row">
                  <div>
                    <strong>{formatCOP(p.amount)}</strong>
                    <p className="muted">
                      Ref {p.bill_reference} · {formatDate(p.created_at)}
                    </p>
                  </div>
                  <div className="list__right">
                    <Badge tone="ok">{statusLabel(p.status)}</Badge>
                    <span className="mono">{p.receipt_code}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
