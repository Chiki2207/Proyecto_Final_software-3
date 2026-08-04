/** Tipos de dominio Fincomer Digital */

export type AppRoleCode = 'asociado' | 'asesor' | 'admin' | 'riesgos'

export type Profile = {
  id: string
  document_type: 'CC' | 'CE' | 'NIT' | 'PA'
  document_number: string
  full_name: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  department: string | null
  status: 'active' | 'blocked' | 'pending' | 'inactive'
  failed_login_attempts: number
  locked_until: string | null
  mfa_enabled: boolean
  created_at: string
  updated_at: string
}

export type Account = {
  id: string
  user_id: string
  account_number: string
  account_type: 'ahorro' | 'corriente' | 'credito'
  product_name: string
  balance: number
  currency: string
  status: 'active' | 'blocked' | 'closed'
  created_at: string
}

export type Movement = {
  id: string
  account_id: string
  movement_type: string
  amount: number
  balance_after: number
  description: string
  reference_code: string | null
  created_at: string
}

export type Transfer = {
  id: string
  user_id: string
  from_account_id: string
  to_account_number: string | null
  to_bank_name: string | null
  transfer_kind: 'own' | 'internal' | 'interbank'
  amount: number
  description: string | null
  status: string
  receipt_code: string
  created_at: string
  executed_at: string | null
}

export type ServiceProvider = {
  id: string
  code: string
  name: string
  category: string
  active: boolean
}

export type BillPayment = {
  id: string
  user_id: string
  account_id: string
  provider_id: string
  bill_reference: string
  amount: number
  status: string
  receipt_code: string
  created_at: string
}

export type CreditProduct = {
  id: string
  code: string
  name: string
  min_amount: number
  max_amount: number
  min_term_months: number
  max_term_months: number
  annual_rate: number
  active: boolean
}

export type CreditApplication = {
  id: string
  user_id: string
  product_id: string
  requested_amount: number
  term_months: number
  monthly_payment: number | null
  purpose: string | null
  status: string
  created_at: string
  updated_at: string
}

export type Credit = {
  id: string
  user_id: string
  product_id: string
  principal: number
  annual_rate: number
  term_months: number
  outstanding_balance: number
  status: string
  disbursed_at: string
}

export type CreditInstallment = {
  id: string
  credit_id: string
  installment_number: number
  due_date: string
  principal_amount: number
  interest_amount: number
  total_amount: number
  status: string
  paid_at: string | null
}

export type GatewayTransaction = {
  id: string
  user_id: string
  account_id: string | null
  provider: string
  reference_code: string
  amount: number
  description: string | null
  status: string
  purpose?: 'topup' | 'bill' | 'installment' | string
  purpose_meta?: Record<string, unknown>
  external_id?: string | null
  bold_tx_status?: string | null
  reconciled?: boolean
  created_at: string
  updated_at?: string
  completed_at?: string | null
}

export type AppNotification = {
  id: string
  user_id: string
  channel: string
  category: string
  title: string
  body: string
  read_at: string | null
  created_at: string
}

export type NotificationPreferences = {
  user_id: string
  email_enabled: boolean
  sms_enabled: boolean
  push_enabled: boolean
  security_alerts: boolean
  operation_alerts: boolean
}

export type AuditLog = {
  id: number
  user_id: string | null
  action: string
  entity: string
  entity_id: string | null
  details: Record<string, unknown>
  created_at: string
}

export type Announcement = {
  id: string
  title: string
  body: string
  published: boolean
  published_at: string | null
  created_at: string
}

export type SystemParameter = {
  key: string
  value: unknown
  description: string | null
}

export type CreditSimulation = {
  product_code: string
  product_name: string
  amount: number
  term_months: number
  annual_rate: number
  monthly_payment: number
  total_payment: number
  total_interest: number
}

export type TransferRecipient = {
  id: string
  owner_id: string
  alias: string
  account_number: string
  bank_name: string
  is_internal: boolean
  created_at: string
}

export type SignUpPayload = {
  email: string
  password: string
  fullName: string
  documentNumber: string
  phone?: string
}

export type SignInPayload = {
  email: string
  password: string
}
