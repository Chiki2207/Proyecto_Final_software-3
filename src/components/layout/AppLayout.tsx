import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileSearch,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  ReceiptText,
  Send,
  ShieldCheck,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { NotificationPopover } from '@/components/layout/NotificationPopover'

const navItems = [
  { to: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { to: '/cuentas', label: 'Mis productos', icon: WalletCards },
  { to: '/transferencias', label: 'Transferencias', icon: Send },
  { to: '/pagos', label: 'Pagos', icon: ReceiptText },
  { to: '/creditos', label: 'Créditos', icon: HandCoins },
  { to: '/pse', label: 'PSE / Bold', icon: CreditCard },
  { to: '/perfil', label: 'Mi perfil', icon: UserRound },
  { to: '/seguridad', label: 'Seguridad', icon: ShieldCheck },
]

export function AppLayout() {
  const { profile, signOut, isStaff, isAdmin } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const initials = profile?.full_name
    ?.split(' ')
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() ?? 'FC'

  return (
    <div className="shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        <div className="sidebar__brand">
          <div className="brand-mark" aria-hidden>
            <img src="/fincomer-emblem.png" alt="" className="fincomer-emblem" />
          </div>
          <div className="brand-copy">
            <strong>Fincomer</strong>
            <small>Banca digital</small>
          </div>
          <button
            type="button"
            className="sidebar__close"
            aria-label="Cerrar menú"
            onClick={() => setMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="sidebar__nav" aria-label="Principal">
          <p className="sidebar__section">Mi banca</p>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => (isActive ? 'side-link active' : 'side-link')}
            >
              <item.icon size={19} strokeWidth={1.8} aria-hidden />
              <span>{item.label}</span>
              <ChevronRight className="side-link__arrow" size={15} aria-hidden />
            </NavLink>
          ))}
          {isStaff ? (
            <>
              <p className="sidebar__section sidebar__section--staff">Gestión interna</p>
              <NavLink
                to="/admin"
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) => (isActive ? 'side-link active' : 'side-link')}
              >
                <UsersRound size={19} strokeWidth={1.8} aria-hidden />
                <span>Administración</span>
                <ChevronRight className="side-link__arrow" size={15} aria-hidden />
              </NavLink>
            </>
          ) : null}
          {isAdmin || isStaff ? (
            <NavLink
              to="/auditoria"
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => (isActive ? 'side-link active' : 'side-link')}
            >
              <FileSearch size={19} strokeWidth={1.8} aria-hidden />
              <span>Auditoría</span>
              <ChevronRight className="side-link__arrow" size={15} aria-hidden />
            </NavLink>
          ) : null}
        </nav>

        <div className="sidebar__foot">
          <div className="sidebar__identity">
            <span className="avatar">{initials}</span>
            <div>
              <p className="sidebar__user">{profile?.full_name ?? 'Asociado'}</p>
              <p className="sidebar__meta">{profile?.email}</p>
            </div>
          </div>
          <button type="button" className="logout-button" onClick={() => void signOut()}>
            <LogOut size={17} />
            Cerrar sesión
          </button>
        </div>
      </aside>
      {menuOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Cerrar menú"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <div className="shell__main">
        <header className="topbar">
          <div className="topbar__left">
            <button
              type="button"
              className="menu-button"
              aria-label="Abrir menú"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={21} />
            </button>
            <div className="topbar__status">
              <span className="status-dot" />
              Servicios disponibles
            </div>
          </div>
          <div className="topbar__actions">
            <span className="topbar__chip">
              <CircleDollarSign size={15} />
              Cooperativa 24/7
            </span>
            <NotificationPopover />
            <span className="topbar__avatar">{initials}</span>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
