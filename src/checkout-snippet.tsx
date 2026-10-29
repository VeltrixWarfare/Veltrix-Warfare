// Integrate into src/App.tsx: add this handler inside App() and call it from each plan button.
const [checkoutBusyPlan, setCheckoutBusyPlan] = useState<string | null>(null)

const handleCheckout = async (plan: string, billing: 'Monthly' | 'Yearly') => {
  if (!supabase) {
    action('Supabase belum terkonfigurasi.')
    return
  }
  setCheckoutBusyPlan(`${plan}-${billing}`)
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      action('Login dulu sebelum checkout.')
      setPage('Login / Register')
      return
    }
    const response = await fetch('/api/payment/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ plan, billing }),
    })
    const result = await response.json()
    if (!response.ok || !result.redirect_url) throw new Error(result.error || 'Checkout gagal dibuat.')
    window.location.assign(result.redirect_url)
  } catch (error) {
    action(error instanceof Error ? error.message : 'Checkout gagal.')
  } finally {
    setCheckoutBusyPlan(null)
  }
}

// In the Membership JSX plan map, replace the existing Select plan button's onClick with:
// onClick={() => void handleCheckout(p.name, billing)}
// and its text with:
// {checkoutBusyPlan === `${p.name}-${billing}` ? 'Preparing checkout…' : 'Pay with QRIS'}
//
// IMPORTANT: Server-side prices in api/payment/create.ts must match the final public prices.
// Current values mirror the existing example UI and are NOT confirmed final prices.
