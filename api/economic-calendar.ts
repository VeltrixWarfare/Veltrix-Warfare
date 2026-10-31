type CalendarEvent = {
  id: string
  datetime: string
  country: string
  currency: string
  event: string
  impact: "low" | "medium" | "high"
  forecast: string | null
  previous: string | null
  actual: string | null
  source: string | null
  sourceUrl: string | null
  eventUrl: string | null
  lastUpdated: string | null
}

const COUNTRY_CURRENCY: Record<string, string> = {
  "united states": "USD",
  "united kingdom": "GBP",
  "euro area": "EUR",
  germany: "EUR",
  france: "EUR",
  italy: "EUR",
  spain: "EUR",
  netherlands: "EUR",
  portugal: "EUR",
  ireland: "EUR",
  japan: "JPY",
  australia: "AUD",
  canada: "CAD",
  switzerland: "CHF",
  china: "CNY",
  "new zealand": "NZD",
  indonesia: "IDR",
  "south korea": "KRW",
  singapore: "SGD",
  india: "INR",
  mexico: "MXN",
  brazil: "BRL",
  turkey: "TRY",
  sweden: "SEK",
  norway: "NOK",
  denmark: "DKK",
  poland: "PLN",
  thailand: "THB",
  "south africa": "ZAR",
}

function isoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  const raw = value.trim()
  // Trading Economics documents calendar timestamps as UTC. Older date formats
  // are parsed by the Node runtime (Vercel runs in UTC).
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function safeText(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  return String(value)
}

function impactFrom(value: unknown): CalendarEvent["impact"] {
  const level = Number(value)
  if (level >= 3) return "high"
  if (level === 2) return "medium"
  return "low"
}

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120")
  res.setHeader("Content-Type", "application/json; charset=utf-8")

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET")
    return res.status(405).json({ error: "Method not allowed." })
  }

  const apiKey = process.env.TE_API_KEY
  if (!apiKey) {
    return res.status(503).json({
      error: "Economic calendar is not configured. Add TE_API_KEY to Vercel Environment Variables.",
      code: "MISSING_API_KEY",
    })
  }

  const now = new Date()
  const defaultFrom = now.toISOString().slice(0, 10)
  const defaultTo = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const from = typeof req.query?.from === "string" ? req.query.from : defaultFrom
  const to = typeof req.query?.to === "string" ? req.query.to : defaultTo
  const datePattern = /^\d{4}-\d{2}-\d{2}$/

  if (!datePattern.test(from) || !datePattern.test(to)) {
    return res.status(400).json({ error: "Dates must use YYYY-MM-DD format." })
  }

  const startMs = Date.parse(`${from}T00:00:00Z`)
  const endMs = Date.parse(`${to}T23:59:59Z`)
  const spanDays = (endMs - startMs) / (24 * 60 * 60 * 1000)

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs || spanDays > 14) {
    return res.status(400).json({ error: "Choose a valid date range of up to 14 days." })
  }

  try {
    const url = new URL(`https://api.tradingeconomics.com/calendar/${from}/${to}`)
    url.searchParams.set("c", apiKey)
    url.searchParams.set("f", "json")

    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000),
    })

    if (!response.ok) {
      // Do not expose the provider URL or API key in client-facing errors.
      const status = response.status === 401 || response.status === 403 ? 502 : response.status
      return res.status(status).json({
        error: response.status === 401 || response.status === 403
          ? "The calendar provider rejected the API key or plan. Check your Trading Economics access."
          : `Calendar provider returned HTTP ${response.status}. Please retry shortly.`,
        code: "PROVIDER_ERROR",
      })
    }

    const raw = await response.json()
    if (!Array.isArray(raw)) {
      return res.status(502).json({ error: "The calendar provider returned an unexpected response.", code: "BAD_PROVIDER_RESPONSE" })
    }

    const events: CalendarEvent[] = raw
      .map((item: any, index: number) => {
        const country = safeText(item.Country) || "Unknown"
        const eventUrlPath = safeText(item.URL)
        const sourceUrl = safeText(item.SourceURL)
        const datetime = isoDate(item.Date)
        return {
          id: safeText(item.CalendarID) || `${datetime || "event"}-${index}`,
          datetime: datetime || "",
          country,
          currency: COUNTRY_CURRENCY[country.toLowerCase()] || "—",
          event: safeText(item.Event) || safeText(item.Category) || "Economic release",
          impact: impactFrom(item.Importance),
          forecast: safeText(item.Forecast),
          previous: safeText(item.Previous),
          actual: safeText(item.Actual),
          source: safeText(item.Source),
          sourceUrl: sourceUrl && /^https?:\/\//i.test(sourceUrl) ? sourceUrl : null,
          eventUrl: eventUrlPath
            ? `https://tradingeconomics.com${eventUrlPath.startsWith("/") ? eventUrlPath : `/${eventUrlPath}`}`
            : null,
          lastUpdated: isoDate(item.LastUpdate),
        } satisfies CalendarEvent
      })
      .filter((event: CalendarEvent) => event.datetime && event.event)
      .sort((a: CalendarEvent, b: CalendarEvent) => Date.parse(a.datetime) - Date.parse(b.datetime))

    return res.status(200).json({
      events,
      count: events.length,
      range: { from, to },
      source: "Trading Economics",
      fetchedAt: new Date().toISOString(),
    })
  } catch {
    return res.status(502).json({
      error: "Could not reach the calendar provider. Check your connection and try again.",
      code: "FETCH_FAILED",
    })
  }
}
