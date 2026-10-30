import { createClient } from '@supabase/supabase-js'

const PLANS: Record<string, Record<string, { amount: number; label: string }>> = {
  Essential: { Monthly: { amount: 79000, label: 'Essential Monthly' }, Yearly: { amount: 758000, label: 'Essential Yearly' } },
  Advanced: { Monthly: { amount: 149000, label: 'Advanced Monthly' }, Yearly: { amount: 1430000, label: 'Advanced Yearly' } },
  Private: { Monthly: { amount: 299000, label: 'Private Monthly' }, Yearly: { amount: 2870000, label: 'Private Yearly' } },
}

type MidtransPreference = {
  payment_channels?: Array<{ name?: string; enabled?: boolean }>
  error_messages?: string[]
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const serverKey = process.env.MIDTRANS_SERVER_KEY
  if (!url || !anonKey || !serviceKey || !serverKey) {
    return res.status(503).json({ error: 'Payment backend belum dikonfigurasi di Vercel.' })
  }

  try {
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return res.status(401).json({ error: 'Login diperlukan sebelum checkout.' })

    const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: authData, error: authError } = await auth.auth.getUser(token)
    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Sesi login tidak valid. Silakan login ulang.' })
    }

    const plan = typeof req.body?.plan === 'string' ? req.body.plan : ''
    const billing = typeof req.body?.billing === 'string' ? req.body.billing : ''
    const product = PLANS[plan]?.[billing]
    if (!product) return res.status(400).json({ error: 'Paket atau periode pembayaran tidak valid.' })

    const production = process.env.MIDTRANS_IS_PRODUCTION === 'true'
    const baseUrl = production ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com'
    const authorization = `Basic ${Buffer.from(serverKey + ':').toString('base64')}`

    // Redirect-mode Snap does not inherit the dashboard's Snap Preferences list.
    // Fetch the merchant's active channels and pass them explicitly to each token request.
    const preferenceResponse = await fetch(`${baseUrl}/snap/v3/merchant-preferences`, {
      method: 'GET',
      headers: { Authorization: authorization, Accept: 'application/json' },
    })
    const preferences = await preferenceResponse.json().catch(() => ({})) as MidtransPreference
    if (!preferenceResponse.ok) {
      const detail = preferences.error_messages?.join(' ') || `HTTP ${preferenceResponse.status}`
      throw new Error(`Tidak bisa membaca Snap Preferences Midtrans. Pastikan MIDTRANS_SERVER_KEY cocok dengan environment ${production ? 'Production' : 'Sandbox'}. Detail: ${detail}`)
    }

    const enabledPayments = (preferences.payment_channels || [])
      .filter((channel) => channel.enabled === true && typeof channel.name === 'string')
      .map((channel) => channel.name as string)

    if (enabledPayments.length === 0) {
      throw new Error('Midtrans tidak mengembalikan metode pembayaran aktif. Periksa Snap Preferences dan pastikan server key berasal dari environment yang sama.')
    }

    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const orderId = `VW-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
    const { error: insertError } = await db.from('payment_transactions').insert({
      order_id: orderId, user_id: authData.user.id, plan, billing_period: billing,
      amount: product.amount, currency: 'IDR', status: 'pending', payment_method: 'pending',
    })
    if (insertError) throw new Error(`Gagal membuat catatan transaksi: ${insertError.message}`)

    const origin = `https://${req.headers.host || ''}`.replace(/\/$/, '')
    const response = await fetch(`${baseUrl}/snap/v1/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authorization, Accept: 'application/json' },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: product.amount },
        item_details: [{ id: `${plan}-${billing}`, price: product.amount, quantity: 1, name: product.label }],
        customer_details: { email: authData.user.email || undefined },
        enabled_payments: enabledPayments,
        callbacks: { finish: `${origin}/?payment_return=1` },
      }),
    })
    const snap = await response.json().catch(() => ({}))
    if (!response.ok || !snap.redirect_url) {
      await db.from('payment_transactions').update({ status: 'failed' }).eq('order_id', orderId)
      const detail = snap.error_messages?.join(' ') || `HTTP ${response.status}`
      throw new Error(`Midtrans gagal membuat checkout: ${detail}`)
    }

    const { error: updateError } = await db.from('payment_transactions').update({
      snap_token: snap.token || null,
      redirect_url: snap.redirect_url,
      gateway_response: {
        token_created: Boolean(snap.token),
        environment: production ? 'production' : 'sandbox',
        enabled_payment_channels: enabledPayments,
      },
    }).eq('order_id', orderId)
    if (updateError) throw new Error('Checkout dibuat, tetapi catatan transaksi gagal diperbarui.')

    return res.status(200).json({
      order_id: orderId,
      redirect_url: snap.redirect_url,
      environment: production ? 'production' : 'sandbox',
      enabled_payment_channels: enabledPayments,
    })
  } catch (error: any) {
    console.error('Payment create failed:', error?.message || error)
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Gagal membuat checkout.' })
  }
}
