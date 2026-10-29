import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BookOpen, CalendarDays,
  Check, ChevronDown, CircleHelp, Command, Compass, Crown, Eye, FileText, Filter,
  Globe2, GraduationCap, LayoutDashboard, LockKeyhole, LogIn, Menu, MoreHorizontal,
  Newspaper, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Star,
  TrendingUp, Wallet, X, Zap
} from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { instruments, lessons, news } from './data/demo'
import { supabase } from './lib/supabase'

type Page = 'Overview' | 'Market' | 'News & Calendar' | 'Academy' | 'Analysis' | 'About' | 'Membership' | 'Login / Register' | 'Admin Panel' | 'Transactions'

type LiveStatus = 'CONNECTING' | 'LIVE' | 'DAILY' | 'UNAVAILABLE'

type AdminMember = {
  id: string
  full_name: string | null
  role: string
  created_at: string
  plan: string | null
  status: string | null
  starts_at: string | null
  ends_at: string | null
  payment_reference: string | null
}

const nav: { label: Page; icon: typeof LayoutDashboard; group: string }[] = [
  { label: 'Overview', icon: LayoutDashboard, group: 'PLATFORM' },
  { label: 'Market', icon: Activity, group: 'PLATFORM' },
  { label: 'News & Calendar', icon: CalendarDays, group: 'PLATFORM' },
  { label: 'Academy', icon: GraduationCap, group: 'LEARN' },
  { label: 'Analysis', icon: TrendingUp, group: 'LEARN' },
  { label: 'About', icon: Compass, group: 'LEARN' },
  { label: 'Membership', icon: Crown, group: 'ACCOUNT' },
  { label: 'Login / Register', icon: LogIn, group: 'ACCOUNT' },
  { label: 'Admin Panel', icon: ShieldCheck, group: 'PREVIEW' },
  { label: 'Transactions', icon: Wallet, group: 'PREVIEW' },
]

const numberPrice = (n: number, digits = 2) => n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

function initialMarketItems() {
  return instruments.map(item => ({ ...item, price: 'Connecting…', change: '—', status: 'CONNECTING' as LiveStatus, points: item.points }))
}

function Logo({ small = false }: { small?: boolean }) {
  return <div className={`brand-lockup ${small ? 'brand-small' : ''}`}><img src="/veltrix-warfare-logo.jpg" alt="VELTRIX WARFARE — Discipline Over Emotion" /><div className="brand-fallback"><span>V</span><b>VELTRIX</b><small>WARFARE</small></div></div>
}

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  const pts = values.map((v, i) => `${i * (100 / (values.length - 1))},${35 - v}`).join(' ')
  return <svg className="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none"><polyline points={pts} fill="none" stroke={positive ? '#bfc4ca' : '#888f99'} strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg>
}

function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'positive' | 'negative' | 'silver' }) {
  return <span className={`pill ${tone}`}>{children}</span>
}

