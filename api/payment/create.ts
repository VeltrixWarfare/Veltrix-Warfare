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
  if (!url || !anonKey || !serviceKey) return res.status(503).json({ error: 'Payment backend belum dikonfigurasi di Vercel.' })
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (!token) return res.status(401).json({ error: 'Login diperlukan.' })
    const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: authData, error: authError } = await auth.auth.getUser(token)
    if (authError || !authData.user) return res.status(401).json({ error: 'Sesi login tidak valid.' })
    const plan = typeof req.body?.plan === 'string' ? req.body.plan : ''
    const billing = typeof req.body?.billing === 'string' ? req.body.billing : ''
    const product = PLANS[plan]?.[billing]
    if (!product) return res.status(400).json({ error: 'Paket atau periode pembayaran tidak valid.' })
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const orderId = `VW-${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`
    const { error } = await db.from('payment_transactions').insert({
      order_id: orderId, user_id: authData.user.id, plan, billing_period: billing,
      amount: product.amount, currency: 'IDR', status: 'pending_verification',
      payment_method: 'manual_qris', customer_email: authData.user.email || null,
    })
    if (error) throw error
    return res.status(201).json({ order_id: orderId, plan, billing_period: billing, amount: product.amount, currency: 'IDR', status: 'awaiting_payment' })
  } catch (error: any) {
    console.error('Manual payment create failed:', { message: error?.message || String(error), code: error?.code, details: error?.details, hint: error?.hint })
    return res.status(500).json({ error: 'Gagal membuat transaksi. Coba lagi.' })
  }
}
