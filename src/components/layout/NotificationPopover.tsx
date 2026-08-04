import { useEffect, useRef, useState } from 'react'
import { Bell, CheckCheck, ShieldAlert, Info, Sparkles, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/format'
import { listNotifications, markNotificationRead } from '@/services/fincomer'
import type { AppNotification } from '@/types'

function categoryIcon(category: string) {
  if (category === 'security') return ShieldAlert
  if (category === 'credit') return Sparkles
  return Info
}

export function NotificationPopover() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const unread = items.filter((n) => !n.read_at).length

  async function reload() {
    if (!user) return
    setLoading(true)
    try {
      setItems(await listNotifications(user.id))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('mousedown', onDocClick)
      document.addEventListener('keydown', onKey)
    }
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next) await reload()
  }

  async function markOne(id: string) {
    await markNotificationRead(id)
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
    )
  }

  async function markAll() {
    const pending = items.filter((n) => !n.read_at)
    await Promise.all(pending.map((n) => markNotificationRead(n.id)))
    const now = new Date().toISOString()
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })))
  }

  return (
    <div className="notif" ref={rootRef}>
      <button
        type="button"
        className={`topbar__icon${open ? ' topbar__icon--active' : ''}`}
        aria-label="Alertas"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => void toggle()}
      >
        <Bell size={19} />
        {unread > 0 ? <span className="notif__badge">{unread > 9 ? '9+' : unread}</span> : null}
      </button>

      {open ? (
        <div className="notif__panel" role="dialog" aria-label="Centro de alertas">
          <header className="notif__head">
            <div>
              <strong>Alertas</strong>
              <p>{unread > 0 ? `${unread} sin leer` : 'Todo al día'}</p>
            </div>
            <div className="notif__head-actions">
              {unread > 0 ? (
                <button type="button" className="notif__text-btn" onClick={() => void markAll()}>
                  <CheckCheck size={15} />
                  Leer todas
                </button>
              ) : null}
              <button
                type="button"
                className="notif__close"
                aria-label="Cerrar"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
          </header>

          <div className="notif__body">
            {loading ? (
              <p className="notif__empty">Cargando…</p>
            ) : items.length === 0 ? (
              <div className="notif__empty">
                <Bell size={22} strokeWidth={1.6} />
                <p>No tienes alertas por ahora</p>
              </div>
            ) : (
              <ul className="notif__list">
                {items.map((n) => {
                  const Icon = categoryIcon(n.category)
                  const unreadItem = !n.read_at
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={`notif__item${unreadItem ? ' notif__item--unread' : ''}`}
                        onClick={() => void markOne(n.id)}
                      >
                        <span className={`notif__icon notif__icon--${n.category}`} aria-hidden>
                          <Icon size={16} />
                        </span>
                        <span className="notif__copy">
                          <strong>{n.title}</strong>
                          <span>{n.body}</span>
                          <time>{formatDate(n.created_at)}</time>
                        </span>
                        {unreadItem ? <span className="notif__dot" aria-hidden /> : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
