# Veltrix Warfare — Free Economic Calendar

This replaces the earlier Trading Economics API patch with FinanceCalendar's official free embed.

- No API key.
- No paid subscription required for the widget.
- FinanceCalendar states the widget is free for commercial sites when its attribution link remains visible.
- The widget displays release time in the visitor's local timezone, impact, consensus (forecast), prior and actual when available.
- Data coverage and whether consensus/actual exists vary by event/source. Missing values are not fabricated.
- Provider documentation: https://www.financecalendar.com/widget/

## Install

1. Copy `src/components/LiveEconomicCalendar.tsx` and `src/components/live-economic-calendar.css` to the same paths in your repository.
2. In `src/App.tsx`, add:
   `import LiveEconomicCalendar from './components/LiveEconomicCalendar';`
3. Replace the old Economic Calendar demo section with:
   `<LiveEconomicCalendar />`
4. Commit/push to GitHub and wait for Vercel deployment.

If the old patch already inserted the `LiveEconomicCalendar` import and JSX, do not add a duplicate. Replace the old component file with this new one and add/replace its CSS.

## Clean up the previous paid-API patch

Once the new calendar is deployed and working:

- Delete `api/economic-calendar.ts` if it was added only for the old Trading Economics integration.
- Delete `scripts/apply-live-calendar.mjs` if it was added only for the old integration.
- Remove only the `TE_API_KEY` line from `.env.example` if present.
- Remove `TE_API_KEY` from Vercel Environment Variables if you previously created it.

Do not delete unrelated API routes, scripts, environment variables, or app files. The new widget does not use `TE_API_KEY`.

## Technical notes

The component loads the official FinanceCalendar widget script once and calls `FinanceCalendarWidget.init()` after loading, which supports mounting inside a React single-page app. Keep the provider's visible credit link intact. Do not hide or remove it with CSS.
