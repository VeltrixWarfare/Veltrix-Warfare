import { createClient } from '@supabase/supabase-js'
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !service) return res.status(503).json({ error: 'Payment backend belum dikonfigurasi.' })
  const token = String(req.headers.authorization || '').replace(/^Bearer /, '')
  if (!token) return res.status(401).json({ error: 'Login diperlukan.' })
  const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: authData, error: authError } = await auth.auth.getUser(token)
  if (authError || !authData.user) return res.status(401).json({ error: 'Sesi login tidak valid.' })
  const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: profile } = await db.from('profiles').select('role').eq('id', authData.user.id).maybeSingle()
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Akses admin diperlukan.' })
  if (req.method === 'GET') {
    const { data, error } = await db.from('payment_transactions').select('order_id,user_id,plan,billing_period,amount,status,created_at,proof_submitted_at,proof_path,customer_email').not('proof_path','is',null).order('created_at',{ascending:false}).limit(100)
    if (error) return res.status(500).json({ error: 'Gagal memuat pengajuan pembayaran.' })
    const transactions = await Promise.all((data || []).map(async tx => {
      const { data: proof } = await db.storage.from('payment-proofs').createSignedUrl(tx.proof_path, 300)
      return { ...tx, proof_url: proof?.signedUrl || null }
    }))
    return res.status(200).json({ transactions })
  }
  const orderId = typeof req.body?.order_id === 'string' ? req.body.order_id : ''
  const decision = req.body?.decision
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0,500) : null
  if (!/^VW-\d+-[A-F0-9]{12}$/.test(orderId) || !['approved','rejected'].includes(decision)) return res.status(400).json({ error: 'Keputusan atau ID transaksi tidak valid.' })
  const { data, error } = await db.rpc('admin_review_payment', {
    p_order_id: orderId, p_admin_id: authData.user.id, p_decision: decision, p_rejection_reason: reason
  })
  if (error) { console.error('Admin review failed:', error.message); return res.status(400).json({ error: error.message }) }
  return res.status(200).json({ success: data === true, status: decision })
}
