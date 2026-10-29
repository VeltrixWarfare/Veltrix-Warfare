  const [membershipAccess, setMembershipAccess] = useState<{ active: boolean; plan: string | null; ends_at: string | null }>({ active: false, plan: null, ends_at: null })
  const [membershipLoading, setMembershipLoading] = useState(false)
  const [billing, setBilling] = useState<'Monthly' | 'Yearly'>('Monthly')
  const [paymentBusyPlan, setPaymentBusyPlan] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const handleCheckout = async (plan: string) => {
    if (!supabase) {
      action('Supabase belum terkonfigurasi. Periksa environment variables Vercel.')
      return
    }

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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan, billing }),
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.redirect_url) {
        throw new Error(result.error || 'Checkout gagal dibuat.')
      }

      window.location.assign(result.redirect_url)
    } catch (error) {
      action(error instanceof Error ? error.message : 'Gagal memulai checkout.')
    } finally {
      setPaymentBusyPlan(null)
    }
  }

  const loadTransactions = async () => {
    if (!supabase) {
      action('Supabase belum terkonfigurasi.')
      return
    }

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
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
      })

      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Gagal memuat transaksi.')
      setTransactions(Array.isArray(result.transactions) ? result.transactions : [])
    } catch (error) {
      action(error instanceof Error ? error.message : 'Gagal memuat riwayat transaksi.')
    } finally {
      setTransactionsLoading(false)
    }
  }

  const [transactions, setTransactions] = useState<Array<{ order_id: string; plan: string; billing_period: string; amount: number; currency: string; status: string; payment_method: string; created_at: string; paid_at: string | null }>>([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)
