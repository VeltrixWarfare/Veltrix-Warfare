# Veltrix Warfare — Live Economic Calendar patch

This package adds a real economic calendar to the existing **News & Calendar** page.

## What it adds

- Upcoming and recently scheduled economic releases from Trading Economics
- Release time rendered in the visitor's local timezone
- Currency, event name, impact level, forecast, previous and actual values when available
- Filters for date range, currency, impact, and text search
- Refresh action and provider/source information
- Server-side API proxy so the provider key is not exposed to the browser

## Important: a provider API key is required

The calendar uses the Trading Economics API. Create/activate an API plan and obtain a key from the provider. Access limits and whether the API returns the fields you need depend on the provider's plan.

Official documentation:
- https://docs.tradingeconomics.com/economic_calendar/country/
- https://docs.tradingeconomics.com/economic_calendar/schema/
- https://docs.tradingeconomics.com/get_started/

This integration does not include a key and does not fabricate missing values. If forecast, previous, or actual is unavailable from the source, the UI displays `—`.

## Files to copy into the repository

Copy these paths from this ZIP into the root of your existing `Veltrix-Warfare` repository:

- `api/economic-calendar.ts`
- `src/components/LiveEconomicCalendar.tsx`
- `src/components/live-economic-calendar.css`
- `scripts/apply-live-calendar.mjs`

Do not overwrite your existing `src/App.tsx` with a file from this patch. It is not included in this ZIP.

## Connect it to the existing page

### Option A — run the integration script

From the root of the repository, run:

```bash
node scripts/apply-live-calendar.mjs
```

The script adds the component import and replaces the existing sample economic-calendar card. It stops without changing the app if the expected old block is not found.

### Option B — manual edit

1. In `src/App.tsx`, add this import beside the other local imports:

```tsx
import LiveEconomicCalendar from './components/LiveEconomicCalendar'
```

2. Find the existing second card inside the `page === 'News & Calendar'` block. Its heading is `CALENDAR INTERFACE` / `Economic calendar`. Replace that entire second card — including its sample event rows and the `Sample events only...` note — with:

```tsx
<LiveEconomicCalendar />
```

Keep the surrounding `<div className="two-column">` and its closing tags intact.

## Configure Vercel

1. Open the Veltrix Warfare project in Vercel.
2. Go to **Settings → Environment Variables**.
3. Add `TE_API_KEY` with your provider API key.
4. Enable it for the environments you use (Production, and Preview if needed).
5. Redeploy after saving the variable.

Do not use a `VITE_TE_API_KEY` variable. Anything prefixed with `VITE_` is bundled for browser access. The server route reads `TE_API_KEY` privately.

## Deploy and test

1. Commit and push the new files and `src/App.tsx` integration to GitHub.
2. Wait for the Vercel deployment to finish.
3. Open **News & Calendar** and check that the event rows load.
4. If the component shows an error, check the Vercel function logs and confirm the API key/plan.
5. Test a known past release to verify `Actual`, `Forecast`, and `Previous` are returned by the provider.

## Notes and limitations

- `api/economic-calendar.ts` is a Vercel Node serverless function. It uses Node's built-in `fetch`, compatible with the project's Node 22 setting.
- The endpoint limits a request to a maximum 14-day range and caches successful responses briefly.
- Impact is mapped from the provider's `Importance` field (`1 = low`, `2 = medium`, `3 = high`).
- Currency is mapped from the event's country because the provider's `Currency` field can represent the unit of an economic indicator rather than the affected FX currency.
- Event times are normalized from the provider response and displayed in the visitor's device timezone. Verify timezone display against a known release after deployment.
- This ZIP is an integration patch, not a complete copy of the website repository.
