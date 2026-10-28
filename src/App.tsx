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
const chartData = Array.from({ length: 28 }, (_, i) => ({ time: `${i + 1}`, value: 40 + Math.sin(i * .72) * 8 + i * 1.15 + Math.cos(i * .3) * 4 }))
const fmt = (s: string) => s
const numberPrice = (n: number, digits = 2) => n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })

type LiveStatus = 'CONNECTING' | 'LIVE' | 'DAILY' | 'UNAVAILABLE'
type AdminMember = { id: string; full_name: string | null; role: string; created_at: string; plan: string | null; status: string | null; starts_at: string | null; ends_at: string | null; payment_reference: string | null }
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
function Pill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'positive' | 'negative' | 'silver' }) { return <span className={`pill ${tone}`}>{children}</span> }

export default function App() {
  const [page, setPage] = useState<Page>('Overview')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [timeframe, setTimeframe] = useState('1D')
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try { const saved = localStorage.getItem('vw-watchlist'); return saved ? JSON.parse(saved) as string[] : ['XAUUSD', 'EURUSD', 'USDJPY'] } catch { return ['XAUUSD', 'EURUSD', 'USDJPY'] }
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
  const [billing, setBilling] = useState<'Monthly' | 'Yearly'>('Monthly')
  const [query, setQuery] = useState('')
  const filteredInstruments = useMemo(() => marketInstruments.filter(i => (category === 'All' || i.category === category) && `${i.symbol} ${i.name}`.toLowerCase().includes(search.toLowerCase())), [marketInstruments, category, search])
  const filteredLessons = lessons.filter(l => lessonFilter === 'All' || l.level === lessonFilter)
  const go = (next: Page) => { setPage(next); setMobileOpen(false); setNotice('') }
  const action = (message: string) => setNotice(message)
  const toggleWatch = (symbol: string) => setWatchlist(old => old.includes(symbol) ? old.filter(s => s !== symbol) : [...old, symbol])

  const handleAuthSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

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
        action(data.session
          ? 'Registrasi berhasil. Akun lu sudah aktif.'
          : 'Registrasi berhasil. Cek email lu untuk konfirmasi akun sebelum login.')
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
      if (roleError) throw new Error('Pemeriksaan hak admin gagal. Jalankan SQL admin_membership_setup.sql di Supabase.')
      if (allowed !== true) {
        setAdminAuthorized(false)
        setAdminMembers([])
        setAdminError('Akses ditolak. Akun ini belum memiliki role admin di database.')
        return
      }
      setAdminAuthorized(true)
      const [{ data: profiles, error: profilesError }, { data: memberships, error: membershipsError }] = await Promise.all([
        supabase.from('profiles').select('id,full_name,role,created_at').order('created_at', { ascending: false }),
        supabase.from('memberships').select('user_id,plan,status,starts_at,ends_at,payment_reference'),
      ])
      if (profilesError) throw profilesError
      if (membershipsError) throw membershipsError
      const membershipByUser = new Map((memberships ?? []).map((m: any) => [m.user_id, m]))
      setAdminMembers((profiles ?? []).map((profile: any) => {
        const membership: any = membershipByUser.get(profile.id)
        return { id: profile.id, full_name: profile.full_name, role: profile.role, created_at: profile.created_at, plan: membership?.plan ?? null, status: membership?.status ?? null, starts_at: membership?.starts_at ?? null, ends_at: membership?.ends_at ?? null, payment_reference: membership?.payment_reference ?? null }
      }))
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Gagal memuat data admin.')
    } finally {
      setAdminLoading(false)
    }
  }

  const updateMemberStatus = async (member: AdminMember, nextStatus: 'active' | 'inactive') => {
    if (!supabase || !adminAuthorized) return
    setAdminBusyUser(member.id)
    setAdminError('')
    try {
      const { error } = await supabase.from('memberships').upsert({
        user_id: member.id,
        plan: member.plan || 'Essential',
        status: nextStatus,
        starts_at: member.starts_at || new Date().toISOString(),
        ends_at: member.ends_at,
        payment_reference: member.payment_reference,
      }, { onConflict: 'user_id' })
      if (error) throw error
      action(`Membership ${member.full_name || member.id.slice(0, 8)} sekarang ${nextStatus}.`)
      await loadAdminData()
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Gagal memperbarui membership.')
    } finally {
      setAdminBusyUser(null)
    }
  }

  useEffect(() => {
    if (page === 'Admin Panel') void loadAdminData()
  }, [page, signedInEmail])

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
      const { error } = await supabase.auth.resetPasswordForEmail(authEmail.trim(), {
        redirectTo: window.location.origin,
      })
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

  useEffect(() => {
    try { localStorage.setItem('vw-watchlist', JSON.stringify(watchlist)) } catch { /* storage may be unavailable */ }
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
        safeJson('https://api.gold-api.com/price/XAU').then((data: any) => {
          const price = Number(data?.price ?? data?.price_usd ?? data?.rate)
          if (!Number.isFinite(price) || price <= 0) throw new Error('Invalid gold quote')
          update('XAUUSD', { price: numberPrice(price), change: 'LIVE SPOT', positive: true, status: 'LIVE', points: [4,7,5,10,8,13,12,17,14,21,19,24,22,28] })
          successes++
        }),
        safeJson('https://data-api.binance.vision/api/v3/ticker/24hr?symbol=BTCUSDT').then((data: any) => {
          const price = Number(data?.lastPrice)
          const pct = Number(data?.priceChangePercent)
          if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(pct)) throw new Error('Invalid crypto quote')
          update('BTCUSD', { price: numberPrice(price), change: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% · 24H`, positive: pct >= 0, status: 'LIVE' })
          successes++
        }),
        safeJson('https://open.er-api.com/v6/latest/USD').then((data: any) => {
          const rates = data?.rates
          if (data?.result !== 'success' || !rates) throw new Error('Invalid FX quote')
          const eur = Number(rates.EUR), gbp = Number(rates.GBP), jpy = Number(rates.JPY)
          if (eur > 0) { update('EURUSD', { price: numberPrice(1 / eur, 4), change: 'DAILY FX', positive: true, status: 'DAILY' }); successes++ }
          if (gbp > 0) { update('GBPUSD', { price: numberPrice(1 / gbp, 4), change: 'DAILY FX', positive: true, status: 'DAILY' }); successes++ }
          if (jpy > 0) { update('USDJPY', { price: numberPrice(jpy, 2), change: 'DAILY FX', positive: true, status: 'DAILY' }); successes++ }
        })
      ])
      if (!alive) return
      const hasLive = next.some(item => item.status === 'LIVE')
      setMarketInstruments(next.map(item => item.status === 'CONNECTING' ? { ...item, price: 'Unavailable', change: 'NO FEED', status: 'UNAVAILABLE' as LiveStatus } : item))
      setMarketConnection(successes === 0 ? 'OFFLINE' : hasLive && successes >= 2 ? 'CONNECTED' : 'PARTIAL')
      setMarketUpdatedAt(`Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`)
    }
    void refreshMarket()
    const timer = window.setInterval(() => { void refreshMarket() }, 60_000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [])
  const title = page === 'Overview' ? 'Market overview' : page

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand"><Logo small /><button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={17}/></button></div>
      <div className="workspace-label"><span className="workspace-dot"/><span>TRADING WORKSPACE</span><ChevronDown size={13}/></div>
      {['PLATFORM', 'LEARN', 'ACCOUNT', 'PREVIEW'].map(group => <div className="nav-group" key={group}>
        <div className="nav-caption">{group}</div>
        {nav.filter(n => n.group === group).map(item => { const Icon = item.icon; return <button key={item.label} onClick={() => go(item.label)} className={`nav-link ${page === item.label ? 'active' : ''}`}><Icon size={16}/><span>{item.label}</span>{item.label === 'Admin Panel' && <span className="tiny-label">ADMIN</span>}</button> })}
      </div>)}
      <div className="sidebar-bottom">
        <div className="discipline-card"><div className="discipline-mark"><Zap size={16}/></div><div><b>Discipline over emotion.</b><span>Build your process.</span></div></div>
        <div className="sidebar-footer"><span className="status-dot"/> Frontend preview <span className="version">v1.0</span></div>
      </div>
    </aside>

    {mobileOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
    <main className="main-area">
      <header className="topbar">
        <button className="icon-button menu-trigger" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={19}/></button>
        <div className="breadcrumb"><span>VELTRIX</span><span className="crumb-slash">/</span><b>{title}</b></div>
        <div className="topbar-actions"><label className="global-search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search platform..." onKeyDown={e => { if (e.key === 'Enter') { setSearch(query); setCategory('All'); go('Market') } }}/><kbd>⌘ K</kbd></label><span className="demo-chip"><span/> {marketConnection === 'CONNECTED' ? 'MARKET CONNECTED' : marketConnection === 'PARTIAL' ? 'PARTIAL MARKET DATA' : marketConnection === 'OFFLINE' ? 'MARKET OFFLINE' : 'CONNECTING'}</span><button className="icon-button" onClick={() => action('Tidak ada notifikasi baru pada preview ini.')} aria-label="Notifications"><Bell size={17}/></button><button className="avatar" onClick={() => go('Login / Register')} aria-label="Open account">V</button></div>
      </header>

      <div className="page-content">
        {notice && <div className="notice"><CircleHelp size={16}/><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15}/></button></div>}

        {page === 'Overview' && <>
          <section className="welcome-row"><div><div className="eyebrow"><span className="eyebrow-line"/> VELTRIX WARFARE <span className="eyebrow-muted">/ MARKET TERMINAL</span></div><h1>Clarity in the market.<br/><em>Discipline in every move.</em></h1><p className="lede">A structured workspace for market observation, trading education, and scenario planning.</p><div className="welcome-actions"><button className="button button-primary" onClick={() => go('Market')}>Explore market <ArrowRight size={15}/></button><button className="button button-quiet" onClick={() => go('Analysis')}>View insights</button></div></div><div className="hero-art"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-v">V</div><div className="hero-caption"><span>VW / 001</span><span>DISCIPLINE OVER EMOTION</span></div></div></section>
          <div className="demo-banner"><span className="demo-banner-icon"><Activity size={16}/></span><div><b>Market data status</b><span>Gold spot and crypto quotes use live public feeds where available; FX rates are daily reference rates. {marketUpdatedAt}. Chart and performance illustrations remain simulated.</span></div><Pill tone="silver">{marketConnection}</Pill></div>
          <section className="section-block"><div className="section-heading"><div><span className="section-kicker">01 / THE MARKET</span><h2>Market snapshot</h2></div><button className="text-link" onClick={() => go('Market')}>Full market <ArrowRight size={14}/></button></div>
            <div className="market-grid">{marketInstruments.slice(0,4).map((item, i) => <div className="market-card glass-panel" key={item.symbol}><div className="market-card-top"><span className="instrument-icon">{item.symbol === 'XAUUSD' ? 'Au' : item.symbol.slice(0,2)}</span><button className={`star-button ${watchlist.includes(item.symbol) ? 'starred' : ''}`} onClick={() => toggleWatch(item.symbol)} aria-label={`Toggle ${item.symbol} watchlist`}><Star size={15} fill={watchlist.includes(item.symbol) ? 'currentColor' : 'none'}/></button></div><div className="instrument-name">{item.symbol}</div><div className="instrument-sub">{item.name}</div><div className="price-row"><b>{fmt(item.price)}</b><Pill tone={item.positive ? 'positive' : 'negative'}>{item.change}</Pill></div><Sparkline values={item.points} positive={item.positive}/></div>)}</div>
          </section>
          <section className="dashboard-grid"><div className="glass-panel chart-panel"><div className="panel-heading"><div><span className="section-kicker">02 / PRICE ACTION</span><h3>Market movement <Pill tone="silver">ILLUSTRATIVE</Pill></h3></div><div className="segmented">{['1D','1W','1M','1Y'].map(t => <button className={timeframe === t ? 'selected' : ''} onClick={() => setTimeframe(t)} key={t}>{t}</button>)}</div></div><div className="chart-summary"><b>Market index <span>—</span></b><span className="chart-value">+2.84% <small>illustrative</small></span></div><div className="main-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="silverFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d9dde3" stopOpacity={0.22}/><stop offset="95%" stopColor="#d9dde3" stopOpacity={0}/></linearGradient></defs><XAxis dataKey="time" hide/><Tooltip contentStyle={{background:'#111316',border:'1px solid #34373d',borderRadius:8,color:'#fff'}} labelFormatter={v => `Point ${v}`} formatter={v => [Number(v).toFixed(2), 'Index (demo)']}/><Area type="monotone" dataKey="value" stroke="#c5cad2" strokeWidth={2} fill="url(#silverFade)" /></AreaChart></ResponsiveContainer></div><div className="chart-axis"><span>01</span><span>07</span><span>14</span><span>21</span><span>28</span></div></div>
          <div className="glass-panel watch-panel"><div className="panel-heading"><div><span className="section-kicker">03 / TRACKING</span><h3>Your watchlist</h3></div><button className="icon-button" onClick={() => go('Market')} aria-label="Open market"><ArrowRight size={16}/></button></div><div className="watch-list">{marketInstruments.filter(i => watchlist.includes(i.symbol)).map(i => <div className="watch-row" key={i.symbol}><span className="watch-symbol">{i.symbol.slice(0,2)}</span><div className="watch-name"><b>{i.symbol}</b><span>{i.name}</span></div><div className="watch-price"><b>{i.price}</b><span className={i.positive ? 'positive-text' : 'negative-text'}>{i.change}</span></div></div>)}</div><button className="button button-outline full-button" onClick={() => go('Market')}>Manage watchlist <ArrowRight size={14}/></button></div></section>
          <section className="bottom-grid"><div className="glass-panel news-panel"><div className="panel-heading"><div><span className="section-kicker">04 / LATEST UPDATES</span><h3>Research & education</h3></div><button className="text-link" onClick={() => go('News & Calendar')}>Browse <ArrowRight size={14}/></button></div>{news.slice(0,3).map(n => <button className="news-row" key={n.title} onClick={() => go('News & Calendar')}><span className="news-time">{n.time}</span><span className="news-title">{n.title}<small>{n.tag} · DEMO CONTENT</small></span><ArrowRight size={14}/></button>)}</div><div className="glass-panel principle-panel"><span className="section-kicker">THE VELTRIX PRINCIPLE</span><div className="principle-quote">“Observe the structure.<br/>Respect the risk.<br/><em>Execute with discipline.</em>”</div><button className="text-link" onClick={() => go('About')}>Our philosophy <ArrowRight size={14}/></button><div className="principle-watermark">V</div></div></section>
        </>}

        {page === 'Market' && <><PageIntro kicker="01 / MARKET TERMINAL" title="Observe the market." desc="Track selected instruments and explore the chart interface. Gold and crypto quotes use public live feeds where available; FX uses daily reference rates." /><div className="demo-banner compact"><Activity size={16}/><span>{marketConnection} · {marketUpdatedAt} · Gold/crypto live feeds where available; FX daily reference rates.</span></div><div className="market-tools"><label className="search-field"><Search size={15}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search instruments..."/></label><div className="filter-tabs">{['All','Forex','Metals','Crypto'].map(c => <button key={c} className={category === c ? 'selected' : ''} onClick={() => setCategory(c)}>{c}</button>)}</div><button className="button button-outline" onClick={() => {setSearch('');setCategory('All')}}><SlidersHorizontal size={14}/> Reset</button></div><div className="glass-panel table-panel"><div className="table-header"><span>INSTRUMENT</span><span>PRICE / FEED</span><span>CHANGE</span><span>RECENT MOVEMENT</span><span>WATCHLIST</span></div>{filteredInstruments.map(i => <div className="table-row" key={i.symbol}><div className="table-instrument"><span className="instrument-icon">{i.symbol.slice(0,2)}</span><span><b>{i.symbol}</b><small>{i.name}</small></span></div><b>{i.price}</b><span className={i.positive ? 'positive-text' : 'negative-text'}>{i.change}</span><Sparkline values={i.points} positive={i.positive}/><button className={`star-button ${watchlist.includes(i.symbol) ? 'starred' : ''}`} onClick={() => toggleWatch(i.symbol)} aria-label="Toggle watchlist"><Star size={16} fill={watchlist.includes(i.symbol) ? 'currentColor' : 'none'}/></button></div>)}{filteredInstruments.length === 0 && <div className="empty-state">No instruments match your search.</div>}</div><div className="glass-panel market-detail"><div><span className="section-kicker">CHART WORKSPACE</span><h3>XAUUSD <span className="muted">/ Gold vs US Dollar</span></h3><p>Live spot quote is displayed above when the public feed is available. The chart illustration below is not a live candlestick chart.</p></div><div className="detail-stat"><span>Spot quote · {marketInstruments.find(i => i.symbol === 'XAUUSD')?.status ?? 'CONNECTING'}</span><b>{marketInstruments.find(i => i.symbol === 'XAUUSD')?.price ?? '—'}</b><Pill tone="silver">{marketInstruments.find(i => i.symbol === 'XAUUSD')?.status ?? 'CONNECTING'}</Pill></div><div className="mini-bars">{Array.from({length:42},(_,i)=><span key={i} style={{height:`${18+((i*17+i*i*3)%72)}%`}}/>)}</div></div></>}

        {page === 'News & Calendar' && <><PageIntro kicker="02 / INFORMATION" title="Stay informed. Stay objective." desc="A structured view for educational notes and economic-calendar layout. Entries below are demo content, not current news or verified event schedules."/><div className="two-column"><div className="glass-panel content-panel"><div className="panel-heading"><div><span className="section-kicker">EDITORIAL</span><h3>Research notes</h3></div><Pill tone="silver">DEMO</Pill></div>{news.map((n,i)=><article className="editorial-row" key={n.title}><div className="editorial-index">0{i+1}</div><div><Pill tone={n.impact === 'High' ? 'negative' : 'neutral'}>{n.tag}</Pill><h4>{n.title}</h4><p>Educational placeholder content. Check primary sources before making decisions.</p><span className="muted small-text">{n.time} · Illustrative entry</span></div><ArrowRight size={15}/></article>)}</div><div className="glass-panel content-panel"><div className="panel-heading"><div><span className="section-kicker">CALENDAR INTERFACE</span><h3>Economic calendar</h3></div><CalendarDays size={17}/></div><div className="calendar-date"><b>Event schedule</b><Pill tone="silver">SAMPLE</Pill></div>{[{time:'08:30',currency:'USD',event:'Inflation data release',impact:'High'},{time:'10:00',currency:'EUR',event:'Consumer confidence',impact:'Medium'},{time:'13:30',currency:'GBP',event:'Economic activity report',impact:'Medium'},{time:'15:00',currency:'USD',event:'Central bank remarks',impact:'High'}].map((e,i)=><div className="calendar-row" key={i}><span className="calendar-time">{e.time}</span><span className="currency-code">{e.currency}</span><span className="calendar-event">{e.event}<small>Forecast — · Previous — · Actual —</small></span><Pill tone={e.impact === 'High' ? 'negative' : 'neutral'}>{e.impact}</Pill></div>)}<p className="fine-print">Sample events only. Times and event descriptions are not a verified calendar.</p></div></div></>}

        {page === 'Academy' && <><PageIntro kicker="03 / LEARNING" title="Build your trading foundation." desc="Structured learning paths designed to strengthen process, market understanding, and risk awareness."/><div className="academy-feature glass-panel"><div className="feature-copy"><span className="section-kicker">THE VELTRIX ACADEMY</span><h2>Learn the process.<br/><em>Not the shortcut.</em></h2><p>Education-first material for building a repeatable and risk-aware approach to markets.</p><button className="button button-primary" onClick={() => action('Learning preview selected. Lesson progress is not saved to an account.')}>Explore learning path <ArrowRight size={15}/></button></div><div className="feature-graphic"><BookOpen size={64} strokeWidth={1}/><span>VW / ACADEMY</span></div></div><div className="section-heading standalone"><div><span className="section-kicker">CURRICULUM</span><h2>Learning library</h2></div><div className="filter-tabs">{['All','Beginner','Intermediate','Advanced'].map(c=><button key={c} className={lessonFilter===c?'selected':''} onClick={()=>setLessonFilter(c)}>{c}</button>)}</div></div><div className="lesson-grid">{filteredLessons.map((l,i)=><article className="glass-panel lesson-card" key={l.title}><div className="lesson-art"><span>0{i+1}</span>{i===0?<BookOpen/>:i===1?<Activity/>:i===2?<Eye/>:<ShieldCheck/>}</div><div className="lesson-meta"><Pill tone="silver">{l.level}</Pill><span>{l.duration}</span></div><h3>{l.title}</h3><p>{l.desc}</p><button className="text-link" onClick={()=>action(`“${l.title}” is a placeholder lesson. Full lesson content is not connected yet.`)}>View lesson <ArrowRight size={14}/></button></article>)}</div></>}

        {page === 'Analysis' && <><PageIntro kicker="04 / TRADING INSIGHTS" title="Separate signal from noise." desc="An organized framework for reading market structure, mapping scenarios, and respecting invalidation."/><div className="analysis-layout"><div className="glass-panel analysis-main"><div className="panel-heading"><div><span className="section-kicker">MARKET STRUCTURE / EXAMPLE</span><h3>XAUUSD scenario board</h3></div><Pill tone="silver">ILLUSTRATIVE</Pill></div><div className="scenario-chart"><div className="level level-resistance"><span>Resistance zone · example</span></div><div className="scenario-candles">{Array.from({length:34},(_,i)=><span key={i} className={(i%5===0||i%7===0)?'down':''} style={{height:`${16+((i*23+i*i)%68)}%`,left:`${i*2.85}%`}}/>)}</div><div className="level level-support"><span>Support zone · example</span></div></div><div className="legend-row"><span><i className="legend-silver"/> Structure</span><span><i className="legend-dash"/> Example level</span><span className="muted">No live chart feed</span></div></div><div className="glass-panel analysis-side"><span className="section-kicker">SCENARIO FRAMEWORK</span><h3>Before any setup</h3>{[{n:'01',t:'Context',d:'Identify the broader structure and current range.'},{n:'02',t:'Liquidity',d:'Mark relevant areas without assuming a reaction.'},{n:'03',t:'Confirmation',d:'Define what evidence would support a scenario.'},{n:'04',t:'Invalidation',d:'State clearly what would make the idea invalid.'}].map(s=><div className="framework-row" key={s.n}><span>{s.n}</span><div><b>{s.t}</b><p>{s.d}</p></div></div>)}</div></div><div className="scenario-grid"><div className="glass-panel scenario-card"><Pill tone="positive">SCENARIO A</Pill><h3>Bullish case</h3><p>Illustrative conditional scenario, not a current signal.</p><ul><li>Price confirms strength above a defined level.</li><li>Retest holds within the planned risk.</li><li>Invalidation is defined before entry.</li></ul></div><div className="glass-panel scenario-card"><Pill tone="negative">SCENARIO B</Pill><h3>Bearish case</h3><p>Illustrative conditional scenario, not a current signal.</p><ul><li>Price rejects a defined resistance area.</li><li>Structure supports downside continuation.</li><li>Invalidation is defined before entry.</li></ul></div></div></>}

        {page === 'About' && <><PageIntro kicker="05 / OUR PHILOSOPHY" title="A framework built on discipline." desc="VELTRIX WARFARE is a concept for a structured trading and education workspace — designed to put clarity before impulse."/><div className="about-hero glass-panel"><div><span className="section-kicker">DISCIPLINE OVER EMOTION</span><h2>Observe.<br/>Calculate.<br/><em>Execute.</em></h2><p>Markets are uncertain. A process can still be deliberate. VELTRIX WARFARE brings market observation, structured learning, and scenario planning into one focused interface.</p></div><div className="about-symbol">V<span>VW / 01</span></div></div><div className="values-grid">{[{n:'01',t:'Clarity',d:'Keep information organized and distinguish facts from assumptions.'},{n:'02',t:'Discipline',d:'Build decisions around a defined process and risk limits.'},{n:'03',t:'Continuous learning',d:'Treat review and education as part of the work.'}].map(v=><div className="glass-panel value-card" key={v.n}><span>{v.n}</span><h3>{v.t}</h3><p>{v.d}</p></div>)}</div><p className="disclaimer">Trading involves substantial risk and may not be suitable for everyone. This interface is an educational frontend preview and does not provide investment advice.</p></>}

        {page === 'Membership' && <><PageIntro kicker="06 / MEMBERSHIP" title="Choose your level of access." desc="Membership layout preview. No payment, subscription, or entitlement is active in this frontend version."/><div className="billing-row"><span>Billing period</span><div className="segmented">{(['Monthly','Yearly'] as const).map(b=><button key={b} className={billing===b?'selected':''} onClick={()=>setBilling(b)}>{b}{b==='Yearly'&&<small> SAVE 20%</small>}</button>)}</div></div><div className="pricing-grid">{[{name:'Essential',price:billing==='Monthly'?'79k':'758k',desc:'A focused starting point.',features:['Market overview','Learning library','Basic market notes']},{name:'Advanced',price:billing==='Monthly'?'149k':'1.430k',desc:'For a more structured workflow.',features:['Everything in Essential','Extended analysis library','Scenario frameworks','Advanced learning paths'],featured:true},{name:'Private',price:billing==='Monthly'?'299k':'2.870k',desc:'A comprehensive platform concept.',features:['Everything in Advanced','Premium research layout','Priority content access','Member features (planned)']}].map(p=><div className={`glass-panel price-card ${p.featured?'featured':''}`} key={p.name}>{p.featured&&<span className="popular-label">FEATURED PLAN</span>}<span className="section-kicker">{p.name.toUpperCase()} ACCESS</span><h3>{p.name}</h3><p>{p.desc}</p><div className="price"><b>Rp {p.price}</b><span>/{billing==='Monthly'?'month':'year'}</span></div><div className="price-divider"/>{p.features.map(f=><div className="feature-check" key={f}><Check size={15}/>{f}</div>)}<button className={`button ${p.featured?'button-primary':'button-outline'} full-button`} onClick={()=>action('Checkout is not enabled yet. A verified payment provider and server-side webhook must be configured before accepting payments.')}>Select plan <ArrowRight size={14}/></button></div>)}</div><p className="fine-print">All prices are placeholder examples for design review and are not an active offer.</p></>}

        {page === 'Login / Register' && <><PageIntro kicker="07 / ACCOUNT ACCESS" title="Your workspace starts here." desc="Sign in or create your VELTRIX WARFARE account securely."/><div className="auth-wrap"><div className="glass-panel auth-card"><Logo/>{signedInEmail ? <><div className="auth-tabs"><button className="selected" type="button">Account</button></div><h2>You are signed in.</h2><p className="muted">Signed in as {signedInEmail}</p><div className="auth-note"><ShieldCheck size={14}/> Account authenticated successfully.</div><button className="button button-outline full-button" type="button" disabled={authBusy} onClick={() => void handleLogout()}>{authBusy ? 'Please wait...' : 'Logout'}</button></> : <><div className="auth-tabs"><button type="button" className={authMode==='Login'?'selected':''} onClick={()=>setAuthMode('Login')}>Login</button><button type="button" className={authMode==='Create account'?'selected':''} onClick={()=>setAuthMode('Create account')}>Create account</button></div><h2>{authMode==='Login'?'Welcome back.':'Create your account.'}</h2><p className="muted">Access your VELTRIX WARFARE workspace.</p><form onSubmit={handleAuthSubmit}><label className="form-label">Email address<input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required/></label>{authMode==='Create account'&&<label className="form-label">Display name<input type="text" value={authName} onChange={e=>setAuthName(e.target.value)} placeholder="Your name" autoComplete="name" maxLength={80} required/></label>}<label className="form-label">Password<input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} minLength={8} placeholder="At least 8 characters" autoComplete={authMode==='Login'?'current-password':'new-password'} required/></label>{authMode==='Login'&&<button type="button" className="forgot-link" disabled={authBusy} onClick={()=>void handlePasswordReset()}>Forgot password?</button>}<button className="button button-primary full-button" type="submit" disabled={authBusy}>{authBusy?'Please wait...':authMode==='Login'?'Continue':'Create account'} <ArrowRight size={14}/></button></form><div className="auth-note"><LockKeyhole size={14}/> {supabase ? 'Secure authentication powered by Supabase.' : 'Authentication requires Supabase configuration.'}</div></>}</div></div></>}

        {page === 'Admin Panel' && <>
          <PageIntro kicker="08 / CONTROL ROOM" title="Administration control room." desc="Kelola akun dan status membership yang tersimpan di database. Semua perubahan memerlukan role admin yang diverifikasi Supabase."/>
          {!adminAuthorized ? <div className="glass-panel content-panel"><div className="panel-heading"><h3>Admin access required</h3><ShieldCheck size={18}/></div><p className="muted">{adminLoading ? 'Memeriksa sesi dan hak akses admin…' : adminError || 'Masuk menggunakan akun admin untuk membuka kontrol panel.'}</p><div className="welcome-actions"><button className="button button-primary" onClick={() => go('Login / Register')}>Open login <ArrowRight size={14}/></button><button className="button button-outline" disabled={adminLoading} onClick={() => void loadAdminData()}>{adminLoading ? 'Loading…' : 'Check access again'}</button></div></div> : <>
            <div className="demo-banner compact"><ShieldCheck size={16}/><span>ADMIN ACCESS VERIFIED · perubahan membership dicatat di Supabase.</span><button className="button button-outline" disabled={adminLoading} onClick={() => void loadAdminData()}><Activity size={14}/> Refresh</button></div>
            {adminError && <div className="demo-banner compact"><CircleHelp size={16}/><span>{adminError}</span></div>}
            <div className="admin-metrics">{[{l:'Registered members',v:String(adminMembers.length),s:'Profiles in database'},{l:'Active memberships',v:String(adminMembers.filter(m=>m.status==='active').length),s:'Membership status active'},{l:'Inactive / no plan',v:String(adminMembers.filter(m=>m.status!=='active').length),s:'Includes accounts without membership'},{l:'Transactions',v:'—',s:'Payment integration not configured'}].map(m=><div className="glass-panel admin-metric" key={m.l}><span>{m.l}</span><b>{m.v}</b><small>{m.s}</small></div>)}</div>
            <div className="glass-panel transactions-panel"><div className="panel-heading"><div><span className="section-kicker">MEMBER DIRECTORY</span><h3>Accounts & membership</h3></div><Pill tone="silver">{adminMembers.length} ACCOUNTS</Pill></div>
              {adminLoading ? <div className="empty-state large-empty"><b>Loading member data…</b></div> : adminMembers.length === 0 ? <div className="empty-state large-empty"><div className="empty-icon"><GraduationCap size={22}/></div><b>No member profiles found</b><span>Setelah user registrasi, profil akan tampil di sini jika trigger database berhasil.</span></div> : <div className="admin-member-list">{adminMembers.map(member=><div className="admin-member-row" key={member.id}><div className="admin-member-info"><b>{member.full_name || 'Unnamed member'}</b><small>{member.id.slice(0,8)}… · joined {member.created_at ? new Date(member.created_at).toLocaleDateString() : 'unknown date'}</small><small>Plan: {member.plan || 'No plan'} · Status: {member.status || 'not assigned'}</small>{member.ends_at && <small>Ends: {new Date(member.ends_at).toLocaleDateString()}</small>}</div><div className="admin-member-actions"><Pill tone={member.role==='admin'?'silver':member.status==='active'?'positive':'neutral'}>{member.role==='admin'?'ADMIN':(member.status || 'NO PLAN').toUpperCase()}</Pill><button className="button button-outline" disabled={adminBusyUser===member.id || member.role==='admin'} onClick={() => void updateMemberStatus(member, member.status==='active'?'inactive':'active')}>{adminBusyUser===member.id?'Saving…':member.status==='active'?'Deactivate':'Activate'}</button></div></div>)}</div>}
            </div>
            <div className="two-column"><div className="glass-panel content-panel"><div className="panel-heading"><h3>Platform management</h3><Pill tone="silver">CONNECTED</Pill></div><div className="admin-action"><span className="admin-action-icon"><Wallet size={17}/></span><span><b>Membership plans</b><small>Essential, Advanced, Private · payment checkout still disabled</small></span></div><div className="admin-action"><span className="admin-action-icon"><Newspaper size={17}/></span><span><b>Content library</b><small>Content editor not implemented yet</small></span></div></div><div className="glass-panel content-panel"><div className="panel-heading"><h3>System status</h3><Activity size={16}/></div>{[{k:'Frontend',v:'Available'},{k:'Authentication',v:'Connected'},{k:'Database',v:'Connected'},{k:'Payment provider',v:'Not connected'}].map(x=><div className="system-row" key={x.k}><span>{x.k}</span><Pill tone={x.v==='Available'||x.v==='Connected'?'positive':'neutral'}>{x.v}</Pill></div>)}</div></div>
          </>}
        </>}

        {page === 'Transactions' && <><PageIntro kicker="09 / ACCOUNT RECORDS" title="Transaction history." desc="No real transactions are available. The table below is intentionally empty until a verified backend is configured."/><div className="glass-panel transactions-panel"><div className="panel-heading"><div><span className="section-kicker">FINANCIAL RECORDS</span><h3>All transactions</h3></div><button className="button button-outline" onClick={()=>action('No transaction records exist in this frontend preview.')}><Filter size={14}/> Filter</button></div><div className="table-header transaction-head"><span>REFERENCE</span><span>DESCRIPTION</span><span>DATE</span><span>AMOUNT</span><span>STATUS</span></div><div className="empty-state large-empty"><div className="empty-icon"><FileText size={22}/></div><b>No transaction records</b><span>Transactions will appear here after a real payment and secure backend integration are implemented.</span></div></div></>}
      </div>
      <footer className="app-footer"><div><Logo small/><span>© 2026 VELTRIX WARFARE</span></div><span className="footer-disclaimer">Frontend preview · Demo data · Not financial advice</span><button onClick={()=>go('About')}>Platform information <ArrowRight size={13}/></button></footer>
    </main>
  </div>
}

function PageIntro({ kicker, title, desc }: { kicker: string; title: string; desc: string }) {
  return <section className="page-intro"><span className="section-kicker">{kicker}</span><h1>{title}</h1><p>{desc}</p></section>
}
