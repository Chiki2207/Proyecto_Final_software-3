import { Navigate, Route, Routes } from 'react-router-dom'
import {
  ProtectedRoute,
  PublicOnlyRoute,
  StaffRoute,
} from '@/components/auth/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'
import { AdminPage } from '@/pages/AdminPage'
import { AccountsPage } from '@/pages/AccountsPage'
import { AuditPage } from '@/pages/AuditPage'
import { CreditsPage } from '@/pages/CreditsPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { PaymentsPage } from '@/pages/PaymentsPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { PsePage } from '@/pages/PsePage'
import { PseResultPage } from '@/pages/PseResultPage'
import { RecoverPasswordPage } from '@/pages/RecoverPasswordPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { SecurityPage } from '@/pages/SecurityPage'
import { TransfersPage } from '@/pages/TransfersPage'

export default function App() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/recuperar" element={<RecoverPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/cuentas" element={<AccountsPage />} />
          <Route path="/transferencias" element={<TransfersPage />} />
          <Route path="/pagos" element={<PaymentsPage />} />
          <Route path="/creditos" element={<CreditsPage />} />
          <Route path="/pse" element={<PsePage />} />
          <Route path="/pse/resultado" element={<PseResultPage />} />
          <Route path="/notificaciones" element={<Navigate to="/dashboard" replace />} />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/seguridad" element={<SecurityPage />} />
          <Route element={<StaffRoute />}>
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/auditoria" element={<AuditPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
