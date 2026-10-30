# VELTRIX WARFARE — Manual QRIS (integration handoff)

## What this build does
- Keeps the existing VELTRIX UI and server-priced package values.
- Creates payment records through `api/payment/create.ts` in `public.payment_transactions`.
- Accepts proof uploads through `api/payment/submit.ts` into the private `payment-proofs` Storage bucket.
- Sends an admin email through Resend when configured.
- Provides member transaction history and admin review endpoints.
- Removes the Midtrans webhook endpoint from this project build.

## Important database note
The application code uses `public.payment_transactions`. The separate `public.manual_qris_payments` table created by the earlier quick SQL is NOT used by this code. Do not delete it yet; it can remain unused until the live app is verified.

Apply the project migrations in order only after backing up Supabase:
1. `supabase/migrations/202610290001_payment_integration.sql`
2. `supabase/migrations/202610300001_manual_qris_payment.sql`

The second migration and the approval RPC expect a `public.memberships` table with columns:
`user_id, plan, status, starts_at, ends_at, payment_reference, created_at, updated_at`
and a unique constraint on `user_id`. It also expects `public.profiles(id, role)`.
Your previous report said `memberships` is empty and `vw_memberships` contains membership data. An empty table is not a problem by itself, but if the actual columns or source of membership entitlement differ, DO NOT run the approval RPC migration until the schema is reconciled. The approval endpoint will not safely activate membership until that is verified.

The SQL uses `lower(role)='admin'`. Ensure the trusted `profiles.role` for the authorized administrator is `admin`.

## QRIS image is intentionally not fabricated
This ZIP did not contain `public/qris-merchant.jpg`. Add the original merchant QRIS image at exactly that path before enabling checkout. Do not edit the QR, NMID, merchant name, or payment data. If the merchant display name must become VELTRIX WARFARE, obtain a newly issued QRIS from the licensed acquirer/provider; do not retouch the old image.

## Vercel environment variables
Frontend:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server-only:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `PAYMENT_ADMIN_EMAIL`
- `EMAIL_FROM`

Never expose service-role or Resend secrets in `VITE_*` variables or client code.

## Email
Use a Resend account controlled by the business owner/parent or guardian as appropriate. Verify the sending domain and configure `EMAIL_FROM` to that verified sender. Check Vercel Function Logs and Resend delivery logs. Email failure currently logs an error; it does not undo the saved proof submission.

## Prices
The server-side package configuration remains:
- Essential: Rp79.000/month; Rp758.000/year
- Advanced: Rp149.000/month; Rp1.430.000/year
- Private: Rp299.000/month; Rp2.870.000/year

Confirm prices before real payments.

## Verification status / deployment
Dependency installation timed out in this environment, so a complete `npm run build` has NOT been verified. Do not claim production readiness. Before deployment:
1. Add the authentic QRIS image.
2. Reconcile `memberships` schema and test approval against a test account.
3. Apply migrations only after schema review and backup.
4. Run `npm install` and `npm run build` locally or in CI.
5. Test unauthenticated rejection, member ownership, upload size/type, duplicate proof prevention, admin authorization, rejection, approval, membership dates, email, and private proof access.
6. Confirm the deployed site and repository no longer contain Midtrans code or credentials.


## Important: existing Supabase schema compatibility
This ZIP includes `supabase/migrations/202610300002_legacy_payment_compat.sql` for projects whose `payment_transactions` table was originally created for Midtrans. Apply this migration in Supabase SQL Editor after reviewing/backing up the database. It makes old Midtrans-only columns optional and removes legacy payment-method checks while preserving old rows. It does not enable membership based on proof upload.

## QRIS asset
The original merchant QRIS image provided for this project is included unchanged at `public/qris-merchant.jpg`. The app references this exact path. The image itself is not edited.
