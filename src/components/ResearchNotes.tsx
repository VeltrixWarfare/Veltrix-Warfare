import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, RefreshCw } from 'lucide-react'

type Note = { title: string; summary: string; url: string; publishedAt: string; source: string }
type FeedResponse = { updatedAt?: string; notes?: Note[]; sources?: { source: string; ok: boolean }[]; error?: string }

function relativeTime(value: string) {
  if (!value) return 'Waktu publikasi tidak tersedia'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Waktu publikasi tidak tersedia'
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(date) + ' WIB'
}

export default function ResearchNotes() {
  const [data, setData] = useState<FeedResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastChecked, setLastChecked] = useState('')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const response = await fetch('/api/editorial', { headers: { Accept: 'application/json' } })
      const payload = await response.json() as FeedResponse
      setData(payload)
      setLastChecked(new Date().toISOString())
      if (!response.ok || !payload.notes?.length) setError(payload.error || 'Belum ada artikel yang bisa dimuat.')
      else setError('')
    } catch {
      setError('Tidak dapat terhubung ke sumber editorial. Coba perbarui kembali.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = window.setInterval(() => void load(true), 120_000)
    return () => window.clearInterval(interval)
  }, [load])

  const sourceStatus = data?.sources?.some(source => source.ok)
  return <>
    <div className="panel-heading research-heading">
      <div><span className="section-kicker">EDITORIAL</span><h3>Research notes</h3></div>
      <span className={`research-status ${loading ? 'is-loading' : error ? 'is-error' : 'is-live'}`}>
        <span />{loading ? 'CONNECTING' : error ? 'UNAVAILABLE' : sourceStatus ? 'SOURCE CONNECTED' : 'UNAVAILABLE'}
      </span>
    </div>
    <p className="research-intro">Latest market and business headlines from external publishers. Headlines and summaries belong to their original sources.</p>
    {loading && !data?.notes?.length && <div className="research-message">Connecting to editorial sources…</div>}
    {!loading && error && !data?.notes?.length && <div className="research-message"><p>{error}</p><button className="text-link" onClick={() => void load()}><RefreshCw size={13}/> Retry connection</button></div>}
    {data?.notes?.map((note, i) => <article className="editorial-row" key={note.url}>
      <div className="editorial-index">{String(i + 1).padStart(2, '0')}</div>
      <div>
        <span className="research-source">{note.source}</span>
        <h4><a href={note.url} target="_blank" rel="noopener noreferrer">{note.title}</a></h4>
        {note.summary && <p>{note.summary}</p>}
        <span className="muted small-text">{relativeTime(note.publishedAt)}</span>
      </div>
      <a className="research-open" href={note.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${note.title}`}><ArrowRight size={15}/></a>
    </article>)}
    {error && data?.notes?.length ? <p className="research-warning">{error} · Menampilkan data terakhir yang berhasil dimuat.</p> : null}
    <div className="research-footer">
      <span>Auto-refresh · 2 min</span>
      <button className="text-link" onClick={() => void load()} disabled={loading}><RefreshCw size={12}/> Refresh</button>
      {lastChecked && <span>Checked {new Date(lastChecked).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })} WIB</span>}
    </div>
  </>
}
