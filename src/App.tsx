import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BookOpen, CalendarDays,
  Check, ChevronDown, ChevronRight, ArrowLeft, CircleHelp, Command, Compass, Crown, Eye, FileText, Filter,
  Globe2, GraduationCap, LayoutDashboard, LockKeyhole, LogIn, Menu, MoreHorizontal,
  Newspaper, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Star,
  TrendingUp, Wallet, X, Zap
} from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { instruments, lessons, news } from './data/demo'
import { supabase } from './lib/supabase'
import LiveEconomicCalendar from './components/LiveEconomicCalendar'

type Page = 'Payment' | 'Settings' | 'Overview' | 'Market' | 'News & Calendar' | 'Academy' | 'Analysis' | 'About' | 'Membership' | 'Login / Register' | 'Admin Panel' | 'Transactions'
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
type AccountProfile = { id: string; full_name: string | null; username: string | null; avatar_url: string | null; role: string }
type AccountMembership = { plan: string | null; status: string | null; starts_at: string | null; ends_at: string | null }
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
  const [language, setLanguage] = useState(() => { try { return localStorage.getItem('vw-language') || 'en' } catch { return 'en' } })
  const [theme, setTheme] = useState<'dark' | 'light'>(() => { try { return localStorage.getItem('vw-theme') === 'light' ? 'light' : 'dark' } catch { return 'dark' } })
  const [mobileOpen, setMobileOpen] = useState(false)
  const translations: Record<string, Record<string, string>> = {
    en: { workspace: 'TRADING WORKSPACE', settings: 'Settings', overview: 'Overview', market: 'Market', news: 'News & Calendar', academy: 'Academy', analysis: 'Analysis', about: 'About', membership: 'Membership', login: 'Login / Register', admin: 'Admin Panel', transactions: 'Transactions', platform: 'PLATFORM', learn: 'LEARN', account: 'ACCOUNT', preview: 'PREVIEW', settingsTitle: 'Workspace settings', settingsDesc: 'Customize your language and appearance. Your preferences are saved on this device.', language: 'Language', languageDesc: 'Choose the language used in the workspace interface.', appearance: 'Appearance', appearanceDesc: 'Choose the look that feels right for you.', dark: 'Dark', darkDesc: 'A focused, low-light interface.', light: 'Light', lightDesc: 'A bright, clean interface.', saved: 'Preferences are saved automatically.' },
    id: { workspace: 'RUANG KERJA TRADING', settings: 'Pengaturan', overview: 'Ringkasan', market: 'Pasar', news: 'Berita & Kalender', academy: 'Akademi', analysis: 'Analisis', about: 'Tentang', membership: 'Keanggotaan', login: 'Masuk / Daftar', admin: 'Panel Admin', transactions: 'Transaksi', platform: 'PLATFORM', learn: 'PELAJARAN', account: 'AKUN', preview: 'PRATINJAU', settingsTitle: 'Pengaturan ruang kerja', settingsDesc: 'Sesuaikan bahasa dan tampilan. Preferensi disimpan di perangkat ini.', language: 'Bahasa', languageDesc: 'Pilih bahasa untuk antarmuka ruang kerja.', appearance: 'Tampilan', appearanceDesc: 'Pilih tampilan yang nyaman untuk Anda.', dark: 'Gelap', darkDesc: 'Antarmuka nyaman dalam cahaya rendah.', light: 'Terang', lightDesc: 'Antarmuka cerah dan bersih.', saved: 'Preferensi tersimpan otomatis.' },
    ja: { workspace: 'トレーディングワークスペース', settings: '設定', overview: '概要', market: 'マーケット', news: 'ニュースとカレンダー', academy: 'アカデミー', analysis: '分析', about: '概要情報', membership: 'メンバーシップ', login: 'ログイン / 登録', admin: '管理パネル', transactions: '取引履歴', platform: 'プラットフォーム', learn: '学習', account: 'アカウント', preview: 'プレビュー', settingsTitle: 'ワークスペース設定', settingsDesc: '言語と外観をカスタマイズします。設定はこのデバイスに保存されます。', language: '言語', languageDesc: 'インターフェースの言語を選択します。', appearance: '外観', appearanceDesc: 'お好みの表示を選択します。', dark: 'ダーク', darkDesc: '暗い環境に適した表示。', light: 'ライト', lightDesc: '明るくすっきりした表示。', saved: '設定は自動的に保存されます。' },
    zh: { workspace: '交易工作区', settings: '设置', overview: '概览', market: '市场', news: '新闻与日历', academy: '学院', analysis: '分析', about: '关于', membership: '会员', login: '登录 / 注册', admin: '管理面板', transactions: '交易记录', platform: '平台', learn: '学习', account: '账户', preview: '预览', settingsTitle: '工作区设置', settingsDesc: '自定义语言和外观。偏好设置将保存在此设备上。', language: '语言', languageDesc: '选择工作区界面语言。', appearance: '外观', appearanceDesc: '选择您喜欢的显示方式。', dark: '深色', darkDesc: '适合低光环境的界面。', light: '浅色', lightDesc: '明亮简洁的界面。', saved: '偏好设置已自动保存。' },
    ar: { workspace: 'مساحة التداول', settings: 'الإعدادات', overview: 'نظرة عامة', market: 'السوق', news: 'الأخبار والتقويم', academy: 'الأكاديمية', analysis: 'التحليل', about: 'حول', membership: 'العضوية', login: 'تسجيل الدخول / التسجيل', admin: 'لوحة الإدارة', transactions: 'المعاملات', platform: 'المنصة', learn: 'التعلم', account: 'الحساب', preview: 'معاينة', settingsTitle: 'إعدادات مساحة العمل', settingsDesc: 'خصص اللغة والمظهر. يتم حفظ تفضيلاتك على هذا الجهاز.', language: 'اللغة', languageDesc: 'اختر لغة واجهة مساحة العمل.', appearance: 'المظهر', appearanceDesc: 'اختر المظهر الذي يناسبك.', dark: 'داكن', darkDesc: 'واجهة مريحة في الإضاءة المنخفضة.', light: 'فاتح', lightDesc: 'واجهة مشرقة وبسيطة.', saved: 'يتم حفظ التفضيلات تلقائيًا.' }
  }
  const tr = (key: string) => translations[language]?.[key] || translations.en[key] || key
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
  const [signedInUserId, setSignedInUserId] = useState<string | null>(null)
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null)
  const [accountMembership, setAccountMembership] = useState<AccountMembership | null>(null)
  const [profileName, setProfileName] = useState('')
  const [profileUsername, setProfileUsername] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [adminLoading, setAdminLoading] = useState(false)
  const [adminAuthorized, setAdminAuthorized] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminRoleLoading, setAdminRoleLoading] = useState(false)
  const [adminMembers, setAdminMembers] = useState<AdminMember[]>([])
  const [selectedAdminMemberId, setSelectedAdminMemberId] = useState<string | null>(null)
  const [adminError, setAdminError] = useState('')
  const [adminBusyUser, setAdminBusyUser] = useState<string | null>(null)
  const [membershipAccess, setMembershipAccess] = useState<{ active: boolean; plan: string | null; ends_at: string | null }>({ active: false, plan: null, ends_at: null })
  const [membershipLoading, setMembershipLoading] = useState(false)
  const [billing, setBilling] = useState<'Monthly' | 'Yearly'>('Monthly')
  const [paymentBusyPlan, setPaymentBusyPlan] = useState<string | null>(null)
  const [activePayment, setActivePayment] = useState<{ order_id: string; plan: string; billing_period: string; amount: number; status: string } | null>(null)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofBusy, setProofBusy] = useState(false)
  const [paymentHistory, setPaymentHistory] = useState<any[]>([])
  const [adminPayments, setAdminPayments] = useState<any[]>([])
  const [adminPaymentsBusy, setAdminPaymentsBusy] = useState(false)
  const [adminDecisionBusy, setAdminDecisionBusy] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  useEffect(() => { try { localStorage.setItem('vw-language', language) } catch {} }, [language])
  useEffect(() => { try { localStorage.setItem('vw-theme', theme) } catch {} }, [theme])
  useEffect(() => { document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'; document.documentElement.lang = language }, [language])
  const filteredInstruments = useMemo(() => marketInstruments.filter(i => (category === 'All' || i.category === category) && `${i.symbol} ${i.name}`.toLowerCase().includes(search.toLowerCase())), [marketInstruments, category, search])
  const filteredLessons = lessons.filter(l => lessonFilter === 'All' || l.level === lessonFilter)
  const go = (next: Page) => {
    setMobileOpen(false)
    if ((next === 'Academy' || next === 'Analysis') && adminRoleLoading) {
      setNotice('Sedang memeriksa hak akses admin. Coba lagi sebentar.')
      return
    }
    if ((next === 'Academy' || next === 'Analysis') && !isAdmin && membershipLoading) {
      setNotice('Sedang memeriksa status membership. Coba lagi sebentar.')
      return
    }
    if (next === 'Academy' && !isAdmin && !membershipAccess.active) {
      setPage('Membership')
      setNotice(signedInEmail ? 'Akses Academy memerlukan membership aktif. Pilih paket atau hubungi admin.' : 'Login dan aktifkan membership untuk membuka Academy.')
      return
    }
    if (next === 'Analysis' && !isAdmin && (!membershipAccess.active || membershipAccess.plan === 'Essential')) {
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

  const handleCheckout = async (plan: string) => {
    if (!supabase) { action('Supabase belum terkonfigurasi. Periksa environment variables Vercel.'); return }
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.access_token) {
      action('Login dulu sebelum memilih paket membership.')
      setPage('Login / Register')
      return
    }
    setPaymentBusyPlan(plan)
    try {
      const response = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ plan, billing }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.order_id) throw new Error(result.error || 'Transaksi gagal dibuat.')
      setActivePayment({ ...result, status: result.status || 'awaiting_payment' })
      setProofFile(null)
      setNotice('')
      setPage('Payment')
      action('Transaksi dibuat. Selesaikan pembayaran QRIS lalu unggah bukti.')
    } catch (error) {
      action(error instanceof Error ? error.message : 'Gagal membuat transaksi.')
    } finally { setPaymentBusyPlan(null) }
  }

  const submitPaymentProof = async () => {
    if (!supabase || !activePayment || !proofFile) { action('Pilih bukti pembayaran terlebih dahulu.'); return }
    if (!['image/jpeg','image/png','image/webp'].includes(proofFile.type) || proofFile.size > 3 * 1024 * 1024) {
      action('Bukti harus berupa JPG, PNG, atau WEBP maksimal 3 MB.'); return
    }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { action('Sesi login berakhir. Silakan login ulang.'); return }
    setProofBusy(true)
    action('Mengunggah bukti pembayaran…')
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('File tidak dapat dibaca.'))
        reader.readAsDataURL(proofFile)
      })
      const base64 = dataUrl.split(',')[1]
      const response = await fetch('/api/payment/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ order_id: activePayment.order_id, mime_type: proofFile.type, file_base64: base64 }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || `Pengajuan bukti gagal (HTTP ${response.status}).`)
      setActivePayment({ ...activePayment, status: 'pending_verification' })
      setProofFile(null)
      action('Bukti terkirim. Membership tetap menunggu verifikasi admin.')
      void loadPaymentHistory()
    } catch (error) { action(error instanceof Error ? error.message : 'Gagal mengirim bukti.') }
    finally { setProofBusy(false) }
  }

  const loadPaymentHistory = async () => {
    if (!supabase) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    const response = await fetch('/api/payment/transactions', { headers: { Authorization: `Bearer ${session.access_token}` } })
    const result = await response.json().catch(() => ({}))
    if (response.ok) setPaymentHistory(result.transactions || [])
  }

  const loadAdminPayments = async () => {
    if (!supabase) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) return
    setAdminPaymentsBusy(true)
    try {
      const response = await fetch('/api/payment/admin', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Gagal memuat pembayaran.')
      setAdminPayments(result.transactions || [])
    } catch (error) { action(error instanceof Error ? error.message : 'Gagal memuat pembayaran.') }
    finally { setAdminPaymentsBusy(false) }
  }

  const reviewPayment = async (orderId: string, decision: 'approved' | 'rejected') => {
    if (!supabase) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) { action('Login admin diperlukan.'); return }
    const reason = decision === 'rejected' ? window.prompt('Alasan penolakan (opsional):') || 'Silakan hubungi admin melalui kanal resmi.' : null
    setAdminDecisionBusy(orderId)
    try {
      const response = await fetch('/api/payment/admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ order_id: orderId, decision, reason }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Keputusan tidak dapat disimpan.')
      action(`Pembayaran ${orderId}: ${decision.toUpperCase()}.`)
      await loadAdminPayments()
      await loadAdminData()
    } catch (error) { action(error instanceof Error ? error.message : 'Verifikasi gagal.') }
    finally { setAdminDecisionBusy(null) }
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
      setAdminMembers((data ?? []).map((row: any) => ({
        id: row.id,
        full_name: row.full_name,
        role: row.role,
        created_at: row.created_at,
        plan: row.plan ?? null,
        status: row.status ?? null,
        starts_at: row.starts_at ?? null,
        ends_at: row.ends_at ?? null,
        payment_reference: row.payment_reference ?? null,
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

  useEffect(() => {
    let alive = true
    if (!supabase || !signedInEmail) {
      setIsAdmin(false)
      setAdminRoleLoading(false)
      return
    }
    setAdminRoleLoading(true)
    void (async () => {
      try {
        const { data, error } = await supabase.rpc('is_admin')
        if (!alive) return
        setIsAdmin(!error && data === true)
        setAdminRoleLoading(false)
      } catch {
        if (alive) {
          setIsAdmin(false)
          setAdminRoleLoading(false)
        }
      }
    })()
    return () => { alive = false }
  }, [signedInEmail])

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
    if (!supabase || !signedInUserId) {
      setAccountProfile(null)
      setAccountMembership(null)
      setProfileName('')
      setProfileUsername('')
      return
    }
    let alive = true
    void (async () => {
      const [{ data: profile, error: profileError }, { data: membership, error: membershipError }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, username, avatar_url, role').eq('id', signedInUserId).maybeSingle(),
        supabase.from('memberships').select('plan, status, starts_at, ends_at').eq('user_id', signedInUserId).maybeSingle(),
      ])
      if (!alive) return
      if (profileError) {
        setNotice(`Gagal memuat profil: ${profileError.message}. Jalankan migration profil terbaru di Supabase.`)
      } else if (profile) {
        const next = profile as AccountProfile
        setAccountProfile(next)
        setProfileName(next.full_name || '')
        setProfileUsername(next.username || '')
      }
      if (membershipError) {
        setNotice(`Gagal memuat detail membership: ${membershipError.message}`)
      } else {
        setAccountMembership((membership as AccountMembership | null) ?? null)
      }
    })()
    return () => { alive = false }
  }, [signedInUserId])

  const handleProfileSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!supabase || !signedInUserId || !accountProfile) return
    const username = profileUsername.trim().replace(/^@/, '').toLowerCase()
    if (!/^[a-z0-9._]{3,24}$/.test(username)) {
      action('Username harus 3–24 karakter dan hanya boleh berisi huruf kecil, angka, titik, atau garis bawah.')
      return
    }
    setProfileSaving(true)
    try {
      const { data, error } = await supabase.from('profiles').update({ full_name: profileName.trim(), username }).eq('id', signedInUserId).select('id, full_name, username, avatar_url, role').single()
      if (error) throw error
      setAccountProfile(data as AccountProfile)
      action('Profil berhasil diperbarui.')
    } catch (error) {
      action(error instanceof Error ? error.message : 'Gagal menyimpan profil.')
    } finally { setProfileSaving(false) }
  }

  const handleAvatarUpload = async (file?: File) => {
    if (!supabase || !signedInUserId || !file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) { action('Format foto harus JPG, PNG, WEBP, atau GIF.'); return }
    if (file.size > 3 * 1024 * 1024) { action('Ukuran foto maksimal 3 MB.'); return }
    setAvatarUploading(true)
    try {
      const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `${signedInUserId}/avatar-${Date.now()}.${extension}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const { data: updated, error: updateError } = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', signedInUserId).select('id, full_name, username, avatar_url, role').single()
      if (updateError) throw updateError
      setAccountProfile(updated as AccountProfile)
      action('Foto profil berhasil diperbarui.')
    } catch (error) {
      action(error instanceof Error ? error.message : 'Upload foto profil gagal. Pastikan bucket avatars sudah dibuat di Supabase.')
    } finally { setAvatarUploading(false) }
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
      setSignedInUserId(data.session?.user.id ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedInEmail(session?.user.email ?? null)
      setSignedInUserId(session?.user.id ?? null)
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
  const selectedAdminMember = adminMembers.find(member => member.id === selectedAdminMemberId) || null
  const title = page === 'Overview' ? (language === 'id' ? 'Ringkasan pasar' : language === 'ja' ? 'マーケット概要' : language === 'zh' ? '市场概览' : language === 'ar' ? 'نظرة عامة على السوق' : 'Market overview') : page === 'Settings' ? tr('settings') : tr(({ 'Market':'market', 'News & Calendar':'news', 'Academy':'academy', 'Analysis':'analysis', 'About':'about', 'Membership':'membership', 'Login / Register':'login', 'Admin Panel':'admin', 'Transactions':'transactions' } as Record<string,string>)[page] || page)

  return <div className={`app-shell ${theme === 'light' ? 'theme-light' : 'theme-dark'}`} data-theme={theme}>
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand"><Logo small /><button className="icon-button mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={17}/></button></div>
      <div className="member-count-label"><span className="member-count-dot"/><span>482 ACTIVE MEMBERS</span></div>
      <div className="workspace-label"><span className="workspace-dot"/><span>{tr('workspace')}</span><ChevronDown size={13}/></div>
      <button onClick={() => go('Settings')} className={`nav-link settings-nav-link ${page === 'Settings' ? 'active' : ''}`}><Settings2 size={16}/><span>{tr('settings')}</span></button>
      {['PLATFORM', 'LEARN', 'ACCOUNT', 'PREVIEW'].map(group => <div className="nav-group" key={group}>
        <div className="nav-caption">{tr(group.toLowerCase())}</div>
        {nav.filter(n => n.group === group).map(item => { const Icon = item.icon; return <button key={item.label} onClick={() => go(item.label)} className={`nav-link ${page === item.label ? 'active' : ''}`}><Icon size={16}/><span>{tr(({ 'Overview':'overview', 'Market':'market', 'News & Calendar':'news', 'Academy':'academy', 'Analysis':'analysis', 'About':'about', 'Membership':'membership', 'Login / Register':'login', 'Admin Panel':'admin', 'Transactions':'transactions' } as Record<string,string>)[item.label] || item.label)}</span>{item.label === 'Admin Panel' && <span className="tiny-label">ADMIN</span>}</button> })}
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

        {page === 'Settings' && <>
          <PageIntro kicker="00 / PREFERENCES" title={tr('settingsTitle')} desc={tr('settingsDesc')} />
          <div className="settings-layout">
            <section className="glass-panel settings-card">
              <div className="settings-heading"><span className="settings-icon"><Globe2 size={17}/></span><div><h3>{tr('language')}</h3><p>{tr('languageDesc')}</p></div></div>
              <div className="settings-options language-options">{[{id:'en',native:'English',label:'English'},{id:'id',native:'Bahasa Indonesia',label:'Indonesia'},{id:'ja',native:'日本語',label:'Japanese'},{id:'zh',native:'中文',label:'Chinese'},{id:'ar',native:'العربية',label:'Arabic'}].map(item => <button type="button" key={item.id} className={`setting-option ${language === item.id ? 'selected' : ''}`} onClick={() => setLanguage(item.id)}><span><b>{item.native}</b><small>{item.label}</small></span>{language === item.id && <Check size={16}/>}</button>)}</div>
            </section>
            <section className="glass-panel settings-card">
              <div className="settings-heading"><span className="settings-icon"><Settings2 size={17}/></span><div><h3>{tr('appearance')}</h3><p>{tr('appearanceDesc')}</p></div></div>
              <div className="theme-options">
                <button type="button" className={`theme-option ${theme === 'dark' ? 'selected' : ''}`} onClick={() => setTheme('dark')}><span className="theme-preview theme-preview-dark"><span/><span/><span/></span><span className="theme-option-copy"><b>{tr('dark')}</b><small>{tr('darkDesc')}</small></span>{theme === 'dark' && <Check size={16}/>}</button>
                <button type="button" className={`theme-option ${theme === 'light' ? 'selected' : ''}`} onClick={() => setTheme('light')}><span className="theme-preview theme-preview-light"><span/><span/><span/></span><span className="theme-option-copy"><b>{tr('light')}</b><small>{tr('lightDesc')}</small></span>{theme === 'light' && <Check size={16}/>}</button>
              </div>
            </section>
            <div className="settings-saved"><Check size={14}/>{tr('saved')}</div>
          </div>
        </>}

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

        {page === 'News & Calendar' && <><PageIntro kicker="02 / INFORMATION" title="Stay informed. Stay objective." desc="A structured view for educational notes and economic-calendar layout. Entries below are demo content, not current news or verified event schedules."/><div className="two-column"><div className="glass-panel content-panel"><div className="panel-heading"><div><span className="section-kicker">EDITORIAL</span><h3>Research notes</h3></div><Pill tone="silver">DEMO</Pill></div>{news.map((n,i)=><article className="editorial-row" key={n.title}><div className="editorial-index">0{i+1}</div><div><Pill tone={n.impact === 'High' ? 'negative' : 'neutral'}>{n.tag}</Pill><h4>{n.title}</h4><p>Educational placeholder content. Check primary sources before making decisions.</p><span className="muted small-text">{n.time} · Illustrative entry</span></div><ArrowRight size={15}/></article>)}</div><div className="glass-panel content-panel"><LiveEconomicCalendar /></div></div></>}

        {page === 'Academy' && <><PageIntro kicker="03 / LEARNING" title="Build your trading foundation." desc="Structured learning paths designed to strengthen process, market understanding, and risk awareness."/><div className="academy-feature glass-panel"><div className="feature-copy"><span className="section-kicker">THE VELTRIX ACADEMY</span><h2>Learn the process.<br/><em>Not the shortcut.</em></h2><p>Education-first material for building a repeatable and risk-aware approach to markets.</p><button className="button button-primary" onClick={() => action('Learning preview selected. Lesson progress is not saved to an account.')}>Explore learning path <ArrowRight size={15}/></button></div><div className="feature-graphic"><BookOpen size={64} strokeWidth={1}/><span>VW / ACADEMY</span></div></div><div className="section-heading standalone"><div><span className="section-kicker">CURRICULUM</span><h2>Learning library</h2></div><div className="filter-tabs">{['All','Beginner','Intermediate','Advanced'].map(c=><button key={c} className={lessonFilter===c?'selected':''} onClick={()=>setLessonFilter(c)}>{c}</button>)}</div></div><div className="lesson-grid">{filteredLessons.map((l,i)=><article className="glass-panel lesson-card" key={l.title}><div className="lesson-art"><span>0{i+1}</span>{i===0?<BookOpen/>:i===1?<Activity/>:i===2?<Eye/>:<ShieldCheck/>}</div><div className="lesson-meta"><Pill tone="silver">{l.level}</Pill><span>{l.duration}</span></div><h3>{l.title}</h3><p>{l.desc}</p><button className="text-link" onClick={()=>action(`“${l.title}” is a placeholder lesson. Full lesson content is not connected yet.`)}>View lesson <ArrowRight size={14}/></button></article>)}</div></>}

        {page === 'Analysis' && <><PageIntro kicker="04 / TRADING INSIGHTS" title="Separate signal from noise." desc="An organized framework for reading market structure, mapping scenarios, and respecting invalidation."/><div className="analysis-layout"><div className="glass-panel analysis-main"><div className="panel-heading"><div><span className="section-kicker">MARKET STRUCTURE / EXAMPLE</span><h3>XAUUSD scenario board</h3></div><Pill tone="silver">ILLUSTRATIVE</Pill></div><div className="scenario-chart"><div className="level level-resistance"><span>Resistance zone · example</span></div><div className="scenario-candles">{Array.from({length:34},(_,i)=><span key={i} className={(i%5===0||i%7===0)?'down':''} style={{height:`${16+((i*23+i*i)%68)}%`,left:`${i*2.85}%`}}/>)}</div><div className="level level-support"><span>Support zone · example</span></div></div><div className="legend-row"><span><i className="legend-silver"/> Structure</span><span><i className="legend-dash"/> Example level</span><span className="muted">No live chart feed</span></div></div><div className="glass-panel analysis-side"><span className="section-kicker">SCENARIO FRAMEWORK</span><h3>Before any setup</h3>{[{n:'01',t:'Context',d:'Identify the broader structure and current range.'},{n:'02',t:'Liquidity',d:'Mark relevant areas without assuming a reaction.'},{n:'03',t:'Confirmation',d:'Define what evidence would support a scenario.'},{n:'04',t:'Invalidation',d:'State clearly what would make the idea invalid.'}].map(s=><div className="framework-row" key={s.n}><span>{s.n}</span><div><b>{s.t}</b><p>{s.d}</p></div></div>)}</div></div><div className="scenario-grid"><div className="glass-panel scenario-card"><Pill tone="positive">SCENARIO A</Pill><h3>Bullish case</h3><p>Illustrative conditional scenario, not a current signal.</p><ul><li>Price confirms strength above a defined level.</li><li>Retest holds within the planned risk.</li><li>Invalidation is defined before entry.</li></ul></div><div className="glass-panel scenario-card"><Pill tone="negative">SCENARIO B</Pill><h3>Bearish case</h3><p>Illustrative conditional scenario, not a current signal.</p><ul><li>Price rejects a defined resistance area.</li><li>Structure supports downside continuation.</li><li>Invalidation is defined before entry.</li></ul></div></div></>}

        {page === 'About' && <><PageIntro kicker="05 / ABOUT VELTRIX" title="Built for discipline. Driven by learning." desc="VELTRIX WARFARE is a trading-focused workspace for market observation, education, and structured decision-making. Clarity first. Risk always in view."/><div className="about-hero glass-panel"><div><span className="section-kicker">DISCIPLINE OVER EMOTION</span><h2>Observe.<br/>Calculate.<br/><em>Execute.</em></h2><p>We believe better decisions begin with a clear process. VELTRIX WARFARE brings market information, learning resources, and planning tools together in one focused environment. It is built to support your process—not to promise results.</p><a className="button button-primary about-contact-cta" href="https://whatsapp.com/channel/0029VbE447NHwXbJ6ZqLhI2w" target="_blank" rel="noreferrer">Hubungi Kami <ArrowRight size={15}/></a></div><div className="about-symbol">V<span>VW / 01</span></div></div><div className="values-grid">{[{n:'01',t:'Clarity',d:'Understand the information in front of you and separate facts from assumptions.'},{n:'02',t:'Discipline',d:'Build a repeatable process, define risk, and avoid decisions driven by emotion.'},{n:'03',t:'Continuous learning',d:'Review, learn, and improve your understanding of the market over time.'}].map(v=><div className="glass-panel value-card" key={v.n}><span>{v.n}</span><h3>{v.t}</h3><p>{v.d}</p></div>)}</div><section className="about-legal glass-panel"><div className="about-link-row"><a href="https://whatsapp.com/channel/0029VbE447NHwXbJ6ZqLhI2w" target="_blank" rel="noreferrer">Hubungi Kami <ArrowRight size={13}/></a><a href="#veltrix-privacy">Kebijakan Privasi</a><a href="#veltrix-legal">Dokumentasi Legal</a></div><div id="veltrix-privacy" className="about-legal-copy"><b>Kebijakan Privasi</b><p>VELTRIX WARFARE menghormati privasi pengguna. Informasi akun yang diberikan saat pendaftaran digunakan untuk mengelola akses, keanggotaan, keamanan, dan layanan platform. Jangan mengirimkan kata sandi, kode OTP, atau informasi pembayaran yang bersifat rahasia melalui kanal publik. Jika memiliki pertanyaan mengenai data akun, hubungi kami melalui kanal resmi.</p></div><div id="veltrix-legal" className="about-legal-copy"><b>Informasi dan Ketentuan</b><p>Konten di VELTRIX WARFARE disediakan untuk tujuan informasi dan edukasi. Materi, tampilan, analisis, dan contoh yang tersedia bukan rekomendasi investasi, ajakan membeli atau menjual instrumen keuangan, maupun jaminan keuntungan. Data pasar dapat tertunda, tidak lengkap, atau berbeda dari harga eksekusi broker. Pengguna bertanggung jawab untuk melakukan riset sendiri dan memahami risiko sebelum mengambil keputusan.</p><p><strong>Peringatan Risiko:</strong> Perdagangan Forex, CFD, aset kripto, dan instrumen berleverage memiliki risiko tinggi, termasuk kemungkinan kehilangan sebagian atau seluruh modal. Produk berleverage tidak cocok untuk semua orang. Gunakan manajemen risiko dan jangan pernah menggunakan dana yang tidak siap untuk hilang.</p></div><div className="about-copyright">© 2026 VELTRIX WARFARE · All rights reserved.</div></section></>}

        {page === 'Membership' && <><PageIntro kicker="06 / MEMBERSHIP" title="Choose your level of access." desc="Pilih paket, bayar menggunakan QRIS, lalu unggah bukti untuk diverifikasi admin. Membership aktif setelah pembayaran dicocokkan."/><div className="billing-row"><span>Billing period</span><div className="segmented">{(['Monthly','Yearly'] as const).map(b=><button key={b} className={billing===b?'selected':''} onClick={()=>setBilling(b)}>{b}{b==='Yearly'&&<small> SAVE 20%</small>}</button>)}</div></div><div className="pricing-grid">{[{name:'Essential',price:billing==='Monthly'?'79k':'758k',desc:'A focused starting point.',features:['Market overview','Learning library','Basic market notes']},{name:'Advanced',price:billing==='Monthly'?'149k':'1.430k',desc:'For a more structured workflow.',features:['Everything in Essential','Extended analysis library','Scenario frameworks','Advanced learning paths'],featured:true},{name:'Private',price:billing==='Monthly'?'299k':'2.870k',desc:'A comprehensive platform concept.',features:['Everything in Advanced','Premium research layout','Priority content access','Member features (planned)']}].map(p=><div className={`glass-panel price-card ${p.featured?'featured':''}`} key={p.name}>{p.featured&&<span className="popular-label">FEATURED PLAN</span>}<span className="section-kicker">{p.name.toUpperCase()} ACCESS</span><h3>{p.name}</h3><p>{p.desc}</p><div className="price"><b>Rp {p.price}</b><span>/{billing==='Monthly'?'month':'year'}</span></div><div className="price-divider"/>{p.features.map(f=><div className="feature-check" key={f}><Check size={15}/>{f}</div>)}<button className={`button ${p.featured?'button-primary':'button-outline'} full-button`} onClick={()=>void handleCheckout(p.name)} disabled={paymentBusyPlan!==null}>{paymentBusyPlan===p.name?'Preparing checkout…':'Select plan'} <ArrowRight size={14}/></button></div>)}</div>
          <p className="fine-print">Pembayaran hanya diverifikasi setelah admin mencocokkan transaksi pada aplikasi merchant resmi. Upload bukti tidak otomatis mengaktifkan membership.</p></>}

        {page === 'Payment' && <><PageIntro kicker="PAYMENT / MANUAL QRIS" title="Complete your payment." desc="Pembayaran diverifikasi manual oleh admin. Membership tidak aktif sampai transaksi cocok dengan catatan merchant."/>
          {!activePayment ? <div className="glass-panel manual-payment-panel"><p className="muted">Tidak ada transaksi checkout yang aktif.</p><button type="button" className="button button-primary" onClick={() => go('Membership')}>Back to membership <ArrowRight size={14}/></button></div> :
          <section className="glass-panel manual-payment-panel">
            <div className="panel-heading"><div><span className="section-kicker">SECURE CHECKOUT / MANUAL QRIS</span><h2>VELTRIX WARFARE</h2></div><Pill tone="silver">{activePayment.status.replace(/_/g,' ').toUpperCase()}</Pill></div>
            <div className="manual-payment-grid">
              <div className="qris-card"><img src="/qris-merchant.jpg" alt="QRIS merchant asli — scan menggunakan aplikasi pembayaran" /><p className="muted">Gunakan gambar QRIS asli. Periksa nama merchant dan nominal di aplikasi pembayaran sebelum membayar.</p></div>
              <div className="payment-details"><span className="section-kicker">DISCIPLINE OVER EMOTION</span><h3>{activePayment.plan} / {activePayment.billing_period}</h3><div className="payment-amount">Rp {activePayment.amount.toLocaleString('id-ID')}</div><div className="payment-id"><small>TRANSACTION ID</small><b>{activePayment.order_id}</b></div>
                <ol className="payment-instructions"><li>Buka aplikasi bank atau e-wallet yang mendukung QRIS.</li><li>Scan QRIS dan periksa nama merchant pada aplikasi.</li><li>Bayar dengan nominal tepat seperti yang tertera.</li><li>Simpan bukti pembayaran, lalu unggah di bawah.</li></ol>
                {activePayment.status === 'pending_verification' ? <div className="auth-note"><ShieldCheck size={15}/> Bukti sudah diajukan. Menunggu verifikasi admin; membership belum aktif.</div> : <>
                  <label className="form-label">Payment proof · JPG / PNG / WEBP · maks. 3 MB
                    <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" onChange={e=>{setProofFile(e.target.files?.[0] || null);setNotice('')}} />
                  </label>
                  {proofFile && <div className="auth-note"><FileText size={15}/> {proofFile.name} · {(proofFile.size/1024).toFixed(0)} KB</div>}
                  <button type="button" className="button button-primary full-button" disabled={!proofFile || proofBusy} onClick={()=>void submitPaymentProof()}>{proofBusy?'Mengunggah bukti…':'Submit payment proof'} <ArrowRight size={14}/></button>
                </>}
                <button type="button" className="button button-outline full-button" onClick={()=>{setActivePayment(null);setProofFile(null);setNotice('');setPage('Membership')}}>Close checkout</button>
              </div>
            </div>
            <p className="fine-print">Jangan mengunggah bukti palsu. Admin akan mencocokkan pembayaran di aplikasi merchant resmi.</p>
          </section>}
        </>}

        {page === 'Login / Register' && <><PageIntro kicker="07 / ACCOUNT ACCESS" title="Your workspace starts here." desc="Sign in or create your VELTRIX WARFARE account securely."/><div className="auth-wrap"><div className="glass-panel auth-card"><Logo/>{signedInEmail ? <><div className="auth-tabs"><button className="selected" type="button">Account profile</button><button type="button" onClick={() => void handleLogout()} disabled={authBusy}>Logout</button></div><h2>Your account.</h2><p className="muted">Signed in as {signedInEmail}</p><div className="profile-summary"><div className="profile-avatar-wrap"><div className="profile-avatar">{accountProfile?.avatar_url ? <img src={accountProfile.avatar_url} alt="Profile"/> : <span>{(accountProfile?.full_name || signedInEmail).slice(0,1).toUpperCase()}</span>}</div><label className="button button-outline avatar-upload">{avatarUploading ? 'Uploading…' : 'Change photo'}<input type="file" accept="image/*" disabled={avatarUploading} onChange={e => { void handleAvatarUpload(e.target.files?.[0]); e.currentTarget.value = '' } }/></label></div><div className="profile-identity"><b>{accountProfile?.full_name || 'VELTRIX Member'}</b><span>@{accountProfile?.username || 'username'}</span><Pill tone={accountProfile?.role === 'admin' ? 'silver' : 'neutral'}>{accountProfile?.role === 'admin' ? 'ADMIN' : 'MEMBER'}</Pill></div></div><form onSubmit={handleProfileSave} className="profile-edit-form"><label className="form-label">Display name<input value={profileName} onChange={e=>setProfileName(e.target.value)} maxLength={80} placeholder="Your name" required/></label><label className="form-label">Username<input value={profileUsername} onChange={e=>setProfileUsername(e.target.value)} maxLength={24} placeholder="yourusername" required/><small className="field-hint">3–24 karakter · huruf kecil, angka, titik, garis bawah</small></label><button className="button button-primary full-button" type="submit" disabled={profileSaving || !accountProfile}>{profileSaving ? 'Saving…' : 'Save profile'} <Check size={14}/></button></form><div className="membership-profile"><div className="panel-heading"><div><span className="section-kicker">MEMBERSHIP DETAILS</span><h3>Account access</h3></div><Pill tone={accountMembership?.status === 'active' && (!accountMembership.starts_at || new Date(accountMembership.starts_at).getTime() <= Date.now()) && (!accountMembership.ends_at || new Date(accountMembership.ends_at).getTime() > Date.now()) ? 'positive' : 'neutral'}>{accountMembership?.status === 'active' && (!accountMembership.starts_at || new Date(accountMembership.starts_at).getTime() <= Date.now()) && (!accountMembership.ends_at || new Date(accountMembership.ends_at).getTime() > Date.now()) ? 'ACTIVE' : accountMembership?.status?.toUpperCase() || 'NOT ACTIVE'}</Pill></div><div className="membership-profile-grid"><div><small>ACTIVATED AS</small><b>{accountMembership?.plan || 'No membership'}</b></div><div><small>START DATE</small><b>{accountMembership?.starts_at ? new Date(accountMembership.starts_at).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}) : '—'}</b></div><div><small>END DATE</small><b>{accountMembership?.ends_at ? new Date(accountMembership.ends_at).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}) : '—'}</b></div></div></div><div className="auth-note"><ShieldCheck size={14}/> Role and membership status are read from Supabase.</div></> : <><div className="auth-tabs"><button type="button" className={authMode==='Login'?'selected':''} onClick={()=>setAuthMode('Login')}>Login</button><button type="button" className={authMode==='Create account'?'selected':''} onClick={()=>setAuthMode('Create account')}>Create account</button></div><h2>{authMode==='Login'?'Welcome back.':'Create your account.'}</h2><p className="muted">Access your VELTRIX WARFARE workspace.</p><form onSubmit={handleAuthSubmit}><label className="form-label">Email address<input type="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required/></label>{authMode==='Create account'&&<label className="form-label">Display name<input type="text" value={authName} onChange={e=>setAuthName(e.target.value)} placeholder="Your name" autoComplete="name" maxLength={80} required/></label>}<label className="form-label">Password<input type="password" value={authPassword} onChange={e=>setAuthPassword(e.target.value)} minLength={8} placeholder="At least 8 characters" autoComplete={authMode==='Login'?'current-password':'new-password'} required/></label>{authMode==='Login'&&<button type="button" className="forgot-link" disabled={authBusy} onClick={()=>void handlePasswordReset()}>Forgot password?</button>}<button className="button button-primary full-button" type="submit" disabled={authBusy}>{authBusy?'Please wait...':authMode==='Login'?'Continue':'Create account'} <ArrowRight size={14}/></button></form><div className="auth-note"><LockKeyhole size={14}/> {supabase ? 'Secure authentication powered by Supabase.' : 'Authentication requires Supabase configuration.'}</div></>}</div></div></>}

        {page === 'Admin Panel' && <>
          <PageIntro kicker="08 / CONTROL ROOM" title="Administration control room." desc="Kelola akun dan status membership yang tersimpan di database. Semua perubahan memerlukan role admin yang diverifikasi Supabase."/>
          {!adminAuthorized ? <div className="glass-panel content-panel"><div className="panel-heading"><h3>Admin access required</h3><ShieldCheck size={18}/></div><p className="muted">{adminLoading ? 'Memeriksa sesi dan hak akses admin…' : adminError || 'Masuk menggunakan akun admin untuk membuka kontrol panel.'}</p><div className="welcome-actions"><button className="button button-primary" onClick={() => go('Login / Register')}>Open login <ArrowRight size={14}/></button><button className="button button-outline" disabled={adminLoading} onClick={() => void loadAdminData()}>{adminLoading ? 'Loading…' : 'Check access again'}</button></div></div> : <>
            <div className="demo-banner compact"><ShieldCheck size={16}/><span>ADMIN ACCESS VERIFIED · perubahan membership dicatat di Supabase.</span><button className="button button-outline" disabled={adminLoading} onClick={() => void loadAdminData()}><Activity size={14}/> Refresh</button></div>
            {adminError && <div className="demo-banner compact"><CircleHelp size={16}/><span>{adminError}</span></div>}
            <div className="admin-metrics">{[{l:'Registered members',v:String(adminMembers.length),s:'Profiles in database'},{l:'Active memberships',v:String(adminMembers.filter(m=>m.status==='active' && (!m.starts_at || new Date(m.starts_at).getTime() <= Date.now()) && (!m.ends_at || new Date(m.ends_at).getTime() > Date.now())).length),s:'Membership status active'},{l:'Inactive / no plan',v:String(adminMembers.filter(m=>m.status!=='active').length),s:'Includes accounts without membership'},{l:'Transactions',v:String(adminPayments.length),s:'Manual QRIS review queue'}].map(m=><div className="glass-panel admin-metric" key={m.l}><span>{m.l}</span><b>{m.v}</b><small>{m.s}</small></div>)}</div>
            <div className="glass-panel transactions-panel admin-directory-panel">
              <div className="panel-heading">
                <div><span className="section-kicker">MEMBER DIRECTORY</span><h3>Accounts & membership</h3></div>
                <Pill tone="silver">{adminMembers.length} ACCOUNTS</Pill>
              </div>
              {adminLoading ? <div className="empty-state large-empty"><b>Loading member data…</b></div> : adminMembers.length === 0 ? <div className="empty-state large-empty"><div className="empty-icon"><GraduationCap size={22}/></div><b>No member profiles found</b><span>Setelah user registrasi, profil akan tampil di sini jika trigger database berhasil.</span></div> : selectedAdminMember ? <div className="admin-member-editor">
                <button type="button" className="admin-back-button" onClick={() => setSelectedAdminMemberId(null)}><ArrowLeft size={15}/> Back to member list</button>
                <div className="admin-editor-heading">
                  <div className="admin-member-avatar">{(selectedAdminMember.full_name || 'M').slice(0,1).toUpperCase()}</div>
                  <div className="admin-member-title"><span className="section-kicker">ACCOUNT MEMBERSHIP</span><h3>{selectedAdminMember.full_name || 'Unnamed member'}</h3><small>{selectedAdminMember.id.slice(0,8)}… · joined {selectedAdminMember.created_at ? new Date(selectedAdminMember.created_at).toLocaleDateString('id-ID') : 'unknown date'}</small></div>
                  <Pill tone={selectedAdminMember.role === 'admin' ? 'silver' : 'neutral'}>{selectedAdminMember.role.toUpperCase()}</Pill>
                </div>
                {selectedAdminMember.role === 'admin' ? <div className="admin-protected-note"><ShieldCheck size={16}/> Admin account dilindungi dan tidak dapat diubah melalui editor membership.</div> : <>
                  <div className="admin-editor-grid">
                    <label className="form-label">Plan<select value={selectedAdminMember.plan || 'Essential'} onChange={e=>editAdminMember(selectedAdminMember.id,{plan:e.target.value})}><option value="Essential">Essential</option><option value="Advanced">Advanced</option><option value="Private">Private</option></select></label>
                    <label className="form-label">Status<select value={selectedAdminMember.status || 'inactive'} onChange={e=>editAdminMember(selectedAdminMember.id,{status:e.target.value})}><option value="inactive">Inactive</option><option value="active">Active</option><option value="expired">Expired</option><option value="cancelled">Cancelled</option></select></label>
                    <label className="form-label">Start date<input type="date" value={selectedAdminMember.starts_at ? selectedAdminMember.starts_at.slice(0,10) : ''} onChange={e=>editAdminMember(selectedAdminMember.id,{starts_at:e.target.value || null})}/></label>
                    <label className="form-label">End date<input type="date" value={selectedAdminMember.ends_at ? selectedAdminMember.ends_at.slice(0,10) : ''} onChange={e=>editAdminMember(selectedAdminMember.id,{ends_at:e.target.value || null})}/></label>
                    <label className="form-label admin-reference-field">Payment reference<input type="text" value={selectedAdminMember.payment_reference || ''} onChange={e=>editAdminMember(selectedAdminMember.id,{payment_reference:e.target.value || null})} placeholder="Invoice / transfer reference" maxLength={120}/></label>
                  </div>
                  <div className="admin-editor-footer"><span>Changes are saved to the membership database.</span><button className="button button-primary" disabled={adminBusyUser===selectedAdminMember.id} onClick={()=>void updateAdminMember(selectedAdminMember)}>{adminBusyUser===selectedAdminMember.id?'Saving…':'Save changes'} <Check size={14}/></button></div>
                </>}
              </div> : <div className="admin-directory-list">{adminMembers.map(member=><button type="button" className="admin-directory-item" key={member.id} onClick={() => setSelectedAdminMemberId(member.id)}>
                <span className="admin-directory-avatar">{(member.full_name || 'M').slice(0,1).toUpperCase()}</span>
                <span className="admin-directory-name"><b>{member.full_name || 'Unnamed member'}</b><small>{member.role.toUpperCase()} ACCOUNT</small></span>
                <ChevronRight size={17}/>
              </button>)}</div>}
            </div>
            <div className="glass-panel transactions-panel admin-payment-review"><div className="panel-heading"><div><span className="section-kicker">MANUAL QRIS</span><h3>Payment verification queue</h3></div><button className="button button-outline" disabled={adminPaymentsBusy} onClick={()=>void loadAdminPayments()}>{adminPaymentsBusy?'Loading…':'Refresh queue'}</button></div>
              {adminPayments.length===0 ? <div className="empty-state"><b>No submitted proofs loaded</b><span>Refresh queue to check payment submissions.</span></div> : <div className="admin-member-list">{adminPayments.map(tx=><div className="admin-member-row" key={tx.order_id}><div className="admin-member-info"><b>{tx.order_id}</b><small>{tx.plan} · {tx.billing_period} · Rp {Number(tx.amount).toLocaleString('id-ID')}</small><small>Member: {tx.user_id} · {tx.status}</small><small>{tx.created_at ? new Date(tx.created_at).toLocaleString('id-ID') : ''}</small>{tx.proof_url && <a className="text-link" href={tx.proof_url} target="_blank" rel="noreferrer">Open private proof <ArrowRight size={13}/></a>}</div><div className="admin-member-actions"><button className="button button-primary" disabled={adminDecisionBusy===tx.order_id || tx.status!=='pending_verification' || !tx.proof_url} onClick={()=>void reviewPayment(tx.order_id,'approved')}>{adminDecisionBusy===tx.order_id?'Saving…':'Approve payment'}</button><button className="button button-outline" disabled={adminDecisionBusy===tx.order_id || tx.status!=='pending_verification'} onClick={()=>void reviewPayment(tx.order_id,'rejected')}>Reject</button></div></div>)}</div>}
            </div>
            <div className="two-column"><div className="glass-panel content-panel"><div className="panel-heading"><h3>Platform management</h3><Pill tone="silver">CONNECTED</Pill></div><div className="admin-action"><span className="admin-action-icon"><Wallet size={17}/></span><span><b>Membership plans</b><small>Essential, Advanced, Private · payment checkout still disabled</small></span></div><div className="admin-action"><span className="admin-action-icon"><Newspaper size={17}/></span><span><b>Content library</b><small>Content editor not implemented yet</small></span></div></div><div className="glass-panel content-panel"><div className="panel-heading"><h3>System status</h3><Activity size={16}/></div>{[{k:'Frontend',v:'Available'},{k:'Authentication',v:'Connected'},{k:'Database',v:'Connected'},{k:'Payment provider',v:'Not connected'}].map(x=><div className="system-row" key={x.k}><span>{x.k}</span><Pill tone={x.v==='Available'||x.v==='Connected'?'positive':'neutral'}>{x.v}</Pill></div>)}</div></div>
          </>}
        </>}

        {page === 'Transactions' && <><PageIntro kicker="09 / ACCOUNT RECORDS" title="Transaction history." desc="Pantau pengajuan QRIS dan status verifikasi pembayaran membership."/><div className="glass-panel transactions-panel"><div className="panel-heading"><div><span className="section-kicker">FINANCIAL RECORDS</span><h3>Your transactions</h3></div><button className="button button-outline" onClick={()=>void loadPaymentHistory()}><Activity size={14}/> Refresh</button></div>{paymentHistory.length===0 ? <div className="empty-state large-empty"><div className="empty-icon"><FileText size={22}/></div><b>No transaction records loaded</b><span>Tekan Refresh setelah login untuk memuat transaksi akun lu.</span></div> : <div className="admin-member-list">{paymentHistory.map(tx=><div className="admin-member-row" key={tx.order_id}><div className="admin-member-info"><b>{tx.order_id}</b><small>{tx.plan} · {tx.billing_period} · {new Date(tx.created_at).toLocaleString('id-ID')}</small>{tx.rejection_reason && <small>Catatan: {tx.rejection_reason}</small>}</div><div className="admin-member-actions"><b>Rp {Number(tx.amount).toLocaleString('id-ID')}</b><Pill tone={tx.status==='approved'?'positive':tx.status==='rejected'?'negative':'silver'}>{String(tx.status).replace(/_/g,' ').toUpperCase()}</Pill></div></div>)}</div>}</div></>}
      </div>
      <footer className="app-footer"><div><Logo small/><span>© 2026 VELTRIX WARFARE</span></div><span className="footer-disclaimer">Frontend preview · Demo data · Not financial advice</span><button onClick={()=>go('About')}>Platform information <ArrowRight size={13}/></button></footer>
    </main>
  </div>
}

function PageIntro({ kicker, title, desc }: { kicker: string; title: string; desc: string }) {
  return <section className="page-intro"><span className="section-kicker">{kicker}</span><h1>{title}</h1><p>{desc}</p></section>
}
