import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { BoldCheckoutButton } from '@/components/payments/BoldCheckoutButton'
import type { BoldCheckoutData } from '@/lib/bold'
import { formatCOP, formatDate, statusLabel } from '@/lib/format'
import { getBoldPublicConfig, payCreditInstallment, prepareBoldCheckout } from '@/services/bold'
import {
  applyCredit,
  listAccounts,
  listCreditApplications,
  listCreditProducts,
  listCredits,
  listInstallments,
  simulateCredit,
} from '@/services/fincomer'
import type {
  Account,
  Credit,
  CreditApplication,
  CreditInstallment,
  CreditProduct,
  CreditSimulation,
} from '@/types'
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
  Textarea,
} from '@/components/ui'

export function CreditsPage() {
  const { user } = useAuth()
  const [products, setProducts] = useState<CreditProduct[]>([])
  const [apps, setApps] = useState<CreditApplication[]>([])
  const [credits, setCredits] = useState<Credit[]>([])
  const [installments, setInstallments] = useState<CreditInstallment[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState('')
  const [selectedCreditId, setSelectedCreditId] = useState('')
  const [productId, setProductId] = useState('')
  const [amount, setAmount] = useState('5000000')
  const [term, setTerm] = useState('24')
  const [purpose, setPurpose] = useState('')
  const [simulation, setSimulation] = useState<CreditSimulation | null>(null)
  const [checkout, setCheckout] = useState<BoldCheckoutData | null>(null)
  const [boldReady, setBoldReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  async function reload(creditId?: string) {
    if (!user) return
    const [p, a, c, acc, cfg] = await Promise.all([
      listCreditProducts(),
      listCreditApplications(user.id),
      listCredits(user.id),
      listAccounts(user.id),
      getBoldPublicConfig().catch(() => ({ configured: false, scriptUrl: '', apiKey: null })),
    ])
    setProducts(p)
    setApps(a)
    setCredits(c)
    setAccounts(acc)
    setBoldReady(Boolean(cfg.configured))
    if (!productId && p[0]) setProductId(p[0].id)
    if (!accountId && acc[0]) setAccountId(acc[0].id)

    const target = creditId || selectedCreditId || c.find((x) => x.status === 'active')?.id || c[0]?.id
    if (target) {
      setSelectedCreditId(target)
      setInstallments(await listInstallments(target))
    } else {
      setInstallments([])
    }
  }

  useEffect(() => {
    void reload().finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function onSimulate(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const sim = await simulateCredit(productId, Number(amount), Number(term))
      setSimulation(sim)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo simular')
    } finally {
      setBusy(false)
    }
  }

  async function onApply() {
    if (!user || !simulation) return
    setBusy(true)
    setError(null)
    try {
      await applyCredit({
        userId: user.id,
        productId,
        amount: Number(amount),
        termMonths: Number(term),
        monthlyPayment: simulation.monthly_payment,
        purpose,
      })
      setOk('Solicitud radicada. Puedes hacer seguimiento en esta misma pantalla.')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo radicar')
    } finally {
      setBusy(false)
    }
  }

  async function onPayFromAccount(installmentId: string) {
    setBusy(true)
    setError(null)
    setOk(null)
    setCheckout(null)
    try {
      const paid = await payCreditInstallment(accountId, installmentId)
      setOk(`Cuota #${paid.installment_number} pagada desde tu cuenta Fincomer.`)
      await reload(selectedCreditId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo pagar la cuota')
    } finally {
      setBusy(false)
    }
  }

  async function onPayWithBold(inst: CreditInstallment) {
    setBusy(true)
    setError(null)
    setOk(null)
    setCheckout(null)
    try {
      const result = await prepareBoldCheckout({
        accountId,
        amount: Number(inst.total_amount),
        description: `Cuota #${inst.installment_number} crédito Fincomer`,
        purpose: 'installment',
        purposeMeta: { installment_id: inst.id },
        redirectionUrl: `${window.location.origin}/pse/resultado`,
      })
      setCheckout(result.boldCheckoutData)
      setOk(`Orden Bold ${result.boldCheckoutData.orderId} lista para la cuota #${inst.installment_number}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo preparar Bold')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <LoadingBlock />

  return (
    <div className="stack">
      <PageHeader
        eyebrow="RF-25 · RF-26 · RF-27 · RF-28 · RF-29"
        title="Créditos"
        description="Simula, solicita, sigue el estado y paga cuotas (saldo Fincomer o Bold)."
      />

      <div className="grid-2">
        <Panel title="Simulador">
          <form className="form-stack" onSubmit={(e) => void onSimulate(e)}>
            <Field label="Producto">
              <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({(p.annual_rate * 100).toFixed(2)}% E.A.)
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Monto">
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Plazo (meses)">
              <Input type="number" value={term} onChange={(e) => setTerm(e.target.value)} />
            </Field>
            <Field label="Destino / propósito">
              <Textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3} />
            </Field>
            {error ? <Alert tone="danger">{error}</Alert> : null}
            {ok ? <Alert tone="ok">{ok}</Alert> : null}
            <Button type="submit" disabled={busy}>
              Simular
            </Button>
          </form>
        </Panel>

        <Panel title="Resultado de simulación">
          {!simulation ? (
            <EmptyState title="Ejecuta una simulación" description="Verás cuota, intereses y total." />
          ) : (
            <dl className="meta-list">
              <div>
                <dt>Producto</dt>
                <dd>{simulation.product_name}</dd>
              </div>
              <div>
                <dt>Cuota mensual</dt>
                <dd>{formatCOP(simulation.monthly_payment)}</dd>
              </div>
              <div>
                <dt>Total a pagar</dt>
                <dd>{formatCOP(simulation.total_payment)}</dd>
              </div>
              <div>
                <dt>Intereses</dt>
                <dd>{formatCOP(simulation.total_interest)}</dd>
              </div>
            </dl>
          )}
          {simulation ? (
            <Button onClick={() => void onApply()} disabled={busy} style={{ marginTop: '1rem' }}>
              Solicitar crédito
            </Button>
          ) : null}
        </Panel>
      </div>

      <Panel title="Seguimiento de solicitudes">
        {apps.length === 0 ? (
          <EmptyState title="Sin solicitudes" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Plazo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id}>
                    <td>{formatDate(a.created_at)}</td>
                    <td>{formatCOP(a.requested_amount)}</td>
                    <td>{a.term_months} meses</td>
                    <td>
                      <Badge tone="info">{statusLabel(a.status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Plan de pagos (RF-28 / RF-29)">
        {credits.length === 0 ? (
          <EmptyState
            title="Sin créditos activos"
            description="Cuando una solicitud sea desembolsada verás la tabla de amortización."
          />
        ) : (
          <>
            <div className="form-row">
              <Field label="Crédito">
                <Select
                  value={selectedCreditId}
                  onChange={(e) => {
                    const id = e.target.value
                    setSelectedCreditId(id)
                    void listInstallments(id).then(setInstallments)
                  }}
                >
                  {credits.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatCOP(c.principal)} · saldo {formatCOP(c.outstanding_balance)} (
                      {statusLabel(c.status)})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Cuenta para pagar">
                <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.account_number} — {formatCOP(a.balance)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {checkout ? (
              <div style={{ marginBottom: '1rem' }}>
                <BoldCheckoutButton checkout={checkout} />
              </div>
            ) : null}

            {installments.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Vence</th>
                      <th>Capital</th>
                      <th>Interés</th>
                      <th>Total</th>
                      <th>Estado</th>
                      <th>Pagar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {installments.map((i) => (
                      <tr key={i.id}>
                        <td>{i.installment_number}</td>
                        <td>{i.due_date}</td>
                        <td>{formatCOP(i.principal_amount)}</td>
                        <td>{formatCOP(i.interest_amount)}</td>
                        <td>{formatCOP(i.total_amount)}</td>
                        <td>{statusLabel(i.status)}</td>
                        <td>
                          {i.status === 'paid' ? (
                            '—'
                          ) : (
                            <div className="row-gap">
                              <button
                                type="button"
                                className="btn btn--soft"
                                disabled={busy}
                                onClick={() => void onPayFromAccount(i.id)}
                              >
                                Cuenta
                              </button>
                              <button
                                type="button"
                                className="btn btn--primary"
                                disabled={busy || !boldReady}
                                onClick={() => void onPayWithBold(i)}
                                title={!boldReady ? 'Configura Bold primero' : 'Pagar con Bold'}
                              >
                                Bold
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Sin cuotas" description="Este crédito aún no tiene plan de pagos." />
            )}
          </>
        )}
      </Panel>
    </div>
  )
}
