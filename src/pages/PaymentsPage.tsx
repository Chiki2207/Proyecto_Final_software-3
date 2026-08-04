import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { BoldCheckoutButton } from '@/components/payments/BoldCheckoutButton'
import type { BoldCheckoutData } from '@/lib/bold'
import { formatCOP, formatDate, statusLabel } from '@/lib/format'
import { getBoldPublicConfig, prepareBoldCheckout } from '@/services/bold'
import {
  listAccounts,
  listBillPayments,
  listDemoInvoices,
  payBill,
  type DemoInvoice,
} from '@/services/fincomer'
import type { Account, BillPayment } from '@/types'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
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
  const [invoices, setInvoices] = useState<DemoInvoice[]>([])
  const [payments, setPayments] = useState<BillPayment[]>([])
  const [accountId, setAccountId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [method, setMethod] = useState<PayMethod>('account')
  const [checkout, setCheckout] = useState<BoldCheckoutData | null>(null)
  const [boldReady, setBoldReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const selected = useMemo(
    () => invoices.find((i) => i.id === invoiceId) ?? null,
    [invoices, invoiceId],
  )

  async function reload() {
    if (!user) return
    const [a, inv, b, cfg] = await Promise.all([
      listAccounts(user.id),
      listDemoInvoices(),
      listBillPayments(user.id),
      getBoldPublicConfig().catch(() => ({ configured: false, scriptUrl: '', apiKey: null })),
    ])
    setAccounts(a)
    setInvoices(inv)
    setPayments(b)
    setBoldReady(Boolean(cfg.configured))
    if (!accountId && a[0]) setAccountId(a[0].id)
    if ((!invoiceId || !inv.some((i) => i.id === invoiceId)) && inv[0]) {
      setInvoiceId(inv[0].id)
    }
  }

  useEffect(() => {
    void reload().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!selected) {
      setError('Selecciona una factura de la lista')
      return
    }
    setBusy(true)
    setError(null)
    setOk(null)
    setCheckout(null)
    try {
      if (method === 'account') {
        const pay = await payBill({
          accountId,
          providerId: selected.provider_id,
          billReference: selected.bill_reference,
          amount: Number(selected.amount),
        })
        setOk(`Pago exitoso. Comprobante: ${pay.receipt_code}`)
        await reload()
      } else {
        const result = await prepareBoldCheckout({
          accountId,
          amount: Number(selected.amount),
          description: `Pago ${selected.provider_name} ${selected.bill_reference}`,
          purpose: 'bill',
          purposeMeta: {
            provider_id: selected.provider_id,
            bill_reference: selected.bill_reference,
          },
          redirectionUrl: `${window.location.origin}/pse/resultado`,
        })
        setCheckout(result.boldCheckoutData)
        setOk(`Orden Bold lista. Completa el pago abajo.`)
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
        description="Elige una factura demo de la lista y págalo con tu cuenta o Bold."
      />

      <div className="grid-2">
        <Panel title="Pagar factura">
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
            <Field label="Factura pendiente" hint="Referencias demo listas para seleccionar">
              <Select
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                required
              >
                {invoices.length === 0 ? (
                  <option value="">No hay facturas pendientes</option>
                ) : (
                  invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.provider_name} · {inv.bill_reference} · {formatCOP(inv.amount)}
                    </option>
                  ))
                )}
              </Select>
            </Field>

            {selected ? (
              <dl className="meta-list">
                <div>
                  <dt>Proveedor</dt>
                  <dd>{selected.provider_name}</dd>
                </div>
                <div>
                  <dt>Referencia</dt>
                  <dd className="mono">{selected.bill_reference}</dd>
                </div>
                <div>
                  <dt>Valor</dt>
                  <dd>{formatCOP(selected.amount)}</dd>
                </div>
                <div>
                  <dt>Vence</dt>
                  <dd>{selected.due_date}</dd>
                </div>
                <div>
                  <dt>Detalle</dt>
                  <dd>{selected.description}</dd>
                </div>
              </dl>
            ) : null}

            {error ? <Alert tone="danger">{error}</Alert> : null}
            {ok ? <Alert tone="ok">{ok}</Alert> : null}
            <Button type="submit" disabled={busy || !selected}>
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
