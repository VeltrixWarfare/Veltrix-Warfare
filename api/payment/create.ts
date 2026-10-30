import { createClient } from '@supabase/supabase-js'

const PLANS: Record<string, Record<string, { amount: number; label: string }>> = {
  Essential: { Monthly: { amount: 79000, label: 'Essential Monthly' }, Yearly: { amount: 758000, label: 'Essential Yearly' } },
  Advanced: { Monthly: { amount: 149000, label: 'Advanced Monthly' }, Yearly: { amount: 1430000, label: 'Advanced Yearly' } },
  Private: { Monthly: { amount: 299000, label: 'Private Monthly' }, Yearly: { amount: 2870000, label: 'Private Yearly' } },
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const serverKey = process.env.MIDTRANS_SERVER_KEY
  if (!url || !anonKey || !serviceKey || !serverKey) return res.status(503).json({ error: 'Payment backend belum dikonfigurasi di Vercel.' })

  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return res.status(401).json({ error: 'Login diperlukan sebelum checkout.' })
    const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: authData, error: authError } = await auth.auth.getUser(token)
    if (authError || !authData.user) return res.status(401).json({ error: 'Sesi login tidak valid. Silakan login ulang.' })

    const plan = typeof req.body?.plan === 'string' ? req.body.plan : ''
    const billing = typeof req.body?.billing === 'string' ? req.body.billing : ''
    const product = PLANS[plan]?.[billing]
    if (!product) return res.status(400).json({ error: 'Paket atau periode pembayaran tidak valid.' })

    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const orderId = `VW-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    const { error: insertError } = await db.from('payment_transactions').insert({
      order_id: orderId, user_id: authData.user.id, plan, billing_period: billing,
      amount: product.amount, currency: 'IDR', status: 'pending', payment_method: 'pending',
    })
    if (insertError) throw new Error(`Gagal membuat catatan transaksi: ${insertError.message}`)

    const production = process.env.MIDTRANS_IS_PRODUCTION === 'true'
    const endpoint = production ? 'https://app.midtrans.com/snap/v1/transactions' : 'https://app.sandbox.midtrans.com/snap/v1/transactions'
    const origin = `https://${req.headers.host || ''}`.replace(/\/$/, '')
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(serverKey + ':').toString('base64')}`, Accept: 'application/json' },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: product.amount },
        item_details: [{ id: `${plan}-${billing}`, price: product.amount, quantity: 1, name: product.label }],
        customer_details: { email: authData.user.email || undefined },
        callbacks: { finish: `${origin}/?payment_return=1` },
      }),
    })
    const snap = await response.json().catch(() => ({}))
    if (!response.ok || !snap.redirect_url) {
      await db.from('payment_transactions').update({ status: 'failed' }).eq('order_id', orderId)
      throw new Error(snap.error_messages?.join(' ') || 'Midtrans gagal membuat checkout. Periksa kredensial sandbox dan ketersediaan QRIS.')
    }
    const { error: updateError } = await db.from('payment_transactions').update({
      snap_token: snap.token || null, redirect_url: snap.redirect_url,
      gateway_response: { token_created: Boolean(snap.token), environment: production ? 'production' : 'sandbox' },
    }).eq('order_id', orderId)
    if (updateError) throw new Error('Checkout dibuat, tetapi catatan transaksi gagal diperbarui.')
    return res.status(200).json({ order_id: orderId, redirect_url: snap.redirect_url, environment: production ? 'production' : 'sandbox' })
  } catch (error: any) {
    console.error('Payment create failed:', error?.message || error)
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Gagal membuat checkout.' })
  }
}
