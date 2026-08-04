import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CreditCard,
  Eye,
  HandCoins,
  Landmark,
  ReceiptText,
  Send,
  WalletCards,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { formatCOP, formatDate } from '@/lib/format'
import {
  listAccounts,
  listAnnouncements,
  listTransfers,
} from '@/services/fincomer'
import type { Account, Announcement, Transfer } from '@/types'
import { Badge, LoadingBlock, Panel } from '@/components/ui'

export function DashboardPage() {
  const { profile, user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [news, setNews] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    void (async () => {
      try {
        const [a, t, an] = await Promise.all([
          listAccounts(user.id),
          listTransfers(user.id),
          listAnnouncements(),
        ])
        setAccounts(a)
        setTransfers(t.slice(0, 5))
        setNews(an)
      } finally {
        setLoading(false)
      }
    })()
  }, [user])

  const total = accounts.reduce((sum, a) => sum + Number(a.balance), 0)

  if (loading) return <LoadingBlock label="Cargando panel del asociado…" />

  return (
    <div className="stack dashboard">
      <section className="welcome">
        <div className="welcome__copy">
          <p className="welcome__eyebrow">Resumen de productos</p>
          <h1>Hola, {profile?.full_name?.split(' ')[0] ?? 'asociado'}</h1>
          <p>Consulta tu saldo y realiza operaciones frecuentes.</p>
        </div>
      </section>

      {/* Patrón banca: saldo → acciones → productos → movimientos */}
      <section className="balance-card" aria-label="Saldo consolidado">
        <div className="balance-card__header">
          <div>
            <p>Saldo total disponible</p>
            <h2>{formatCOP(total)}</h2>
          </div>
          <span className="balance-card__icon" aria-hidden>
            <Landmark size={25} />
          </span>
        </div>
        <div className="balance-card__footer">
          <span>
            <Eye size={16} />
            {accounts.length} producto(s)
          </span>
          <Link to="/cuentas">
            Ver productos <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <section aria-label="Operaciones frecuentes">
        <div className="section-title">
          <h2>Operaciones frecuentes</h2>
        </div>
        <div className="quick-grid quick-grid--dashboard">
          <Link to="/transferencias" className="quick">
            <span className="quick__icon">
              <Send size={20} />
            </span>
            <span>
              <strong>Transferir</strong>
              <small>Entre cuentas Fincomer</small>
            </span>
          </Link>
          <Link to="/pagos" className="quick">
            <span className="quick__icon">
              <ReceiptText size={20} />
            </span>
            <span>
              <strong>Pagar</strong>
              <small>Servicios y obligaciones</small>
            </span>
          </Link>
          <Link to="/creditos" className="quick">
            <span className="quick__icon">
              <HandCoins size={20} />
            </span>
            <span>
              <strong>Créditos</strong>
              <small>Simular y solicitar</small>
            </span>
          </Link>
          <Link to="/pse" className="quick">
            <span className="quick__icon">
              <CreditCard size={20} />
            </span>
            <span>
              <strong>PSE / Bold</strong>
              <small>Pagos interbancarios</small>
            </span>
          </Link>
        </div>
      </section>

      <div className="grid-2">
        <Panel title="Mis productos">
          <ul className="list">
            {accounts.map((account) => (
              <li key={account.id} className="product-row">
                <span className="product-row__icon" aria-hidden>
                  <WalletCards size={20} />
                </span>
                <div className="product-row__copy">
                  <strong>{account.product_name}</strong>
                  <p className="muted mono">{account.account_number}</p>
                </div>
                <div className="list__right">
                  <strong>{formatCOP(account.balance)}</strong>
                  <Badge tone="ok">Activa</Badge>
                </div>
              </li>
            ))}
          </ul>
          <Link className="text-link" to="/cuentas">
            Ver movimientos
          </Link>
        </Panel>

        <Panel title="Actividad reciente">
          {transfers.length === 0 ? (
            <p className="muted">Aún no hay transferencias.</p>
          ) : (
            <ul className="list">
              {transfers.map((t) => (
                <li key={t.id} className="activity-row">
                  <span className="activity-row__icon" aria-hidden>
                    {t.transfer_kind === 'own' ? (
                      <ArrowDownLeft size={18} />
                    ) : (
                      <ArrowUpRight size={18} />
                    )}
                  </span>
                  <div className="activity-row__copy">
                    <strong>{formatCOP(t.amount)}</strong>
                    <p className="muted">{t.description ?? t.transfer_kind}</p>
                  </div>
                  <span className="muted">{formatDate(t.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {news.length > 0 ? (
        <Panel title="Avisos">
          <ul className="list">
            {news.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <p className="muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  )
}
