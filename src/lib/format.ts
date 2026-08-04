/** Formatea COP para la UI Fincomer */
export function formatCOP(value: number | string | null | undefined) {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0)
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0)
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatDateOnly(value: string | null | undefined) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value))
}

export function maskAccount(accountNumber: string) {
  if (accountNumber.length < 4) return accountNumber
  return `•••• ${accountNumber.slice(-4)}`
}

export function statusLabel(status: string) {
  const map: Record<string, string> = {
    inactive: 'Inactiva / Baja',
    blocked: 'Bloqueada',
    closed: 'Cerrada',
    pending: 'Pendiente',
    active: 'Activa',
    completed: 'Completada',
    rejected: 'Rechazada',
    reversed: 'Reversada',
    scheduled: 'Programada',
    radicada: 'Radicada',
    en_estudio: 'En estudio',
    aprobada: 'Aprobada',
    rechazada: 'Rechazada',
    desembolsada: 'Desembolsada',
    cancelada: 'Cancelada',
    paid: 'Pagada',
    overdue: 'Vencida',
    created: 'Creada',
    redirected: 'Redirigida',
    approved: 'Aprobada',
    error: 'Error',
    failed: 'Fallida',
    topup: 'Recarga',
    bill: 'Factura',
    installment: 'Cuota',
  }
  return map[status] ?? status
}
