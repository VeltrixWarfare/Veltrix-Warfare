-- VELTRIX WARFARE payment integration (additive migration)
-- This migration does not drop or truncate existing tables.
create extension if not exists pgcrypto;

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  plan text not null check (plan in ('Essential','Advanced','Private')),
  billing_period text not null check (billing_period in ('Monthly','Yearly')),
  amount integer not null check (amount > 0),
  currency text not null default 'IDR' check (currency = 'IDR'),
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled','expired','refunded')),
  payment_method text not null default 'qris',
  snap_token text,
  redirect_url text,
  gateway_response jsonb,
  payment_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists payment_transactions_user_created_idx
  on public.payment_transactions(user_id, created_at desc);
create index if not exists payment_transactions_status_idx
  on public.payment_transactions(status);

alter table public.payment_transactions enable row level security;
drop policy if exists "Users can read their own payment transactions" on public.payment_transactions;
create policy "Users can read their own payment transactions"
  on public.payment_transactions for select to authenticated
  using (auth.uid() = user_id);
revoke all on public.payment_transactions from anon, authenticated;
grant select on public.payment_transactions to authenticated;
grant all on public.payment_transactions to service_role;

-- Called only by the server-side Midtrans webhook using the service-role key.
-- It checks the stored transaction and activates the existing memberships row.
-- It intentionally errors rather than guessing if the existing memberships schema differs.
create or replace function public.confirm_midtrans_payment(
  p_order_id text,
  p_payment_reference text
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tx public.payment_transactions%rowtype;
  membership_exists boolean;
  required_columns text[] := array['user_id','plan','status','starts_at','ends_at','payment_reference'];
  missing_column text;
  duration interval;
begin
  select * into tx from public.payment_transactions
   where order_id = p_order_id for update;
  if not found then return false; end if;
  if tx.status = 'paid' then return true; end if;

  foreach missing_column in array required_columns loop
    if not exists (
      select 1 from information_schema.columns
       where table_schema='public' and table_name='memberships' and column_name=missing_column
    ) then
      raise exception 'Required column public.memberships.% is missing; payment recorded but membership was not activated.', missing_column;
    end if;
  end loop;

  duration := case when tx.billing_period = 'Yearly' then interval '1 year' else interval '1 month' end;
  execute 'select exists(select 1 from public.memberships where user_id = $1)'
    into membership_exists using tx.user_id;

  if membership_exists then
    execute 'update public.memberships set plan=$1, status=''active'', starts_at=now(), ends_at=now()+$2, payment_reference=$3 where user_id=$4'
      using tx.plan, duration, p_payment_reference, tx.user_id;
  else
    execute 'insert into public.memberships (user_id, plan, status, starts_at, ends_at, payment_reference) values ($1,$2,''active'',now(),now()+$3,$4)'
      using tx.user_id, tx.plan, duration, p_payment_reference;
  end if;

  update public.payment_transactions
     set status='paid', payment_reference=p_payment_reference, paid_at=now(), updated_at=now()
   where order_id=p_order_id;
  return true;
end;
$$;
revoke all on function public.confirm_midtrans_payment(text,text) from public, anon, authenticated;
grant execute on function public.confirm_midtrans_payment(text,text) to service_role;
