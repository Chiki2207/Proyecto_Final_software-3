import { supabase } from '@/lib/supabase'
import type {
  Account,
  Announcement,
  AppNotification,
  AppRoleCode,
  AuditLog,
  BillPayment,
  Credit,
  CreditApplication,
  CreditInstallment,
  CreditProduct,
  CreditSimulation,
  GatewayTransaction,
  Movement,
  NotificationPreferences,
  Profile,
  ServiceProvider,
  SystemParameter,
  Transfer,
  TransferRecipient,
} from '@/types'

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data as Profile
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<Profile, 'phone' | 'address' | 'city' | 'department'>>,
) {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data as Profile
}

export async function getUserRoles(userId: string) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role_id, app_roles(code, name)')
    .eq('user_id', userId)
  if (error) throw error
  return (data ?? []).map((row) => {
    const role = row.app_roles as unknown as { code: AppRoleCode; name: string } | null
    return role?.code
  }).filter(Boolean) as AppRoleCode[]
}

export async function listAccounts(userId: string) {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as Account[]
}

export async function listMovements(accountId: string, from?: string, to?: string) {
  let query = supabase
    .from('movements')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Movement[]
}

export async function executeTransfer(input: {
  fromAccountId: string
  toAccountNumber: string
  amount: number
  description?: string
  kind?: 'own' | 'internal'
}) {
  const { data, error } = await supabase.rpc('execute_transfer', {
    p_from_account_id: input.fromAccountId,
    p_to_account_number: input.toAccountNumber.trim(),
    p_amount: input.amount,
    p_description: input.description ?? null,
    p_kind: input.kind ?? 'internal',
  })
  if (error) throw new Error(error.message)
  return data as Transfer
}

export type TransferDirectoryItem = {
  account_number: string
  account_type: string
  owner_name: string
  owner_email: string
  is_own: boolean
}

export async function listTransferDirectory() {
  const { data, error } = await supabase.rpc('list_transfer_directory')
  if (error) throw new Error(error.message)
  return (data ?? []) as TransferDirectoryItem[]
}

export type DemoInvoice = {
  id: string
  provider_id: string
  provider_name: string
  category: string
  bill_reference: string
  amount: number
  description: string | null
  status: string
  due_date: string
}

export async function listDemoInvoices() {
  const { data, error } = await supabase.rpc('list_demo_invoices')
  if (error) throw new Error(error.message)
  return (data ?? []) as DemoInvoice[]
}

