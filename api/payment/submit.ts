import { createClient } from '@supabase/supabase-js'
const MAX_BYTES = 3 * 1024 * 1024
const MIME_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !service) return res.status(503).json({ error: 'Payment backend belum dikonfigurasi.' })
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer /, '')
    if (!token) return res.status(401).json({ error: 'Login diperlukan.' })
    const auth = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: authData, error: authError } = await auth.auth.getUser(token)
    if (authError || !authData.user) return res.status(401).json({ error: 'Sesi login tidak valid.' })
    const orderId = typeof req.body?.order_id === 'string' ? req.body.order_id : ''
    const mime = typeof req.body?.mime_type === 'string' ? req.body.mime_type : ''
    const encoded = typeof req.body?.file_base64 === 'string' ? req.body.file_base64 : ''
    if (!/^VW-\d+-[A-F0-9]{12}$/.test(orderId)) return res.status(400).json({ error: 'ID transaksi tidak valid.' })
    if (!MIME_EXT[mime] || !encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return res.status(400).json({ error: 'Unggah bukti JPG, PNG, atau WEBP yang valid.' })
    const buffer = Buffer.from(encoded, 'base64')
    if (!buffer.length || buffer.length > MAX_BYTES) return res.status(400).json({ error: 'Ukuran bukti maksimal 3 MB.' })
    const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: tx, error: txError } = await db.from('payment_transactions')
      .select('order_id,user_id,plan,billing_period,amount,status,created_at').eq('order_id', orderId).maybeSingle()
    if (txError) throw txError
    if (!tx || tx.user_id !== authData.user.id) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' })
    if (tx.status !== 'pending_verification' || tx.created_at && Date.now() - new Date(tx.created_at).getTime() > 24 * 60 * 60 * 1000)
      return res.status(409).json({ error: 'Transaksi sudah diajukan atau sudah kedaluwarsa. Buat transaksi baru jika diperlukan.' })
    const path = `${authData.user.id}/${orderId}.${MIME_EXT[mime]}`
    const { error: uploadError } = await db.storage.from('payment-proofs').upload(path, buffer, { contentType: mime, upsert: false })
    if (uploadError) throw new Error('Bukti tidak dapat disimpan. Pastikan bucket privat payment-proofs sudah dibuat.')
    const { error: updateError } = await db.from('payment_transactions').update({
      proof_path: path, proof_submitted_at: new Date().toISOString(), status: 'pending_verification'
    }).eq('order_id', orderId).eq('user_id', authData.user.id).is('proof_path', null)
    if (updateError) { await db.storage.from('payment-proofs').remove([path]); throw updateError }
    const { data: profile } = await db.from('profiles').select('full_name').eq('id', authData.user.id).maybeSingle()
    const adminEmail = process.env.PAYMENT_ADMIN_EMAIL
    const resendKey = process.env.RESEND_API_KEY
    if (adminEmail && resendKey) {
      const proofUrl = `${url}/storage/v1/object/sign/payment-proofs/${encodeURIComponent(path)}`
      const { data: signed } = await db.storage.from('payment-proofs').createSignedUrl(path, 60 * 60 * 24)
      const emailBody = {
        from: process.env.EMAIL_FROM || 'VELTRIX WARFARE <onboarding@resend.dev>',
        to: [adminEmail], subject: `Payment review required — ${orderId}`,
        html: `<h2>Pengajuan pembayaran baru</h2><p>Status: PENDING VERIFICATION</p><p>ID transaksi: ${orderId}</p><p>Nama: ${String(profile?.full_name || authData.user.user_metadata?.full_name || 'Member')}</p><p>Username: ${String(authData.user.user_metadata?.username || '-')}</p><p>ID member: ${authData.user.id}</p><p>Email: ${authData.user.email || '-'}</p><p>Paket: ${tx.plan} (${tx.billing_period})</p><p>Nominal: Rp ${Number(tx.amount).toLocaleString('id-ID')}</p><p>Diajukan: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p><p>Bukti (tautan privat, berlaku 24 jam): ${signed?.signedUrl || 'Buka Admin Panel untuk pemeriksaan'}</p>`
      }
      const mail = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(emailBody) })
      if (!mail.ok) console.error('Admin payment email failed:', await mail.text())
    } else {
      console.warn('Payment saved, but admin email is not configured (RESEND_API_KEY / PAYMENT_ADMIN_EMAIL).')
    }
    return res.status(200).json({ success: true, order_id: orderId, status: 'pending_verification' })
  } catch (error: any) {
    console.error('Payment proof submit failed:', error?.message || error)
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Gagal mengirim bukti pembayaran.' })
  }
}
