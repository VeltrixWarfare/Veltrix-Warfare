# VELTRIX WARFARE

Premium trading-platform frontend preview built with React, TypeScript and Vite.

## Included
- Responsive landing page and app-style navigation
- Dashboard, Market, News & Calendar, Academy, Analysis, About
- Membership/pricing, Login/Register UI, Admin preview and Transactions
- Market search, category filters, persistent browser watchlist, tabs, and timeframe controls
- Public market-data integration: live gold spot quote and BTC 24-hour ticker where provider endpoints are available; daily reference FX rates
- Market-feed connection state and last-refresh timestamp
- Original brand palette aligned with the supplied silver-on-black logo
- Vercel SPA rewrite configuration

## Important
This is still a frontend project. The market page now requests a public gold spot endpoint, Binance public BTC ticker, and daily reference FX rates. Availability and timing depend on those third-party providers; these are informational quotes, not broker execution prices. The chart illustration, news/calendar entries, account metrics, memberships and transactions remain demo content. Authentication, payments, server-side admin authorization, and Supabase are not connected. Do not use the admin or transaction preview to manage real users or payments.

## Run locally
Requires Node.js 18+.

```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Deploy to Vercel
1. Push the project folder to a new GitHub repository.
2. In Vercel, import that repository.
3. Framework preset: Vite.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Deploy.

`vercel.json` provides an SPA rewrite for client-side navigation.

## Remaining production work
Before launch, add and test Supabase authentication/database policies, server-side admin authorization, a verified payment provider and webhook, real news/economic-calendar source, and a genuine chart history feed. Never expose secret/service-role keys in frontend code.

## Future Supabase integration
Create a separate implementation phase before connecting Supabase. Add only public client configuration through environment variables; never expose service-role keys in frontend code. Configure database policies/RLS and server-side authorization before enabling member or admin operations.