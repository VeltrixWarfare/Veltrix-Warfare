import { createClient } from '@supabase/supabase-js'
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anonKey || !serviceKey) return res.status(503).json({ error: 'Payment backend belum dikonfigurasi.' })
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return res.status(401).json({ error: 'Login diperlukan.' })
  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await auth.auth.getUser(token)
  if (error || !data.user) return res.status(401).json({ error: 'Sesi login tidak valid.' })
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const result = await db.from('payment_transactions')
    .select('order_id, plan, billing_period, amount, currency, status, payment_method, created_at, paid_at, rejection_reason')
    .eq('user_id', data.user.id).order('created_at', { ascending: false }).limit(50)
  if (result.error) return res.status(500).json({ error: 'Gagal memuat riwayat transaksi.' })
  return res.status(200).json({ transactions: result.data || [] })
}
