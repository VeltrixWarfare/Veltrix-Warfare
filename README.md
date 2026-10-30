# VELTRIX WARFARE — Manual QRIS Membership Payments

## Flow
Member selects a configured package -> backend creates a server-priced transaction -> site shows the original merchant QRIS -> member uploads a JPG/PNG/WEBP proof (max 5 MB) -> backend stores it in private Supabase Storage and emails the admin -> admin compares the payment in the official merchant app and approves/rejects -> only the server-side admin review RPC updates membership.

A submitted screenshot is not proof of settlement. Do not approve until the actual merchant transaction has been checked.

## Supabase setup
1. Back up the current Supabase project.
2. Confirm the existing `profiles` table includes `id`, `full_name`, `role` and that `memberships` includes `user_id`, `plan`, `status`, `starts_at`, `ends_at`, `payment_reference`, `updated_at`. Existing admin setup is expected to define `public.is_admin()`.
3. Run the migrations in order in `supabase/migrations/` if they have not already been applied. For an existing database, run the new `202610300001_manual_qris_payment.sql` migration after reviewing it. Do not blindly re-run old migration history.
4. Confirm the Storage bucket `payment-proofs` is private. Migration sets a 5 MB file limit and allowed image types.
5. Ensure your account has `profiles.role = 'admin'` using the exact registered account. Never promote a user based only on a request from the browser.

## Vercel environment variables
Frontend:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (public anon/publishable key only)

Server-only:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `PAYMENT_ADMIN_EMAIL`
- `EMAIL_FROM` (sender on a domain verified with your email provider)

Never put `SUPABASE_SERVICE_ROLE_KEY` or `RESEND_API_KEY` in a `VITE_*` variable or client code. Configure Preview first, then redeploy. Use a verified sender domain for production mail.

## Merchant QRIS
The website currently displays `public/qris-merchant.jpg` exactly as provided. The visible merchant identity in the image is not edited. To use VELTRIX WARFARE as the actual merchant name, request an official merchant-name update from the licensed QRIS acquirer/provider and replace the image only with the newly issued authentic QRIS. Test a small amount and check the transaction in the official merchant app.

## Price configuration
Current server prices are preserved from the project:
- Essential: Rp79.000/month; Rp758.000/year
- Advanced: Rp149.000/month; Rp1.430.000/year
- Private: Rp299.000/month; Rp2.870.000/year

Confirm the final commercial prices before accepting real payments. Server-side prices are authoritative; browser values are ignored.

## Email
Create a Resend account owned/managed by the business owner/parent or guardian as appropriate, verify a sending domain, then set `RESEND_API_KEY`, `PAYMENT_ADMIN_EMAIL`, and `EMAIL_FROM` in Vercel. Email notification failure is logged server-side; check Vercel Function Logs. Configure monitoring and test delivery before going live.

## Run / deploy
- `npm install`
- `npm run build`
- Push the project to the connected Git repository or deploy the project directory using Vercel.
- Set environment variables for Preview, deploy, and test with a test account before Production.

## Important test checklist
- Unauthenticated checkout is rejected.
- Unknown plan / billing period is rejected.
- Member cannot submit proof to another user's order.
- Uploads accept only JPEG/PNG/WEBP up to 5 MB.
- Duplicate proof submission is rejected.
- Member sees only their own transactions.
- Non-admin cannot access admin queue or review transactions.
- Screenshot upload alone does not activate membership.
- Admin approves only after verifying the actual merchant record.
- Rejection does not activate membership.
- Email delivery is checked in provider and Vercel logs.
