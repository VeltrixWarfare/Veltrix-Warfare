# Veltrix Warfare — Free Economic Calendar integration

The News & Calendar page now embeds Finance Calendar's official free widget.

## Included changes

- `src/App.tsx`: imports and renders `LiveEconomicCalendar` in the previous calendar panel.
- `src/components/LiveEconomicCalendar.tsx`: loads the official widget script and initializes it for this React single-page app.
- `src/components/live-economic-calendar.css`: styles the surrounding Veltrix interface.
- `.env.example`: removed the unused Trading Economics API key entry.

## Deploy

1. Upload/overwrite the files from this project ZIP in the matching paths in your GitHub repository.
2. Commit and push.
3. Vercel should deploy from the connected GitHub repository.
4. Open **News & Calendar** and verify the widget loads.

No API key, paid subscription, server-side endpoint, or Vercel environment variable is required for the widget.

## Data and attribution

The widget shows upcoming releases, visitor-local release times, impact, consensus (when supplied), prior and actual (when available). Missing values are not fabricated. Finance Calendar says the widget is free for commercial websites provided its Finance Calendar attribution link remains visible. Do not hide or remove that credit.

Official widget documentation: https://www.financecalendar.com/widget/

Provider data coverage and refresh timing are not guarantees of real-time broker data. Always check the original source for important event details.
