import { createHash, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const serverKey = process.env.MIDTRANS_SERVER_KEY
  if (!url || !serviceKey || !serverKey) return res.status(503).json({ error: 'Webhook belum dikonfigurasi.' })

  try {
    const body = req.body || {}
    const { order_id, status_code, gross_amount, signature_key } = body
    if (!order_id || !status_code || !gross_amount || !signature_key) return res.status(400).json({ error: 'Invalid notification payload' })
    const expected = createHash('sha512').update(String(order_id) + String(status_code) + String(gross_amount) + serverKey).digest('hex')
    const supplied = Buffer.from(String(signature_key).toLowerCase(), 'hex')
    const wanted = Buffer.from(expected, 'hex')
    if (supplied.length !== wanted.length || !timingSafeEqual(supplied, wanted)) return res.status(401).json({ error: 'Invalid signature' })

    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: tx, error: lookupError } = await db.from('payment_transactions')
      .select('order_id, amount, status').eq('order_id', String(order_id)).maybeSingle()
    if (lookupError) throw lookupError
    if (!tx) return res.status(404).json({ error: 'Unknown order id' })
    if (Number(gross_amount) !== Number(tx.amount)) return res.status(400).json({ error: 'Amount mismatch' })
    if (tx.status === 'paid') return res.status(200).json({ received: true, duplicate: true })

    // Verify status directly with Midtrans too; never trust the browser redirect.
    const production = process.env.MIDTRANS_IS_PRODUCTION === 'true'
    const statusBase = production ? 'https://api.midtrans.com/v2' : 'https://api.sandbox.midtrans.com/v2'
    const statusResponse = await fetch(`${statusBase}/${encodeURIComponent(String(order_id))}/status`, {
      headers: { Authorization: `Basic ${Buffer.from(serverKey + ':').toString('base64')}`, Accept: 'application/json' },
    })
    const verified = await statusResponse.json().catch(() => ({}))
    if (!statusResponse.ok || verified.order_id !== order_id || Number(verified.gross_amount) !== Number(tx.amount)) {
      return res.status(400).json({ error: 'Unable to verify transaction status with Midtrans' })
    }

    const paid = verified.transaction_status === 'settlement' ||
      (verified.transaction_status === 'capture' && (!verified.fraud_status || verified.fraud_status === 'accept'))
    if (paid) {
      await db.from('payment_transactions').update({
        payment_method: verified.payment_type || 'unknown',
      }).eq('order_id', String(order_id)).neq('status', 'paid')
      const { data, error } = await db.rpc('confirm_midtrans_payment', {
        p_order_id: String(order_id),
        p_payment_reference: String(verified.transaction_id || order_id),
      })
      if (error) throw error
      if (data !== true) throw new Error('Payment was not applied. Check the SQL migration and memberships table schema.')
    } else {
      const map: Record<string, string> = { pending: 'pending', deny: 'failed', cancel: 'cancelled', expire: 'expired', failure: 'failed' }
      const next = map[verified.transaction_status] || 'pending'
      await db.from('payment_transactions').update({
        status: next,
        payment_method: verified.payment_type || 'unknown',
        gateway_response: { transaction_status: verified.transaction_status, payment_type: verified.payment_type || null },
      }).eq('order_id', String(order_id)).neq('status', 'paid')
    }
    return res.status(200).json({ received: true })
  } catch (error: any) {
    console.error('Midtrans webhook failed:', error?.message || error)
    return res.status(500).json({ error: 'Webhook processing failed' })
  }
}