export default function App() {
  const [page, setPage] = useState<Page>('Overview')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [timeframe, setTimeframe] = useState('1D')
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('vw-watchlist')
      return saved ? JSON.parse(saved) as string[] : ['XAUUSD', 'EURUSD', 'USDJPY']
    } catch {
      return ['XAUUSD', 'EURUSD', 'USDJPY']
    }
  })
  const [marketInstruments, setMarketInstruments] = useState(initialMarketItems)
  const [marketUpdatedAt, setMarketUpdatedAt] = useState<string>('Connecting to market sources…')
  const [marketConnection, setMarketConnection] = useState<'CONNECTING' | 'CONNECTED' | 'PARTIAL' | 'OFFLINE'>('CONNECTING')
  const [lessonFilter, setLessonFilter] = useState('All')
  const [notice, setNotice] = useState('')
  const [authMode, setAuthMode] = useState<'Login' | 'Create account'>('Login')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminAuthorized, setAdminAuthorized] = useState(false)
  const [adminMembers, setAdminMembers] = useState<AdminMember[]>([])
  const [adminError, setAdminError] = useState('')
  const [adminBusyUser, setAdminBusyUser] = useState<string | null>(null)
  const [membershipAccess, setMembershipAccess] = useState<{ active: boolean; plan: string | null; ends_at: string | null }>({ active: false, plan: null, ends_at: null })
  const [membershipLoading, setMembershipLoading] = useState(false)
  const [billing, setBilling] = useState<'Monthly' | 'Yearly'>('Monthly')
  const [paymentBusyPlan, setPaymentBusyPlan] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [transactions, setTransactions] = useState<Array<{ order_id: string; plan: string; billing_period: string; amount: number; currency: string; status: string; payment_method: string; created_at: string; paid_at: string | null }>>([])
  const [transactionsLoading, setTransactionsLoading] = useState(false)

  const filteredInstruments = useMemo(() => marketInstruments.filter(i => (category === 'All' || i.category === category) && `${i.symbol} ${i.name}`.toLowerCase().includes(search.toLowerCase())), [marketInstruments, category, search])
  const filteredLessons = lessons.filter(l => lessonFilter === 'All' || l.level === lessonFilter)

  const action = (message: string) => setNotice(message)
  const toggleWatch = (symbol: string) => setWatchlist(old => old.includes(symbol) ? old.filter(s => s !== symbol) : [...old, symbol])

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

  const go = (next: Page) => {
    setMobileOpen(false)
    if ((next === 'Academy' || next === 'Analysis') && membershipLoading) {
      setNotice('Sedang memeriksa status membership. Coba lagi sebentar.')
      return
    }
    if (next === 'Academy' && !membershipAccess.active) {
      setPage('Membership')
      setNotice(signedInEmail ? 'Akses Academy memerlukan membership aktif. Pilih paket atau hubungi admin.' : 'Login dan aktifkan membership untuk membuka Academy.')
      return
    }
    if (next === 'Analysis' && (!membershipAccess.active || membershipAccess.plan === 'Essential')) {
      setPage('Membership')
      setNotice(!signedInEmail
        ? 'Login dan aktifkan membership untuk membuka Analysis.'
        : !membershipAccess.active
          ? 'Akses Analysis memerlukan membership aktif.'
          : 'Analysis tersedia untuk paket Advanced dan Private.')
      return
    }
    setPage(next)
    setNotice('')
  }

  useEffect(() => {
    if (!supabase || !signedInEmail) {
      setMembershipAccess({ active: false, plan: null, ends_at: null })
      setMembershipLoading(false)
      return
    }

    let alive = true
    setMembershipLoading(true)
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('current_membership_access')
        if (!alive) return
        if (error) {
          setMembershipAccess({ active: false, plan: null, ends_at: null })
          setNotice(`Gagal memeriksa akses membership: ${error.message}`)
          return
        }
        const row = Array.isArray(data) ? data[0] : data
        setMembershipAccess({
          active: row?.is_active === true,
          plan: row?.plan ?? null,
          ends_at: row?.ends_at ?? null,
        })
      } catch (error: unknown) {
        if (!alive) return
        setMembershipAccess({ active: false, plan: null, ends_at: null })
        setNotice(error instanceof Error ? error.message : 'Gagal memeriksa akses membership.')
      } finally {
        if (alive) setMembershipLoading(false)
      }
    })()

    return () => { alive = false }
  }, [signedInEmail])

  useEffect(() => {
    if (page === 'Transactions') void loadTransactions()
  }, [page, signedInEmail])

  const title = page === 'Overview' ? 'Market overview' : page

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <Logo small />
          <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={17} /></button>
        </div>
        <div className="workspace-label"><span className="workspace-dot" /><span>TRADING WORKSPACE</span><ChevronDown size={13} /></div>
        {['PLATFORM', 'LEARN', 'ACCOUNT', 'PREVIEW'].map(group => (
          <div className="nav-group" key={group}>
            <div className="nav-caption">{group}</div>
            {nav.filter(n => n.group === group).map(item => {
              const Icon = item.icon
              return (
                <button key={item.label} onClick={() => go(item.label)} className={`nav-link ${page === item.label ? 'active' : ''}`}>
                  <Icon size={16} />
                  <span>{item.label}</span>
                  {item.label === 'Admin Panel' && <span className="tiny-label">ADMIN</span>}
                </button>
              )
            })}
          </div>
        ))}
      </aside>

      {mobileOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-trigger" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div className="breadcrumb"><span>VELTRIX</span><span className="crumb-slash">/</span><b>{title}</b></div>
          <div className="topbar-actions">
            <label className="global-search"><Search size={15} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search platform..." /></label>
            <span className="demo-chip">{marketConnection === 'CONNECTED' ? 'MARKET CONNECTED' : marketConnection === 'PARTIAL' ? 'PARTIAL MARKET DATA' : marketConnection === 'OFFLINE' ? 'MARKET OFFLINE' : 'CONNECTING'}</span>
            <button className="icon-button" onClick={() => action('Tidak ada notifikasi baru.')} aria-label="Notifications"><Bell size={17} /></button>
            <button className="avatar" onClick={() => go('Login / Register')}>V</button>
          </div>
        </header>

        <div className="page-content">
          {notice && <div className="notice"><CircleHelp size={16} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15} /></button></div>}

          {page === 'Membership' && (
            <div className="billing-row">
              <div className="segmented">
                {(['Monthly', 'Yearly'] as const).map(b => (
                  <button key={b} className={billing === b ? 'selected' : ''} onClick={() => setBilling(b)}>{b === 'Yearly' ? 'Yearly · Save 20%' : 'Monthly'}</button>
                ))}
              </div>

              <div className="pricing-grid">
                {['Essential', 'Advanced', 'Private'].map((plan, index) => {
                  const featured = plan === 'Advanced'
                  const price = plan === 'Essential' ? (billing === 'Monthly' ? '79k' : '758k') : plan === 'Advanced' ? (billing === 'Monthly' ? '149k' : '1.43m') : (billing === 'Monthly' ? '299k' : '2.87m')
                  const features = plan === 'Essential'
                    ? ['Market overview', 'Learning library', 'Basic market notes']
                    : plan === 'Advanced'
                      ? ['Everything in Essential', 'Extended analysis library', 'Scenario frameworks', 'Advanced learning paths']
                      : ['Everything in Advanced', 'Premium research layout', 'Priority content access', 'Member features (planned)']

                  return (
                    <div className={`glass-panel price-card ${featured ? 'featured' : ''}`} key={plan}>
                      <span className="section-kicker">{plan.toUpperCase()} ACCESS</span>
                      <h3>{plan}</h3>
                      <p>{plan === 'Essential' ? 'A focused starting point.' : plan === 'Advanced' ? 'For a more structured workflow.' : 'A comprehensive platform concept.'}</p>
                      <div className="price"><b>Rp {price}</b><span>/{billing === 'Monthly' ? 'month' : 'year'}</span></div>
                      <div className="price-divider" />
                      {features.map(feature => <div className="feature-check" key={feature}><Check size={15} />{feature}</div>)}
                      <button
                        className={`button ${featured ? 'button-primary' : 'button-outline'} full-button`}
                        onClick={() => void handleCheckout(plan)}
                        disabled={paymentBusyPlan !== null}
                      >
                        {paymentBusyPlan === plan ? 'Preparing checkout…' : 'Select plan'} <ArrowRight size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {page === 'Transactions' && (
            <div className="glass-panel transactions-panel">
              <div className="panel-heading">
                <div><span className="section-kicker">FINANCIAL RECORDS</span><h3>Payment transactions</h3></div>
                <button className="button button-outline" onClick={() => void loadTransactions()}><Filter size={14} /> Refresh</button>
              </div>

              {transactionsLoading ? (
                <div className="empty-state large-empty"><b>Loading payment history…</b></div>
              ) : transactions.length === 0 ? (
                <div className="empty-state large-empty">
                  <div className="empty-icon"><FileText size={22} /></div>
                  <b>No transaction records</b>
                  <span>Transactions will appear here once the backend verifies a checkout request.</span>
                </div>
              ) : (
                <div className="table-header transaction-head">
                  <span>REFERENCE</span>
                  <span>PLAN</span>
                  <span>DATE</span>
                  <span>AMOUNT</span>
                  <span>STATUS</span>
                </div>
              )}

              {transactions.map(tx => (
                <div className="table-row transaction-row" key={tx.order_id}>
                  <span>{tx.order_id}</span>
                  <span>{tx.plan}</span>
                  <span>{new Date(tx.created_at).toLocaleString()}</span>
                  <span>{tx.currency} {tx.amount}</span>
                  <span>{tx.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function PageIntro({ kicker, title, desc }: { kicker: string; title: string; desc: string }) {
  return <section className="page-intro"><span className="section-kicker">{kicker}</span><h1>{title}</h1><p>{desc}</p></section>
}

