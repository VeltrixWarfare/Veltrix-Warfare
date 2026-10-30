-- VELTRIX WARFARE payment transactions baseline.
-- Manual QRIS flow is finalized by the next migration.
create extension if not exists pgcrypto;
create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  plan text not null check (plan in ('Essential','Advanced','Private')),
  billing_period text not null check (billing_period in ('Monthly','Yearly')),
  amount integer not null check (amount > 0),
  currency text not null default 'IDR' check (currency = 'IDR'),
  status text not null default 'pending_verification',
  payment_method text not null default 'manual_qris',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists payment_transactions_user_created_idx on public.payment_transactions(user_id, created_at desc);
create index if not exists payment_transactions_status_idx on public.payment_transactions(status);
alter table public.payment_transactions enable row level security;
drop policy if exists "Users can read their own payment transactions" on public.payment_transactions;
create policy "Users can read their own payment transactions" on public.payment_transactions for select to authenticated using (auth.uid()=user_id);
revoke all on public.payment_transactions from anon, authenticated;
grant select on public.payment_transactions to authenticated;
grant all on public.payment_transactions to service_role;
