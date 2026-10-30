-- VELTRIX WARFARE manual QRIS payment flow (additive; no existing tables dropped)
drop function if exists public.confirm_midtrans_payment(text,text);
create extension if not exists pgcrypto;

alter table public.payment_transactions
  add column if not exists proof_path text,
  add column if not exists proof_submitted_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists customer_email text;

-- Remove the previous status check, then normalize old Midtrans-era records without deleting history.
do $$
declare c record;
begin
  for c in select conname from pg_constraint
    where conrelid='public.payment_transactions'::regclass and contype='c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.payment_transactions drop constraint %I', c.conname);
  end loop;
end $$;
update public.payment_transactions set status='pending_verification' where status='pending';
update public.payment_transactions set status='approved' where status='paid';
update public.payment_transactions set status='rejected' where status in ('failed','cancelled','expired','refunded');
alter table public.payment_transactions
  add constraint payment_transactions_status_check
  check (status in ('pending_verification','approved','rejected'));

-- Payment proof files must live in a private Storage bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs','payment-proofs',false,3145728,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=3145728,
  allowed_mime_types=array['image/jpeg','image/png','image/webp'];

alter table public.payment_transactions enable row level security;
drop policy if exists "Users can read their own payment transactions" on public.payment_transactions;
drop policy if exists "payment_transactions_member_select" on public.payment_transactions;
create policy "payment_transactions_member_select" on public.payment_transactions
  for select to authenticated using (auth.uid() = user_id);
revoke all on public.payment_transactions from anon, authenticated;
grant select on public.payment_transactions to authenticated;
grant all on public.payment_transactions to service_role;

drop policy if exists "member_upload_own_payment_proof" on storage.objects;
create policy "member_upload_own_payment_proof" on storage.objects
  for insert to authenticated with check (
    bucket_id='payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text
  );
drop policy if exists "member_read_own_payment_proof" on storage.objects;
create policy "member_read_own_payment_proof" on storage.objects
  for select to authenticated using (
    bucket_id='payment-proofs' and (
      (storage.foldername(name))[1] = auth.uid()::text or exists (select 1 from public.profiles p where p.id=auth.uid() and lower(p.role)='admin')
    )
  );
drop policy if exists "member_delete_own_payment_proof" on storage.objects;
create policy "member_delete_own_payment_proof" on storage.objects
  for delete to authenticated using (
    bucket_id='payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Only the authenticated admin identity checked by the API can invoke the server-side RPC.
create or replace function public.admin_review_payment(
  p_order_id text, p_admin_id uuid, p_decision text, p_rejection_reason text default null
) returns boolean
language plpgsql security definer set search_path=public,pg_temp
as $$
declare tx public.payment_transactions%rowtype;
declare existing_end timestamptz;
declare duration interval;
begin
  if p_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
  if not exists(select 1 from public.profiles where id=p_admin_id and lower(role)='admin') then
    raise exception 'Admin authorization failed';
  end if;
  select * into tx from public.payment_transactions where order_id=p_order_id for update;
  if not found then raise exception 'Transaction not found'; end if;
  if tx.status <> 'pending_verification' or tx.proof_path is null then
    raise exception 'Transaction is not awaiting verification or has no proof';
  end if;
  if p_decision='rejected' then
    update public.payment_transactions set status='rejected',
      rejection_reason=coalesce(nullif(trim(p_rejection_reason),''),'Silakan hubungi admin melalui kanal resmi.'),
      updated_at=now()
    where order_id=p_order_id;
    return true;
  end if;
  duration := case when tx.billing_period='Yearly' then interval '1 year' else interval '1 month' end;
  select ends_at into existing_end from public.memberships where user_id=tx.user_id for update;
  if found and existing_end > now() then
    update public.memberships set plan=tx.plan,status='active',starts_at=coalesce(starts_at,now()),
      ends_at=existing_end+duration,payment_reference=tx.order_id,updated_at=now()
      where user_id=tx.user_id;
  else
    insert into public.memberships(user_id,plan,status,starts_at,ends_at,payment_reference,created_at,updated_at)
    values(tx.user_id,tx.plan,'active',now(),now()+duration,tx.order_id,now(),now())
    on conflict(user_id) do update set plan=excluded.plan,status='active',
      starts_at=now(),ends_at=now()+duration,payment_reference=excluded.payment_reference,updated_at=now();
  end if;
  update public.payment_transactions set status='approved',paid_at=now(),updated_at=now(),rejection_reason=null
    where order_id=p_order_id;
  return true;
end $$;
revoke all on function public.admin_review_payment(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_review_payment(text,uuid,text,text) to service_role;
