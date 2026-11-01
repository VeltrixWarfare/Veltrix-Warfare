type Note = { title: string; summary: string; url: string; publishedAt: string; source: string }

const FEEDS = [
  { name: 'CNBC', url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { name: 'BBC Business', url: 'https://feeds.bbci.co.uk/news/business/rss.xml' },
]

function decodeXml(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ').trim()
}

function tag(item: string, name: string) {
  const match = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))
  return match?.[1] ? decodeXml(match[1]) : ''
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300')
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const results = await Promise.all(FEEDS.map(async feed => {
    try {
      const response = await fetch(feed.url, {
        headers: { 'User-Agent': 'VeltrixWarfareResearch/1.0 (market headlines reader)' },
        signal: AbortSignal.timeout(7000),
      })
      if (!response.ok) throw new Error(`Feed returned ${response.status}`)
      const xml = await response.text()
      const items = [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(match => {
        const item = match[1]
        const title = tag(item, 'title')
        const url = tag(item, 'link') || (item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '').trim()
        const published = tag(item, 'pubDate') || tag(item, 'dc:date')
        const summary = tag(item, 'description')
        const date = published ? new Date(published) : null
        if (!title || !url || !/^https?:\/\//i.test(url)) return null
        return {
          title, summary: summary.slice(0, 280),
          url, publishedAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : '',
          source: feed.name,
        } satisfies Note
      }).filter((item): item is Note => Boolean(item))
      return { notes: items, source: feed.name, ok: true }
    } catch {
      return { notes: [] as Note[], source: feed.name, ok: false }
    }
  }))

  const notes = results.flatMap(result => result.notes)
    .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0))
    .filter((item, index, all) => all.findIndex(other => other.url === item.url) === index)
    .slice(0, 8)

  if (!notes.length) return res.status(502).json({
    error: 'Sumber editorial sedang tidak dapat diakses.',
    updatedAt: new Date().toISOString(),
    sources: results.map(({ source, ok }) => ({ source, ok })),
    notes: [],
  })

  return res.status(200).json({
    updatedAt: new Date().toISOString(),
    sources: results.map(({ source, ok }) => ({ source, ok })),
    notes,
  })
}
