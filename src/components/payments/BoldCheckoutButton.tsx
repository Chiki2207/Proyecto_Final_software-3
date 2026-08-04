import { useEffect, useRef, useState } from 'react'
import { loadBoldScript, type BoldCheckoutData } from '@/lib/bold'
import { Alert, LoadingBlock } from '@/components/ui'

type Props = {
  checkout: BoldCheckoutData
  scriptUrl?: string
  onReady?: () => void
  onError?: (message: string) => void
}

/**
 * Monta el botón oficial de Bold (boldPaymentButton.js),
 * igual que en Buscaninos: data-api-key + data-integrity-signature.
 */
export function BoldCheckoutButton({ checkout, scriptUrl, onReady, onError }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function mount() {
      try {
        await loadBoldScript(scriptUrl)
        if (cancelled || !hostRef.current) return

        hostRef.current.innerHTML = ''
        const btn = document.createElement('button')
        btn.className = 'bold-fincomer-btn'
        btn.setAttribute('data-bold-button', '')
        btn.setAttribute('data-api-key', checkout.apiKey)
        btn.setAttribute('data-order-id', checkout.orderId)
        btn.setAttribute('data-amount', String(checkout.amount))
        btn.setAttribute('data-currency', checkout.currency || 'COP')
        btn.setAttribute('data-description', checkout.description || 'Pago Fincomer')
        btn.setAttribute('data-integrity-signature', checkout.integritySignature)
        btn.setAttribute('data-redirection-url', checkout.redirectionUrl)
        btn.setAttribute('data-render-mode', 'embedded')
        btn.setAttribute('data-customer-data', JSON.stringify(checkout.customerData))
        btn.setAttribute('data-billing-address', JSON.stringify(checkout.billingAddress))
        hostRef.current.appendChild(btn)

        setReady(true)
        onReady?.()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error cargando Bold'
        setError(message)
        onError?.(message)
      }
    }

    void mount()
    return () => {
      cancelled = true
      if (hostRef.current) hostRef.current.innerHTML = ''
    }
  }, [checkout, scriptUrl, onReady, onError])

  return (
    <div className="bold-checkout">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!ready && !error ? <LoadingBlock label="Cargando checkout Bold…" /> : null}
      <div ref={hostRef} className="bold-checkout__host" />
      <p className="muted bold-checkout__hint">
        Pagarás de forma segura en Bold (tarjeta, PSE u otros medios). Al terminar
        volverás a Fincomer para conciliar el pago.
      </p>
    </div>
  )
}
