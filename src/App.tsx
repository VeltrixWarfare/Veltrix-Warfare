import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Command,
  Compass,
  Crown,
  Eye,
  FileText,
  Filter,
  Globe2,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  LogIn,
  Menu,
  MoreHorizontal,
  Newspaper,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  TrendingUp,
  Wallet,
  X,
  Zap,
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

const chartData = Array.from({ length: 28 }, (_, i) => ({ time: `${i + 1}`, value: 40 + Math.sin(i * 0.72) * 8 + i * 1.15 + Math.cos(i * 0.3) * 4 }))
const fmt = (s: string) => s
const numberPrice = (n: number, digits = 2) => n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

function initialMarketItems() {
  return instruments.map(item => ({ ...item, price: 'Connecting…', change: '—', status: 'CONNECTING' as LiveStatus, points: item.points }))
}

function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`brand-lockup ${small ? 'brand-small' : ''}`}>
      <img src="/veltrix-warfare-logo.jpg" alt="VELTRIX WARFARE — Discipline Over Emotion" />
      <div className="brand-fallback">
        <span>V</span>
        <b>VELTRIX</b>
        <small>WARFARE</small>
      </div>
    </div>
  )
}

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  const pts = values.map((v, i) => `${i * (100 / (values.length - 1))},${35 - v}`).join(' ')
  return (
    <svg className="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={positive ? '#bfc4ca' : '#888f99'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
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
      return saved ? (JSON.parse(saved) as string[]) : ['XAUUSD', 'EURUSD', 'USDJPY']
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

  const filteredInstruments = useMemo(
    () => marketInstruments.filter(item => (category === 'All' || item.category === category) && `${item.symbol} ${item.name}`.toLowerCase().includes(search.toLowerCase())),
    [marketInstruments, category, search],
  )
  const filteredLessons = lessons.filter(item => lessonFilter === 'All' || item.level === lessonFilter)

  const action = (message: string) => setNotice(message)
  const toggleWatch = (symbol: string) => {
    setWatchlist(current => current.includes(symbol) ? current.filter(item => item !== symbol) : [...current, symbol])
  }

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!supabase) {
      action('Supabase belum terkonfigurasi. Periksa environment variables Vercel.')
      return
    }

    setAuthBusy(true)
    setNotice('')

    try {
      if (authMode === 'Login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        })
        if (error) throw error
        action('Login berhasil. Akun lu sudah terhubung.')
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: authEmail.trim(),
          password: authPassword,
          options: { data: { full_name: authName.trim() } },
        })
        if (error) throw error
        action(data.session ? 'Registrasi berhasil. Akun lu sudah aktif.' : 'Registrasi berhasil. Cek email lu untuk konfirmasi akun sebelum login.')
      }
    } catch (error) {
      action(error instanceof Error ? error.message : 'Terjadi kesalahan autentikasi.')
    } finally {
      setAuthBusy(false)
    }
  }

  const loadAdminData = async () => {
    if (!supabase) {
      setAdminError('Supabase belum dikonfigurasi. Periksa environment variables Vercel.')
      setAdminAuthorized(false)
      return
    }

    setAdminLoading(true)
    setAdminError('')

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) {
        setAdminAuthorized(false)
        setAdminMembers([])
        setAdminError('Login terlebih dahulu menggunakan akun admin.')
        return
      }

      const { data: allowed, error: roleError } = await supabase.rpc('is_admin')
      if (roleError) throw new Error(`Pemeriksaan hak admin gagal: ${roleError.message}`)
      if (allowed !== true) {
        setAdminAuthorized(false)
        setAdminMembers([])
        setAdminError('Akses ditolak. Akun ini belum memiliki role admin di database.')
        return
      }

      setAdminAuthorized(true)
      const { data, error } = await supabase.rpc('admin_list_memberships')
      if (error) throw new Error(`Gagal memuat daftar membership: ${error.message}`)
      setAdminMembers((data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id ?? ''),
        full_name: typeof row.full_name === 'string' ? row.full_name : null,
        role: String(row.role ?? ''),
        created_at: String(row.created_at ?? ''),
        plan: typeof row.plan === 'string' ? row.plan : null,
        status: typeof row.status === 'string' ? row.status : null,
        starts_at: typeof row.starts_at === 'string' ? row.starts_at : null,
        ends_at: typeof row.ends_at === 'string' ? row.ends_at : null,
        payment_reference: typeof row.payment_reference === 'string' ? row.payment_reference : null,
      })))
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : String(error))
    } finally {
      setAdminLoading(false)
    }
  }

  const editAdminMember = (memberId: string, changes: Partial<AdminMember>) => {
    setAdminMembers(current => current.map(member => member.id === memberId ? { ...member, ...changes } : member))
  }

  const updateAdminMember = async (member: AdminMember) => {
    if (!supabase || !adminAuthorized) return
    setAdminBusyUser(member.id)
    setAdminError('')

    try {
      const { error } = await supabase.rpc('admin_save_membership', {
        p_user_id: member.id,
        p_plan: member.plan || 'Essential',
        p_status: member.status || 'inactive',
        p_starts_at: member.starts_at || null,
        p_ends_at: member.ends_at || null,
        p_payment_reference: member.payment_reference?.trim() || null,
      })
      if (error) throw new Error(`Gagal menyimpan membership: ${error.message}`)
      action(`Membership ${member.full_name || member.id.slice(0, 8)} berhasil disimpan.`)
      await loadAdminData()
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.error('Membership save failed:', error)
      setAdminError(detail)
    } finally {
      setAdminBusyUser(null)
    }
  }

  const handlePasswordReset = async () => {
    if (!supabase) {
      action('Supabase belum terkonfigurasi.')
      return
    }
    if (!authEmail.trim()) {
      action('Masukkan email lu terlebih dahulu untuk reset password.')
      return
    }

    setAuthBusy(true)
    setNotice('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim(), { redirectTo: window.location.origin })
      if (error) throw error
      action('Jika email terdaftar, instruksi reset password akan dikirim ke email tersebut.')
    } catch (error) {
      action(error instanceof Error ? error.message : 'Permintaan reset password gagal.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleLogout = async () => {
    if (!supabase) return
    setAuthBusy(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      action('Lu berhasil logout.')
    } catch (error) {
      action(error instanceof Error ? error.message : 'Logout gagal.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handleCheckout = (plan: string) => {
    if (paymentBusyPlan !== null) return

    if (!supabase) {
      action('Supabase belum terkonfigurasi. Periksa environment variables Vercel.')
      setPage('Login / Register')
      return
    }

    if (!signedInEmail) {
      action('Login dulu sebelum memilih paket membership.')
      setPage('Login / Register')
      return
    }

    setPaymentBusyPlan(plan)
    setNotice('')
    action('Checkout is not enabled yet. A verified payment provider and server-side webhook must be configured before accepting payments.')
    setPaymentBusyPlan(null)
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
    if (page === 'Admin Panel') void loadAdminData()
  }, [page, signedInEmail])

  useEffect(() => {
    try {
      localStorage.setItem('vw-watchlist', JSON.stringify(watchlist))
    } catch {
      // storage may be unavailable
    }
  }, [watchlist])

  useEffect(() => {
    if (!supabase) return

    let active = true
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) {
        setNotice('Gagal memeriksa sesi login.')
        return
      }
      setSignedInEmail(data.session?.user.email ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedInEmail(session?.user.email ?? null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let alive = true

    const refreshMarket = async () => {
      const next = initialMarketItems()
      let successes = 0

      const update = (symbol: string, values: Partial<(typeof next)[number]>) => {
        const index = next.findIndex(item => item.symbol === symbol)
        if (index >= 0) next[index] = { ...next[index], ...values }
      }

      const safeJson = async (url: string) => {
        const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
        if (!response.ok) throw new Error(`Market source returned ${response.status}`)
        return response.json()
      }

      await Promise.allSettled([
        safeJson('https://api.gold-api.com/price/XAU').then((data: Record<string, unknown>) => {
          const price = Number(data?.price ?? data?.price_usd ?? data?.rate)
          if (!Number.isFinite(price) || price <= 0) throw new Error('Invalid gold quote')
          update('XAUUSD', { price: numberPrice(price), change: 'LIVE SPOT', positive: true, status: 'LIVE', points: [4, 7, 5, 10, 8, 13, 12, 17, 14, 21, 19, 24, 22, 28] })
          successes += 1
        }),
        safeJson('https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT').then((data: Record<string, unknown>) => {
          const price = Number(data?.lastPrice)
          const pct = Number(data?.priceChangePercent)
          if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(pct)) throw new Error('Invalid crypto quote')
          update('BTCUSD', { price: numberPrice(price), change: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% · 24H`, positive: pct >= 0, status: 'LIVE' })
          successes += 1
        }),
        safeJson('https://open.er-api.com/v6/latest/USD').then((data: Record<string, unknown>) => {
          const rates = data?.rates as Record<string, number> | undefined
          if (data?.result !== 'success' || !rates) throw new Error('Invalid FX quote')
          const eur = Number(rates.EUR)
          const gbp = Number(rates.GBP)
          const jpy = Number(rates.JPY)
          if (eur > 0) {
            update('EURUSD', { price: numberPrice(1 / eur, 4), change: 'DAILY FX', positive: true, status: 'DAILY' })
            successes += 1
          }
          if (gbp > 0) {
            update('GBPUSD', { price: numberPrice(1 / gbp, 4), change: 'DAILY FX', positive: true, status: 'DAILY' })
            successes += 1
          }
          if (jpy > 0) {
            update('USDJPY', { price: numberPrice(jpy, 2), change: 'DAILY FX', positive: true, status: 'DAILY' })
            successes += 1
          }
        }),
      ])

      if (!alive) return

      const hasLive = next.some(item => item.status === 'LIVE')
      setMarketInstruments(next.map(item => item.status === 'CONNECTING' ? { ...item, price: 'Unavailable', change: 'NO FEED', status: 'UNAVAILABLE' as LiveStatus } : item))
      setMarketConnection(successes === 0 ? 'OFFLINE' : hasLive && successes >= 2 ? 'CONNECTED' : 'PARTIAL')
      setMarketUpdatedAt(`Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
    }

    void refreshMarket()
    const timer = window.setInterval(() => { void refreshMarket() }, 60_000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  const title = page === 'Overview' ? 'Market overview' : page

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <Logo small />
          <button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
            <X size={17} />
          </button>
        </div>

        <div className="workspace-label">
          <span className="workspace-dot" />
          <span>TRADING WORKSPACE</span>
          <ChevronDown size={13} />
        </div>

        {['PLATFORM', 'LEARN', 'ACCOUNT', 'PREVIEW'].map(group => (
          <div className="nav-group" key={group}>
            <div className="nav-caption">{group}</div>
            {nav.filter(item => item.group === group).map(item => {
              const Icon = item.icon
              return (
                <button key={item.label} onClick={() => go(item.label)} className={`nav-link ${page === item.label ? 'active' : ''}`}>
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        ))}

        <div className="sidebar-bottom">
          <div className="discipline-card">
            <div className="discipline-mark"><Zap size={16} /></div>
            <div>
              <b>Discipline over emotion.</b>
              <span>Build your process.</span>
            </div>
          </div>
          <div className="sidebar-footer">
            <span className="status-dot" /> Frontend preview <span className="version">v1.0</span>
          </div>
        </div>
      </aside>

      {mobileOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-trigger" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu size={19} />
          </button>
          <div className="breadcrumb">
            <span>VELTRIX</span>
            <span className="crumb-slash">/</span>
            <b>{title}</b>
          </div>
          <div className="topbar-actions">
            <label className="global-search">
              <Search size={15} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search platform..." />
            </label>
            <button className="icon-button" aria-label="Alerts"><Bell size={16} /></button>
            <button className="icon-button" aria-label="More actions"><MoreHorizontal size={16} /></button>
          </div>
        </header>

        <div className="page-content">
          {notice && (
            <div className="notice">
              <CircleHelp size={16} />
              <span>{notice}</span>
              <button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15} /></button>
            </div>
          )}

          {page === 'Overview' && (
            <>
              <section className="welcome-row">
                <div>
                  <div className="eyebrow"><span className="eyebrow-line" /> VELTRIX WARFARE <span className="eyebrow-muted">/ MARKET TERMINAL</span></div>
                  <h1>Clarity is a competitive advantage.</h1>
                  <p>Track markets, organize structure, and build a disciplined process with cleaner context.</p>
                </div>
                <div className="header-summary">
                  <div className="mini-metric">
                    <span>Feed status</span>
                    <b>{marketConnection}</b>
                  </div>
                  <div className="mini-metric">
                    <span>Updated</span>
                    <b>{marketUpdatedAt}</b>
                  </div>
                </div>
              </section>

              <div className="demo-banner">
                <span className="demo-banner-icon"><Activity size={16} /></span>
                <div>
                  <b>Market data status</b>
                  <span>Gold spot and crypto quotes use live public feeds where available. FX data is refreshed automatically.</span>
                </div>
              </div>

              <section className="section-block">
                <div className="section-heading">
                  <div>
                    <span className="section-kicker">01 / THE MARKET</span>
                    <h2>Market snapshot</h2>
                  </div>
                  <button className="text-link">View all</button>
                </div>
                <div className="market-grid">
                  {marketInstruments.slice(0, 4).map(item => (
                    <div className="market-card glass-panel" key={item.symbol}>
                      <div className="market-card-top">
                        <span className="ticker">{item.symbol}</span>
                        <Pill tone={item.positive ? 'positive' : 'negative'}>{item.change}</Pill>
                      </div>
                      <div className="market-card-body">
                        <b>{item.name}</b>
                        <strong>{item.price}</strong>
                      </div>
                      <Sparkline values={item.points} positive={item.positive} />
                    </div>
                  ))}
                </div>
              </section>

              <section className="dashboard-grid">
                <div className="glass-panel chart-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">02 / PRICE ACTION</span>
                      <h3>Market move</h3>
                    </div>
                    <div className="segmented small">
                      {['1D', '1W', '1M'].map(value => (
                        <button key={value} className={timeframe === value ? 'selected' : ''} onClick={() => setTimeframe(value)}>{value}</button>
                      ))}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="5%" stopColor="#c8d1db" stopOpacity={0.7} />
                          <stop offset="95%" stopColor="#c8d1db" stopOpacity={0.1} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="time" tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="value" stroke="#dfe5eb" fill="url(#areaFill)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="glass-panel watch-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">03 / TRACKING</span>
                      <h3>Your watchlist</h3>
                    </div>
                    <button className="icon-button" aria-label="Search markets"><Eye size={15} /></button>
                  </div>
                  <div className="watchlist-box">
                    {watchlist.map(symbol => (
                      <button key={symbol} className="watch-chip" onClick={() => toggleWatch(symbol)}>
                        <span>{symbol}</span>
                        <X size={12} />
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="bottom-grid">
                <div className="glass-panel news-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-kicker">04 / LATEST UPDATES</span>
                      <h3>Research & education</h3>
                    </div>
                  </div>
                  <div className="news-list">
                    {news.map(item => (
                      <div className="news-item" key={`${item.time}-${item.title}`}>
                        <span>{item.time}</span>
                        <div>
                          <b>{item.title}</b>
                          <small>{item.tag} · {item.impact}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}

          {page === 'Market' && (
            <>
              <PageIntro kicker="01 / MARKET TERMINAL" title="Observe the market." desc="Track selected instruments and explore the chart interface." />
              <div className="market-toolbar">
                <div className="toolbar-group">
                  <label>
                    <Search size={14} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search instruments" />
                  </label>
                  <select value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="All">All</option>
                    <option value="Metals">Metals</option>
                    <option value="Forex">Forex</option>
                    <option value="Crypto">Crypto</option>
                  </select>
                </div>
              </div>
              <div className="market-grid large">
                {filteredInstruments.map(item => (
                  <div className="market-card glass-panel" key={item.symbol}>
                    <div className="market-card-top">
                      <span className="ticker">{item.symbol}</span>
                      <button className="icon-button ghost" onClick={() => toggleWatch(item.symbol)} aria-label="Toggle watchlist">
                        <Star size={14} />
                      </button>
                    </div>
                    <div className="market-card-body">
                      <b>{item.name}</b>
                      <strong>{item.price}</strong>
                    </div>
                    <Sparkline values={item.points} positive={item.positive} />
                  </div>
                ))}
              </div>
            </>
          )}

          {page === 'News & Calendar' && (
            <>
              <PageIntro kicker="02 / INFORMATION" title="Stay informed. Stay objective." desc="A structured view for educational notes and economic-calendar layout." />
              <div className="news-grid">
                {news.map(item => (
                  <div className="glass-panel content-panel" key={`${item.time}-${item.title}`}>
                    <div className="panel-heading"><h3>{item.title}</h3><Pill tone="silver">{item.tag}</Pill></div>
                    <p>{item.impact} impact · {item.time}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {page === 'Academy' && (
            <>
              <PageIntro kicker="03 / LEARNING" title="Build your trading foundation." desc="Structured learning paths designed to strengthen process and market understanding." />
              <div className="academy-toolbar">
                <div className="segmented">
                  {['All', 'Beginner', 'Intermediate'].map(level => (
                    <button key={level} className={lessonFilter === level ? 'selected' : ''} onClick={() => setLessonFilter(level)}>{level}</button>
                  ))}
                </div>
              </div>
              <div className="academy-grid">
                {filteredLessons.map(lesson => (
                  <div className="glass-panel content-panel" key={lesson.title}>
                    <div className="panel-heading">
                      <div>
                        <span className="section-kicker">COURSE</span>
                        <h3>{lesson.title}</h3>
                      </div>
                      <Pill tone="silver">{lesson.level}</Pill>
                    </div>
                    <p>{lesson.desc}</p>
                    <small>{lesson.duration}</small>
                  </div>
                ))}
              </div>
            </>
          )}

          {page === 'Analysis' && (
            <>
              <PageIntro kicker="04 / TRADING INSIGHTS" title="Separate signal from noise." desc="An organized framework for reading market structure and building scenario-based decisions." />
              <div className="analysis-grid">
                <div className="glass-panel content-panel">
                  <h3>Trend context</h3>
                  <p>Focus on higher time-frame structure before engaging in tactical entries.</p>
                </div>
                <div className="glass-panel content-panel">
                  <h3>Risk framing</h3>
                  <p>Map invalidation, positioning, and execution before taking a trade.</p>
                </div>
              </div>
            </>
          )}

          {page === 'About' && (
            <>
              <PageIntro kicker="05 / OUR PHILOSOPHY" title="A framework built on discipline." desc="VELTRIX WARFARE is a concept for a structured trading and education workspace — clear, intentional, and process-driven." />
              <div className="about-grid">
                <div className="glass-panel content-panel">
                  <div className="panel-heading"><h3>Mission</h3><Sparkles size={16} /></div>
                  <p>To help traders build more consistent decision-making by organizing market context, education, and execution plans in one place.</p>
                </div>
                <div className="glass-panel content-panel">
                  <div className="panel-heading"><h3>Principles</h3><ShieldCheck size={16} /></div>
                  <ul className="about-list">
                    <li>Discipline over emotion</li>
                    <li>Process before prediction</li>
                    <li>Risk defined before action</li>
                    <li>Structure beats noise</li>
                  </ul>
                </div>
              </div>
            </>
          )}

          {page === 'Membership' && (
            <>
              <PageIntro kicker="06 / MEMBERSHIP" title="Choose your level of access." desc="Status membership diperiksa melalui database. Pembayaran otomatis belum aktif; admin harus mengonfirmasi paket untuk akses tertentu." />
              <div className="billing-row">
                <div className="segmented">
                  {(['Monthly', 'Yearly'] as const).map(option => (
                    <button key={option} className={billing === option ? 'selected' : ''} onClick={() => setBilling(option)}>
                      {option === 'Yearly' ? 'Yearly · Save 20%' : 'Monthly'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pricing-grid">
                {['Essential', 'Advanced', 'Private'].map(plan => {
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
                      <div className="price">
                        <b>Rp {price}</b>
                        <span>/{billing === 'Monthly' ? 'month' : 'year'}</span>
                      </div>
                      <div className="price-divider" />
                      {features.map(feature => (
                        <div className="feature-check" key={feature}>
                          <Check size={15} />
                          {feature}
                        </div>
                      ))}
                      <button
                        className={`button ${featured ? 'button-primary' : 'button-outline'} full-button`}
                        onClick={() => handleCheckout(plan)}
                        disabled={paymentBusyPlan !== null}
                      >
                        {paymentBusyPlan === plan ? 'Preparing checkout…' : 'Select plan'} <ArrowRight size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {page === 'Login / Register' && (
            <>
              <PageIntro kicker="07 / ACCOUNT ACCESS" title="Your workspace starts here." desc="Sign in or create your VELTRIX WARFARE account securely." />
              <div className="auth-grid">
                <div className="glass-panel content-panel auth-panel">
                  <div className="segmented compact">
                    <button className={authMode === 'Login' ? 'selected' : ''} onClick={() => setAuthMode('Login')}>Login</button>
                    <button className={authMode === 'Create account' ? 'selected' : ''} onClick={() => setAuthMode('Create account')}>Create account</button>
                  </div>

                  <form onSubmit={handleAuthSubmit} className="auth-form">
                    {authMode === 'Create account' && (
                      <label className="form-label">
                        Full name
                        <input value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Your name" />
                      </label>
                    )}

                    <label className="form-label">
                      Email
                      <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="you@example.com" />
                    </label>

                    <label className="form-label">
                      Password
                      <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="••••••••" />
                    </label>

                    <button type="submit" className="button button-primary full-button" disabled={authBusy}>
                      {authBusy ? 'Please wait…' : authMode === 'Login' ? 'Sign in' : 'Create account'}
                    </button>
                  </form>

                  <button className="button button-ghost full-button" onClick={handlePasswordReset} disabled={authBusy}>
                    Reset password
                  </button>
                </div>

                <div className="glass-panel content-panel auth-panel">
                  <div className="panel-heading"><h3>Workspace access</h3><LockKeyhole size={16} /></div>
                  <ul className="about-list">
                    <li>Secure account access</li>
                    <li>Membership status visibility</li>
                    <li>Admin room and member records</li>
                  </ul>
                </div>
              </div>
            </>
          )}

          {page === 'Admin Panel' && (
            <>
              <PageIntro kicker="08 / CONTROL ROOM" title="Administration control room." desc="Kelola akun dan status membership yang tersimpan di database. Semua perubahan memerlukan role admin yang valid." />
              {!adminAuthorized ? (
                <div className="glass-panel content-panel">
                  <div className="panel-heading">
                    <h3>Admin access required</h3>
                    <ShieldCheck size={18} />
                  </div>
                  <p className="muted">{adminError || 'Login dengan akun admin untuk menampilkan data membership.'}</p>
                </div>
              ) : (
                <>
                  <div className="demo-banner compact">
                    <ShieldCheck size={16} />
                    <span>ADMIN ACCESS VERIFIED · perubahan membership dicatat di Supabase.</span>
                    <button className="button button-outline" onClick={() => void loadAdminData()}>Refresh</button>
                  </div>

                  {adminError && (
                    <div className="demo-banner compact">
                      <CircleHelp size={16} />
                      <span>{adminError}</span>
                    </div>
                  )}

                  <div className="admin-metrics">
                    {[
                      { label: 'Registered members', value: String(adminMembers.length), note: 'Profiles in database' },
                      { label: 'Active memberships', value: String(adminMembers.filter(member => member.status === 'active').length), note: 'Active plans' },
                    ].map(item => (
                      <div className="glass-panel metric-box" key={item.label}>
                        <span>{item.label}</span>
                        <b>{item.value}</b>
                        <small>{item.note}</small>
                      </div>
                    ))}
                  </div>

                  <div className="glass-panel transactions-panel">
                    <div className="panel-heading">
                      <div>
                        <span className="section-kicker">MEMBER DIRECTORY</span>
                        <h3>Accounts & membership</h3>
                      </div>
                      <Pill tone="silver">SYNCED</Pill>
                    </div>

                    {adminLoading ? (
                      <div className="empty-state large-empty"><b>Loading member data…</b></div>
                    ) : adminMembers.length === 0 ? (
                      <div className="empty-state large-empty">
                        <div className="empty-icon"><FileText size={22} /></div>
                        <b>No member records</b>
                        <span>Admin data will appear here after a valid access check has been completed.</span>
                      </div>
                    ) : (
                      <div className="admin-list">
                        {adminMembers.map(member => (
                          <div className="admin-member-row" key={member.id}>
                            <div className="admin-member-info">
                              <b>{member.full_name || 'Unnamed member'}</b>
                              <small>{member.id.slice(0, 8)}… · joined {member.created_at ? new Date(member.created_at).toLocaleDateString() : 'N/A'}</small>
                            </div>

                            <div className="admin-member-actions">
                              <label className="form-label">Plan
                                <select value={member.plan || 'Essential'} onChange={e => editAdminMember(member.id, { plan: e.target.value })}>
                                  <option value="Essential">Essential</option>
                                  <option value="Advanced">Advanced</option>
                                  <option value="Private">Private</option>
                                </select>
                              </label>

                              <label className="form-label">Status
                                <select value={member.status || 'inactive'} onChange={e => editAdminMember(member.id, { status: e.target.value })}>
                                  <option value="inactive">Inactive</option>
                                  <option value="active">Active</option>
                                  <option value="trial">Trial</option>
                                </select>
                              </label>

                              <label className="form-label">Start date
                                <input type="date" value={member.starts_at ? member.starts_at.slice(0, 10) : ''} onChange={e => editAdminMember(member.id, { starts_at: e.target.value || null })} />
                              </label>

                              <label className="form-label">End date
                                <input type="date" value={member.ends_at ? member.ends_at.slice(0, 10) : ''} onChange={e => editAdminMember(member.id, { ends_at: e.target.value || null })} />
                              </label>

                              <label className="form-label">Payment reference
                                <input type="text" value={member.payment_reference || ''} onChange={e => editAdminMember(member.id, { payment_reference: e.target.value || null })} />
                              </label>

                              <button className="button button-primary" disabled={adminBusyUser === member.id || member.role === 'admin'} onClick={() => void updateAdminMember(member)}>
                                {adminBusyUser === member.id ? 'Saving…' : 'Save'}
                              </button>
                              {member.role === 'admin' && <small className="muted">Admin account dilindungi dari perubahan membership.</small>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {page === 'Transactions' && (
            <>
              <PageIntro kicker="09 / ACCOUNT RECORDS" title="Transaction history." desc="No real transactions are available. The table below reflects the current demo state and does not claim payment success." />
              <div className="glass-panel transactions-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-kicker">FINANCIAL RECORDS</span>
                    <h3>All transactions</h3>
                  </div>
                  <button className="button button-outline" onClick={() => action('Transaction history remains demo-only until a verified backend confirms a payment.')}> <Filter size={14} /> Filter</button>
                </div>
                <div className="table-header transaction-head">
                  <span>REFERENCE</span>
                  <span>DESCRIPTION</span>
                  <span>DATE</span>
                  <span>AMOUNT</span>
                  <span>STATUS</span>
                </div>
                <div className="empty-state large-empty">
                  <div className="empty-icon"><FileText size={22} /></div>
                  <b>No transaction records</b>
                  <span>Transactions will appear here only after a verified payment and secure backend confirmation are completed.</span>
                </div>
              </div>
            </>
          )}
        </div>

        <footer className="app-footer">
          <div>
            <Logo small />
            <span>© 2026 VELTRIX WARFARE</span>
          </div>
          <span className="footer-disclaimer">Frontend preview · Demo data · Not financial advice</span>
          <b>Live system status: demo mode</b>
        </footer>
      </main>
    </div>
  )
}

function PageIntro({ kicker, title, desc }: { kicker: string; title: string; desc: string }) {
  return (
    <section className="page-intro">
      <span className="section-kicker">{kicker}</span>
      <h1>{title}</h1>
      <p>{desc}</p>
    </section>
  )
}
