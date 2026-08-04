import { supabase } from '@/lib/supabase'
import type { BoldPrepareResult } from '@/lib/bold'
import type { CreditInstallment, GatewayTransaction } from '@/types'

export type BoldPurpose = 'topup' | 'bill' | 'installment'

export async function getBoldPublicConfig() {
  const { data, error } = await supabase.rpc('get_bold_public_config')
  if (error) throw error
  return data as { apiKey: string | null; scriptUrl: string; configured: boolean }
}

export async function prepareBoldCheckout(input: {
  accountId: string
  amount: number
  description?: string
  purpose?: BoldPurpose
  purposeMeta?: Record<string, unknown>
  redirectionUrl?: string
}) {
  const { data, error } = await supabase.rpc('prepare_bold_checkout', {
    p_account_id: input.accountId,
    p_amount: input.amount,
    p_description: input.description ?? 'Pago Fincomer via Bold',
    p_purpose: input.purpose ?? 'topup',
    p_purpose_meta: input.purposeMeta ?? {},
    p_redirection_url:
      input.redirectionUrl ?? `${window.location.origin}/pse/resultado`,
  })
  if (error) throw error
  return data as BoldPrepareResult
}

export async function completeBoldPayment(input: {
  orderId: string
  status: string
  boldTxId?: string | null
  payload?: Record<string, unknown>
}) {
  const { data, error } = await supabase.rpc('complete_bold_payment', {
    p_order_id: input.orderId,
    p_status: input.status,
    p_bold_tx_id: input.boldTxId ?? null,
    p_payload: input.payload ?? {},
  })
  if (error) throw error
  return data as GatewayTransaction
}

export async function payCreditInstallment(accountId: string, installmentId: string) {
  const { data, error } = await supabase.rpc('pay_credit_installment', {
    p_account_id: accountId,
    p_installment_id: installmentId,
  })
  if (error) throw error
  return data as CreditInstallment
}
