import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { BoldCheckoutButton } from '@/components/payments/BoldCheckoutButton'
import { formatCOP, formatDate, statusLabel } from '@/lib/format'
import type { BoldCheckoutData } from '@/lib/bold'
import {
  getBoldPublicConfig,
  prepareBoldCheckout,
  type BoldPurpose,
} from '@/services/bold'
import { listAccounts, listGatewayTransactions, listInstallments, listCredits, listProviders } from '@/services/fincomer'
import type { Account, Credit, CreditInstallment, GatewayTransaction, ServiceProvider } from '@/types'
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

export function PsePage() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [providers, setProviders] = useState<ServiceProvider[]>([])
  const [credits, setCredits] = useState<Credit[]>([])
  const [installments, setInstallments] = useState<CreditInstallment[]>([])
  const [txs, setTxs] = useState<GatewayTransaction[]>([])
  const [configured, setConfigured] = useState(false)
  const [scriptUrl, setScriptUrl] = useState('https://checkout.bold.co/library/boldPaymentButton.js')

  const [purpose, setPurpose] = useState<BoldPurpose>('topup')
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('Recarga cuenta Fincomer')
  const [providerId, setProviderId] = useState('')
  const [billRef, setBillRef] = useState('')
  const [installmentId, setInstallmentId] = useState('')

  const [checkout, setCheckout] = useState<BoldCheckoutData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  async function reload() {
    if (!user) return
    const [a, t, cfg, p, c] = await Promise.all([
      listAccounts(user.id),
      listGatewayTransactions(user.id),
      getBoldPublicConfig(),
      listProviders(),
      listCredits(user.id),
    ])
    setAccounts(a)
    setTxs(t)
    setConfigured(Boolean(cfg.configured))
    if (cfg.scriptUrl) setScriptUrl(cfg.scriptUrl)
    setProviders(p)
    setCredits(c)
    if (!accountId && a[0]) setAccountId(a[0].id)
    if (!providerId && p[0]) setProviderId(p[0].id)

    const pending = c.filter((x) => x.status === 'active')
    if (pending[0]) {
      const rows = await listInstallments(pending[0].id)
      const open = rows.filter((r) => r.status !== 'paid')
      setInstallments(open)
      if (!installmentId && open[0]) setInstallmentId(open[0].id)
    } else {
      setInstallments([])
    }
  }

  useEffect(() => {
    void reload().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (purpose === 'topup') setDescription('Recarga cuenta Fincomer')
    if (purpose === 'bill') setDescription('Pago de servicio vía Bold')
    if (purpose === 'installment') setDescription('Pago de cuota de crédito vía Bold')
  }, [purpose])

  async function onPrepare(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setOk(null)
    setCheckout(null)
    try {
      const meta: Record<string, unknown> = {}
      let payAmount = Number(amount)

      if (purpose === 'bill') {
        meta.provider_id = providerId
        meta.bill_reference = billRef
      }
      if (purpose === 'installment') {
        const inst = installments.find((i) => i.id === installmentId)
        if (!inst) throw new Error('Selecciona una cuota pendiente')
        meta.installment_id = installmentId
        payAmount = Number(inst.total_amount)
      }

      const result = await prepareBoldCheckout({
        accountId,
        amount: payAmount,
        description,
        purpose,
        purposeMeta: meta,
        redirectionUrl: `${window.location.origin}/pse/resultado`,
      })
      setCheckout(result.boldCheckoutData)
      setOk(`Orden ${result.boldCheckoutData.orderId} lista. Completa el pago en Bold.`)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo preparar el pago Bold')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingBlock />

  return (
    <div className="stack">
      <PageHeader
        eyebrow="RF-29 · RF-30 · RF-31 · RF-32 · RF-33 · RF-34"
        title="Pasarela Bold / PSE"
        description="Paga recargas, facturas y cuotas de crédito con Bold Checkout. Al aprobarse se concilia en Fincomer."
      />

      {!configured ? (
        <Alert tone="danger">
          Bold no está configurado. En Supabase SQL Editor ejecuta{' '}
          <code>supabase/bold.sql</code> y luego:{' '}
          <code>
            update private.bold_credentials set api_key=&apos;…&apos;, secret_key=&apos;…&apos;
            where id=true;
          </code>
        </Alert>
      ) : null}

      <div className="grid-2">
        <Panel title="Iniciar pago Bold">
          <form className="form-stack" onSubmit={(e) => void onPrepare(e)}>
            <Field label="Tipo de pago">
              <Select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as BoldPurpose)}
              >
                <option value="topup">Recarga de cuenta (top-up)</option>
                <option value="bill">Pago de servicio / obligación</option>
                <option value="installment">Cuota de crédito (RF-29)</option>
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

            {purpose === 'bill' ? (
              <>
                <Field label="Proveedor">
                  <Select value={providerId} onChange={(e) => setProviderId(e.target.value)} required>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Referencia / factura">
                  <Input required value={billRef} onChange={(e) => setBillRef(e.target.value)} />
                </Field>
              </>
            ) : null}

            {purpose === 'installment' ? (
              <Field label="Cuota pendiente">
                {installments.length === 0 ? (
                  <p className="muted">No hay cuotas pendientes (crédito desembolsado requerido).</p>
                ) : (
                  <Select
                    value={installmentId}
                    onChange={(e) => setInstallmentId(e.target.value)}
                    required
                  >
                    {installments.map((i) => (
                      <option key={i.id} value={i.id}>
                        #{i.installment_number} · {formatCOP(i.total_amount)} · vence {i.due_date}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : (
              <Field label="Monto (COP)">
                <Input
                  type="number"
                  min="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
            )}

            <Field label="Descripción">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>

            {error ? <Alert tone="danger">{error}</Alert> : null}
            {ok ? <Alert tone="ok">{ok}</Alert> : null}

            <Button type="submit" disabled={busy || !configured || (purpose === 'installment' && !installmentId)}>
              {busy ? 'Preparando…' : 'Preparar pago Bold'}
            </Button>
          </form>
        </Panel>

        <Panel title="Checkout Bold">
          {!checkout ? (
            <EmptyState
              title="Sin checkout activo"
              description="Prepara un pago para mostrar el botón oficial de Bold."
            />
          ) : (
            <>
              <dl className="meta-list">
                <div>
                  <dt>Orden</dt>
                  <dd className="mono">{checkout.orderId}</dd>
                </div>
                <div>
                  <dt>Monto</dt>
                  <dd>{formatCOP(checkout.amount)}</dd>
                </div>
              </dl>
              <BoldCheckoutButton checkout={checkout} scriptUrl={scriptUrl} />
            </>
          )}
        </Panel>
      </div>

      <Panel title="Flujo Bold (como Buscaninos, adaptado a Supabase)">
        <ol className="roadmap">
          <li>prepare_bold_checkout → orderId + firma SHA-256 (secret en servidor).</li>
          <li>Botón Bold Checkout (tarjeta / PSE) → redirección a /pse/resultado.</li>
          <li>complete_bold_payment o webhook → estado approved/rejected.</li>
          <li>Conciliación: recarga saldo, registra factura o marca cuota pagada.</li>
          <li>Rechazos / voided → notificación sin mover dinero (RF-34).</li>
        </ol>
        {credits.length > 0 ? (
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Créditos activos: {credits.filter((c) => c.status === 'active').length}. También puedes
            pagar cuotas desde <strong>Créditos</strong> con saldo Fincomer.
          </p>
        ) : null}
      </Panel>

      <Panel title="Transacciones de pasarela">
        {txs.length === 0 ? (
          <EmptyState title="Sin transacciones" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Referencia</th>
                  <th>Propósito</th>
                  <th>Monto</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t) => (
                  <tr key={t.id}>
                    <td>{formatDate(t.created_at)}</td>
                    <td className="mono">{t.reference_code}</td>
                    <td>{t.purpose ?? '—'}</td>
                    <td>{formatCOP(t.amount)}</td>
                    <td>
                      <Badge tone={t.status === 'approved' ? 'ok' : t.status === 'rejected' ? 'danger' : 'info'}>
                        {statusLabel(t.status)}
                      </Badge>
                    </td>
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
