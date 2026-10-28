# VELTRIX WARFARE

Premium trading-platform frontend preview built with React, TypeScript and Vite.

## Included
- Responsive landing page and app-style navigation
- Dashboard, Market, News & Calendar, Academy, Analysis, About
- Membership/pricing, Login/Register UI, Admin preview and Transactions
- Local demo interactions (search, market filters, watchlist, tabs, timeframe)
- Original brand palette aligned with the supplied silver-on-black logo
- Vercel SPA rewrite configuration

## Important
This is a frontend-only preview. Market values, news, calendar entries, account metrics, memberships and transactions are demo content and are not live or verified financial data. Authentication, payments, admin authorization, and Supabase are not connected. Do not use the admin or transaction preview to manage real users or payments.

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

## Future Supabase integration
Create a separate implementation phase before connecting Supabase. Add only public client configuration through environment variables; never expose service-role keys in frontend code. Configure database policies/RLS and server-side authorization before enabling member or admin operations.