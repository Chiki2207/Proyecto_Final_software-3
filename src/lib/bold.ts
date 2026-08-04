/** Tipos y helpers del Checkout Button de Bold (mismo patrón que Buscaninos). */

export type BoldCustomerData = {
  email: string
  fullName: string
  phone?: string
  dialCode?: string
  documentNumber?: string
  documentType?: string
}

export type BoldBillingAddress = {
  address?: string
  zipCode?: string
  city?: string
  state?: string
  country?: string
}

export type BoldCheckoutData = {
  apiKey: string
  orderId: string
  amount: number
  currency: string
  description: string | null
  integritySignature: string
  redirectionUrl: string
  customerData: BoldCustomerData
  billingAddress: BoldBillingAddress
}

export type BoldPrepareResult = {
  payment: {
    id: string
    reference_code: string
    amount: number
    status: string
    purpose: string
  }
  boldCheckoutData: BoldCheckoutData
}

const SCRIPT_URL = 'https://checkout.bold.co/library/boldPaymentButton.js'

export function loadBoldScript(scriptUrl = SCRIPT_URL): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`)
  if (existing) {
    return existing.dataset.loaded === '1'
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          existing.addEventListener('load', () => resolve())
          existing.addEventListener('error', () => reject(new Error('No se pudo cargar Bold')))
        })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = scriptUrl
    script.async = true
    script.onload = () => {
      script.dataset.loaded = '1'
      resolve()
    }
    script.onerror = () => reject(new Error('No se pudo cargar Bold Checkout'))
    document.body.appendChild(script)
  })
}

/** Query params que Bold envía al redirectionUrl (aliases como en Buscaninos). */
export function parseBoldResultParams(search: string) {
  const q = new URLSearchParams(search)
  const orderId =
    q.get('order-id') ||
    q.get('orderId') ||
    q.get('order_id') ||
    ''
  const boldTxId =
    q.get('bold-order-id') ||
    q.get('boldOrderId') ||
    q.get('bold_order_id') ||
    null
  const status =
    q.get('bold-tx-status') ||
    q.get('boldTxStatus') ||
    q.get('status') ||
    q.get('tx-status') ||
    'PENDING'
  return { orderId, boldTxId, status }
}
