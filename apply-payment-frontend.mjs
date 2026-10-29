import fs from 'node:fs'
const path = 'src/App.tsx'
if (!fs.existsSync(path)) throw new Error('Jalankan script dari root repository yang berisi src/App.tsx')
let s = fs.readFileSync(path, 'utf8')
const stateAnchor = "  const [billing, setBilling] = useState<'Monthly' | 'Yearly'>('Monthly')\n"
if (!s.includes(stateAnchor)) throw new Error('Anchor billing state tidak ditemukan; file mungkin sudah berbeda atau patch sudah diterapkan.')
s = s.replace(stateAnchor, stateAnchor + `  const [paymentBusyPlan, setPaymentBusyPlan] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Array<{order_id:string;plan:string;billing_period:string;amount:number;currency:string;status:string;payment_method:string;created_at:string;paid_at:string|null}>>([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)
`)
const handlerAnchor = '  const loadAdminData = async () => {'
if (!s.includes(handlerAnchor)) throw new Error('Anchor loadAdminData tidak ditemukan.')
s = s.replace(handlerAnchor, `  const handleCheckout = async (plan: string) => {
    if (!supabase) { action('Supabase belum terkonfigurasi. Periksa environment variables Vercel.'); return }
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.access_token) {
      action('Login dulu sebelum memilih paket membership.')
      setPage('Login / Register')
      return
    }
    setPaymentBusyPlan(plan)
    setNotice('')
    try {
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${session.access_token}\` },
        body: JSON.stringify({ plan, billing }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.redirect_url) throw new Error(result.error || 'Checkout gagal dibuat.')
      window.location.assign(result.redirect_url)
    } catch (error) {
      action(error instanceof Error ? error.message : 'Gagal memulai checkout.')
    } finally { setPaymentBusyPlan(null) }
  }

  const loadTransactions = async () => {
    if (!supabase) { action('Supabase belum terkonfigurasi.'); return }
    setTransactionsLoading(true)
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (!session?.access_token) {
        setTransactions([])
        action('Login dulu untuk melihat riwayat transaksi.')
        setPage('Login / Register')
        return
      }
      const response = await fetch('/api/payment/transactions', {
        headers: { Authorization: \`Bearer \${session.access_token}\`, Accept: 'application/json' },
        cache: 'no-store',
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Gagal memuat transaksi.')
      setTransactions(Array.isArray(result.transactions) ? result.transactions : [])
    } catch (error) {
      action(error instanceof Error ? error.message : 'Gagal memuat riwayat transaksi.')
    } finally { setTransactionsLoading(false) }
  }

` + handlerAnchor)
const oldButton = "onClick={()=>action('Checkout is not enabled yet. A verified payment provider and server-side webhook must be configured before accepting payments.')}>Select plan <ArrowRight size={14}/></button>"
if (!s.includes(oldButton)) throw new Error('Tombol checkout placeholder tidak ditemukan.')
s = s.replace(oldButton, "onClick={()=>void handleCheckout(p.name)} disabled={paymentBusyPlan!==null}>{paymentBusyPlan===p.name?'Preparing checkout…':'Select plan'} <ArrowRight size={14}/></button>")
const oldTx = `{page === 'Transactions' && <><PageIntro kicker="09 / ACCOUNT RECORDS" title="Transaction history." desc="No real transactions are available. The table below is intentionally empty until a verified backend is configured."/><div className="glass-panel transactions-panel"><div className="panel-heading"><div><span className="section-kicker">FINANCIAL RECORDS</span><h3>All transactions</h3></div><button className="button button-outline" onClick={()=>action('No transaction records exist in this frontend preview.')}><Filter size={14}/> Filter</button></div><div className="table-header transaction-head"><span>REFERENCE</span><span>DESCRIPTION</span><span>DATE</span><span>AMOUNT</span><span>STATUS</span></div><div className="empty-state large-empty"><div className="empty-icon"><FileText size={22}/></div><b>No transaction records</b><span>Transactions will appear here after a real payment and secure backend integration are implemented.</span></div></div></>}`
const newTx = `{page === 'Transactions' && <><PageIntro kicker="09 / ACCOUNT RECORDS" title="Transaction history." desc="Riwayat pembayaran milik akun yang sedang login. Status paid hanya ditetapkan setelah diverifikasi server."/><div className="glass-panel transactions-panel"><div className="panel-heading"><div><span className="section-kicker">FINANCIAL RECORDS</span><h3>My transactions</h3></div><button className="button button-outline" disabled={transactionsLoading} onClick={()=>void loadTransactions()}><Filter size={14}/>{transactionsLoading?'Loading…':'Refresh'}</button></div><div className="table-header transaction-head"><span>REFERENCE</span><span>DESCRIPTION</span><span>DATE</span><span>AMOUNT</span><span>STATUS</span></div>{transactionsLoading ? <div className="empty-state large-empty"><b>Loading transactions…</b></div> : transactions.length===0 ? <div className="empty-state large-empty"><div className="empty-icon"><FileText size={22}/></div><b>No transaction records</b><span>Login lalu tekan Refresh untuk memuat riwayat pembayaran akun lu.</span></div> : <div className="transaction-list">{transactions.map(tx=><div className="table-row transaction-head" key={tx.order_id}><span>{tx.order_id}</span><span>{tx.plan} · {tx.billing_period}</span><span>{new Date(tx.created_at).toLocaleDateString('id-ID')}</span><span>Rp {Number(tx.amount).toLocaleString('id-ID')}</span><span><Pill tone={tx.status==='paid'?'positive':tx.status==='failed'||tx.status==='expired'||tx.status==='cancelled'?'negative':'neutral'}>{tx.status.toUpperCase()}</Pill></span></div>)}</div>}</div></>}`
if (!s.includes(oldTx)) throw new Error('Placeholder halaman Transactions tidak ditemukan.')
s = s.replace(oldTx, newTx)
fs.writeFileSync(path, s)
console.log('Frontend payment integration patched in src/App.tsx')
