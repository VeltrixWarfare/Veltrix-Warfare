import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, CalendarClock, CheckCircle2, Clock3, ExternalLink, Filter, RefreshCw, Search, TriangleAlert } from 'lucide-react'
import './live-economic-calendar.css'

type Impact = 'low' | 'medium' | 'high'
type CalendarEvent = {
  id: string
  datetime: string
  country: string
  currency: string
  event: string
  impact: Impact
  forecast: string | null
  previous: string | null
  actual: string | null
  source: string | null
  sourceUrl: string | null
  eventUrl: string | null
  lastUpdated: string | null
}
type CalendarResponse = {
  events: CalendarEvent[]
  count: number
  range: { from: string; to: string }
  source: string
  fetchedAt: string
  error?: string
}

const currencies = ['ALL', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'CNY', 'IDR', 'OTHER']
const impactOptions = ['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const

function dateInput(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}
function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}
function localDateKey(value: string) {
  return dateInput(new Date(value))
}
function displayValue(value: string | null) {
  return value?.trim() || '—'
}
function impactLabel(impact: Impact) {
  return impact.charAt(0).toUpperCase() + impact.slice(1)
}

export default function LiveEconomicCalendar() {
  const [from, setFrom] = useState(() => dateInput(new Date()))
  const [to, setTo] = useState(() => dateInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)))
  const [currency, setCurrency] = useState('ALL')
  const [impact, setImpact] = useState<(typeof impactOptions)[number]>('ALL')
  const [search, setSearch] = useState('')
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [source, setSource] = useState('Trading Economics')
  const [fetchedAt, setFetchedAt] = useState('')

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ from, to })
      const response = await fetch(`/api/economic-calendar?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      })
      const data = await response.json() as CalendarResponse
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
      setEvents(Array.isArray(data.events) ? data.events : [])
      setSource(data.source || 'Calendar data provider')
      setFetchedAt(data.fetchedAt || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the economic calendar.')
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { void loadEvents() }, [loadEvents])

  const filteredEvents = useMemo(() => events.filter(event => {
    const matchesCurrency = currency === 'ALL'
      || (currency === 'OTHER' ? !currencies.slice(1, -1).includes(event.currency) : event.currency === currency)
    const matchesImpact = impact === 'ALL' || event.impact.toUpperCase() === impact
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || `${event.event} ${event.country} ${event.currency}`.toLowerCase().includes(query)
    return matchesCurrency && matchesImpact && matchesSearch
  }), [events, currency, impact, search])

  const highImpactCount = events.filter(event => event.impact === 'high').length
  const nextEvent = events.find(event => Date.parse(event.datetime) >= Date.now())

  return (
    <section className="glass-panel content-panel vw-live-calendar">
      <div className="panel-heading vw-calendar-heading">
        <div>
          <span className="section-kicker">LIVE DATA / ECONOMIC RELEASES</span>
          <h3>Economic calendar</h3>
          <p className="vw-calendar-subtitle">Release times shown in your device's local timezone.</p>
        </div>
        <button type="button" className="button button-outline vw-calendar-refresh" onClick={() => void loadEvents()} disabled={loading} aria-label="Refresh calendar">
          <RefreshCw size={14} className={loading ? 'vw-spin' : ''} /> {loading ? 'Updating…' : 'Refresh'}
        </button>
      </div>

      <div className="vw-calendar-stats">
        <div><span><CalendarClock size={14} /> Events in range</span><b>{loading ? '—' : events.length}</b></div>
        <div><span><TriangleAlert size={14} /> High impact</span><b>{loading ? '—' : highImpactCount}</b></div>
        <div><span><Clock3 size={14} /> Next release</span><b>{loading ? '—' : nextEvent ? `${formatDate(nextEvent.datetime)} · ${formatTime(nextEvent.datetime)}` : 'No upcoming event'}</b></div>
      </div>

      <div className="vw-calendar-filters">
        <label className="vw-calendar-search"><Search size={14} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search events, country, currency…" /></label>
        <label className="vw-calendar-select"><span>Currency</span><select value={currency} onChange={event => setCurrency(event.target.value)}>{currencies.map(value => <option key={value} value={value}>{value === 'ALL' ? 'All currencies' : value === 'OTHER' ? 'Other / unmapped' : value}</option>)}</select></label>
        <label className="vw-calendar-select"><span>Impact</span><select value={impact} onChange={event => setImpact(event.target.value as (typeof impactOptions)[number])}>{impactOptions.map(value => <option key={value} value={value}>{value === 'ALL' ? 'All levels' : impactLabel(value.toLowerCase() as Impact)}</option>)}</select></label>
        <label className="vw-calendar-date"><span>From</span><input type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} /></label>
        <label className="vw-calendar-date"><span>To</span><input type="date" value={to} min={from} onChange={event => setTo(event.target.value)} /></label>
      </div>

      {error && <div className="vw-calendar-message vw-calendar-error"><TriangleAlert size={16} /><div><b>Calendar unavailable</b><p>{error}</p><small>After deployment, confirm TE_API_KEY is configured in Vercel and the provider plan permits calendar requests.</small></div></div>}
      {!error && loading && <div className="vw-calendar-message"><RefreshCw size={16} className="vw-spin" /> Loading calendar data…</div>}
      {!error && !loading && filteredEvents.length === 0 && <div className="vw-calendar-message"><Filter size={16} /> No events match these filters for the selected date range.</div>}

      {!error && !loading && filteredEvents.length > 0 && (
        <div className="vw-calendar-table-wrap">
          <table className="vw-calendar-table">
            <thead><tr><th>Time / Date</th><th>CCY</th><th>Event</th><th>Impact</th><th>Forecast</th><th>Previous</th><th>Actual</th></tr></thead>
            <tbody>
              {filteredEvents.map(event => {
                const released = Boolean(event.actual)
                return <tr key={event.id}>
                  <td className="vw-calendar-time"><b>{formatTime(event.datetime)}</b><small>{formatDate(event.datetime)}</small></td>
                  <td><span className="vw-calendar-currency">{event.currency}</span><small className="vw-calendar-country">{event.country}</small></td>
                  <td className="vw-calendar-event">
                    {event.eventUrl ? <a href={event.eventUrl} target="_blank" rel="noreferrer">{event.event}<ExternalLink size={11} /></a> : <b>{event.event}</b>}
                    {event.source && <small>{event.sourceUrl ? <a href={event.sourceUrl} target="_blank" rel="noreferrer">{event.source}</a> : event.source}</small>}
                  </td>
                  <td><span className={`vw-impact vw-impact-${event.impact}`}>{event.impact === 'high' ? <TriangleAlert size={11} /> : event.impact === 'medium' ? <Activity size={11} /> : <CheckCircle2 size={11} />}{impactLabel(event.impact)}</span></td>
                  <td>{displayValue(event.forecast)}</td>
                  <td>{displayValue(event.previous)}</td>
                  <td className={released ? 'vw-actual-released' : ''}>{displayValue(event.actual)}</td>
                </tr>
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="vw-calendar-footer">
        <span>Source: {source} · Values may be revised by the provider.</span>
        <span>{fetchedAt ? `Last fetched ${new Date(fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not yet updated'} · Refresh to check for releases.</span>
      </div>
    </section>
  )
}
