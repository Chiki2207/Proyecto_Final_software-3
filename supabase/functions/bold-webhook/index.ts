// Edge Function: webhook Bold (RF-32)
// Deploy: supabase functions deploy bold-webhook
// Bold URL: https://<project>.supabase.co/functions/v1/bold-webhook

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 })
  }

  try {
    const body = await req.json()
    const orderId = body.order_id || body.orderId || body["order-id"]
    const status = body.status || body["bold-tx-status"] || body.bold_tx_status || "PENDING"
    const boldTxId = body.bold_order_id || body["bold-order-id"] || body.boldOrderId || null

    if (!orderId) {
      return new Response(JSON.stringify({ error: "order_id required" }), { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    )

    const { data, error } = await supabase.rpc("bold_webhook", {
      p_order_id: orderId,
      p_status: status,
      p_bold_tx_id: boldTxId,
      p_payload: body,
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400 })
    }

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook error"
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
})