export async function listTransfers(userId: string) {
  const { data, error } = await supabase
    .from('transfers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as Transfer[]
}

export async function listRecipients(userId: string) {
  const { data, error } = await supabase
    .from('transfer_recipients')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as TransferRecipient[]
}

export async function saveRecipient(input: {
  ownerId: string
  alias: string
  accountNumber: string
  bankName?: string
  isInternal?: boolean
}) {
  const { data, error } = await supabase
    .from('transfer_recipients')
    .insert({
      owner_id: input.ownerId,
      alias: input.alias,
      account_number: input.accountNumber,
      bank_name: input.bankName ?? 'Fincomer',
      is_internal: input.isInternal ?? true,
    })
    .select()
    .single()
  if (error) throw error
  return data as TransferRecipient
}

export async function listProviders() {
  const { data, error } = await supabase
    .from('service_providers')
    .select('*')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as ServiceProvider[]
}

export async function payBill(input: {
  accountId: string
  providerId: string
  billReference: string
  amount: number
}) {
  const { data, error } = await supabase.rpc('execute_bill_payment', {
    p_account_id: input.accountId,
    p_provider_id: input.providerId,
    p_bill_reference: input.billReference.trim(),
    p_amount: input.amount,
  })
  if (error) throw new Error(error.message)
  return data as BillPayment
}

export async function listBillPayments(userId: string) {
  const { data, error } = await supabase
    .from('bill_payments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as BillPayment[]
}

export async function listCreditProducts() {
  const { data, error } = await supabase
    .from('credit_products')
    .select('*')
    .eq('active', true)
    .order('name')
  if (error) throw error
  return (data ?? []) as CreditProduct[]
}

export async function simulateCredit(productId: string, amount: number, termMonths: number) {
  const { data, error } = await supabase.rpc('simulate_credit', {
    p_product_id: productId,
    p_amount: amount,
    p_term_months: termMonths,
  })
  if (error) throw error
  return data as CreditSimulation
}

export async function applyCredit(input: {
  userId: string
  productId: string
  amount: number
  termMonths: number
  monthlyPayment?: number
  purpose?: string
}) {
  const { data, error } = await supabase
    .from('credit_applications')
    .insert({
      user_id: input.userId,
      product_id: input.productId,
      requested_amount: input.amount,
      term_months: input.termMonths,
      monthly_payment: input.monthlyPayment ?? null,
      purpose: input.purpose ?? null,
      status: 'radicada',
    })
    .select()
    .single()
  if (error) throw error
  return data as CreditApplication
}

export async function listCreditApplications(userId: string) {
  const { data, error } = await supabase
    .from('credit_applications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as CreditApplication[]
}

export async function listCredits(userId: string) {
  const { data, error } = await supabase
    .from('credits')
    .select('*')
    .eq('user_id', userId)
    .order('disbursed_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Credit[]
}

export async function listInstallments(creditId: string) {
  const { data, error } = await supabase
    .from('credit_installments')
    .select('*')
    .eq('credit_id', creditId)
    .order('installment_number')
  if (error) throw error
  return (data ?? []) as CreditInstallment[]
}

export async function createGatewayPayment(input: {
  accountId: string
  amount: number
  description?: string
}) {
  const { data, error } = await supabase.rpc('create_gateway_payment', {
    p_account_id: input.accountId,
    p_amount: input.amount,
    p_description: input.description ?? 'Pago PSE Fincomer',
    p_provider: 'bold',
  })
  if (error) throw error
  return data as GatewayTransaction
}

export async function listGatewayTransactions(userId: string) {
  const { data, error } = await supabase
    .from('payment_gateway_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []) as GatewayTransaction[]
}

export async function listNotifications(userId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40)
  if (error) throw error
  return (data ?? []) as AppNotification[]
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function getNotificationPreferences(userId: string) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error) throw error
  return data as NotificationPreferences
}

export async function updateNotificationPreferences(
  userId: string,
  patch: Partial<NotificationPreferences>,
) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data as NotificationPreferences
}

export async function listAnnouncements() {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) throw error
  return (data ?? []) as Announcement[]
}

export async function listAuditLogs(limit = 50) {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as AuditLog[]
}

export async function listSystemParameters() {
  const { data, error } = await supabase.from('system_parameters').select('*').order('key')
  if (error) throw error
  return (data ?? []) as SystemParameter[]
}

export async function listAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function adminSetProfileStatus(
  userId: string,
  status: Profile['status'],
) {
  const { data, error } = await supabase.rpc('admin_set_profile_status', {
    p_user_id: userId,
    p_status: status,
  })
  if (error) throw error
  return data as Profile
}

export async function adminCreateUser(input: {
  email: string
  password: string
  fullName: string
  documentNumber: string
  phone?: string
  documentType?: Profile['document_type']
  roleCode?: AppRoleCode
}) {
  const { data, error } = await supabase.rpc('admin_create_user', {
    p_email: input.email,
    p_password: input.password,
    p_full_name: input.fullName,
    p_document_number: input.documentNumber,
    p_phone: input.phone ?? null,
    p_document_type: input.documentType ?? 'CC',
    p_role_code: input.roleCode ?? 'asociado',
  })
  if (error) throw error
  return data as Profile
}

export async function adminDeactivateUser(userId: string) {
  const { data, error } = await supabase.rpc('admin_deactivate_user', {
    p_user_id: userId,
  })
  if (error) throw error
  return data as Profile
}

export async function adminDeleteUser(userId: string) {
  const { data, error } = await supabase.rpc('admin_delete_user', {
    p_user_id: userId,
  })
  if (error) throw error
  return data as { ok: boolean; email: string }
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}
