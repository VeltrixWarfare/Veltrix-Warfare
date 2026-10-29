# VELTRIX WARFARE — payment integration rebuild

## Contents
- `apply-payment-frontend.mjs`: adds checkout redirect and transaction history to the existing `src/App.tsx` without replacing the rest of the UI.
- `supabase/migrations/202610290001_payment_integration.sql`: additive database migration; it does not drop existing tables.

## Apply frontend patch
Run from the root of the existing repository:

```bash
node apply-payment-frontend.mjs
npm run build
```

The script intentionally stops if its expected anchors are not found, rather than overwriting a different version of the app.

## Apply database migration
Review your existing `public.memberships` table in Supabase before running the migration. The activation function requires `user_id`, `plan`, `status`, `starts_at`, `ends_at`, and `payment_reference`. If your current table uses different names, stop and adapt the function to the real schema; do not delete or recreate the existing table.

Run the SQL in Supabase SQL Editor. Then configure Vercel environment variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never use a `VITE_` prefix)
- `MIDTRANS_SERVER_KEY` (use Sandbox key for testing)
- `MIDTRANS_IS_PRODUCTION=false`

Set the Midtrans payment notification URL to `https://YOUR-DEPLOYMENT-DOMAIN/api/payment/webhook`.

## Important
- The UI patch only wires the frontend to the existing API endpoints. It is not proof that the complete flow works until SQL, Vercel environment variables, Midtrans notification URL, and a sandbox test are all verified.
- Do not deploy real payments until the account/provider requirements and merchant identity are properly set up. Never expose server keys in frontend code.
